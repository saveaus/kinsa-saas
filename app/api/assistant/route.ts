import { registeredError } from "@/modules/billing/guard"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  smoothStream,
  streamText,
  toUIMessageStream,
  tool,
  type ToolSet,
  type UIMessage,
} from "ai"
import { after } from "next/server"
import { z } from "zod"

import { standardsForGroups } from "@/lib/ndis-practice-standards"
import { createAdminSupabase, hasAdminClient } from "@/lib/supabase/admin"
import { can, getTenantContext, type TenantContext } from "@/lib/tenant"
import { assistantAllowanceMessage } from "@/modules/assistant/allowance"
import {
  expandAttachmentText,
  trialDataUrlLimit,
} from "@/modules/assistant/attachment-text"
import { assistantSnapshot } from "@/modules/assistant/context"
import {
  claimAssistantTrialTokens,
  loadAssistantAllowance,
  settleAssistantTokens,
} from "@/modules/assistant/usage"
import { interviewReply, planInterviewTurn } from "@/modules/assistant/interview-turn"
import { storedMessagesJson, type AssistantStoredMessage } from "@/modules/assistant/messages"
import { promptChars, settledTokens } from "@/modules/assistant/settlement"
import {
  assistantHistoryLimit,
  assistantModel,
  assistantReplyBudget,
  assistantTemperature,
  interviewHistoryLimit,
  interviewReplyTokens,
} from "@/modules/assistant/model"
import { parsePolicyDraft } from "@/modules/assistant/policy"
import { recordAreas, selectRecords } from "@/modules/assistant/records"
import { loadAssistantPackItems } from "@/modules/assistant/records-query"
import { prepareAssistantSnapshot } from "@/modules/assistant/snapshot-query"
import { snapshotViews } from "@/modules/assistant/snapshots"
import {
  assignmentRequest,
  assignTasksInputSchema,
  prepareComplianceAssignment,
  prepareTaskAssignment,
  type AssignmentRequest,
} from "@/modules/assistant/assignments"
import {
  assistantTaskInputSchema,
  prepareAssistantTask,
  type AssistantTaskKind,
} from "@/modules/assistant/tasks"
import { isPolicyFlagPrompt } from "@/modules/policies/flag-prompt"
import {
  complianceCountHeading,
  complianceCountNote,
} from "@/modules/tasks/lift"
import {
  loadComplianceCount,
  loadComplianceLift,
  loadComplianceTarget,
} from "@/modules/tasks/load"
import { listTaskAssignees } from "@/modules/tasks/queries"
import { canConductInternalAudit } from "@/modules/internal-audits/access"
import {
  chosenAuditGroups,
  conductInstructions,
  parseAuditFinding,
} from "@/modules/internal-audits/conduct"
import { interviewTurn } from "@/modules/internal-audits/queries"
import { mintRatingProposal } from "@/modules/internal-audits/rate"
import { isAuditRating } from "@/modules/internal-audits/rating"
import { listTeams } from "@/modules/teams/queries"

export const runtime = "nodejs"
export const maxDuration = 60

function assistantErrorText(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""
  if (
    message.includes("credit card") ||
    message.includes("customer_verification_required")
  ) {
    return "Add a payment method to the AI Gateway before the assistant can reply."
  }
  if (message.includes("Free tier users do not have access")) {
    return "Add AI Gateway credits before the assistant can use this model."
  }
  return "The assistant could not answer. Try again."
}

function recentMessages(
  messages: UIMessage[],
  limit: number,
  textLimit: number,
  fileLimit?: number
) {
  return expandAttachmentText(messages.slice(-limit), textLimit, fileLimit)
}

function readRequest(body: unknown) {
  if (!body || typeof body !== "object")
    return { messages: null, chatId: null, audit: false }
  const record = body as Record<string, unknown>
  const messages = Array.isArray(record.messages)
    ? (record.messages as UIMessage[])
    : null
  const chatId = typeof record.chatId === "string" ? record.chatId : null
  const audit = record.mode === "internal_audit"
  return { messages, chatId, audit }
}

export async function POST(request: Request) {
  const context = await getTenantContext()
  if (!context) {
    return Response.json({ error: "Sign in required." }, { status: 401 })
  }
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return Response.json(
      { error: "The assistant is not connected yet." },
      { status: 501 }
    )
  }

  const {
    messages: incoming,
    chatId,
    audit: requestedAudit,
  } = readRequest(await request.json().catch(() => null))
  if (!incoming || incoming.length === 0) {
    return Response.json({ error: "Send a message." }, { status: 400 })
  }

  const allowance = await loadAssistantAllowance(context.organisationId)
  if (allowance.kind === "spent" || allowance.kind === "ended") {
    return new Response(assistantAllowanceMessage(allowance), { status: 402 })
  }

  const turn = chatId
    ? await interviewTurn(context, chatId)
    : { kind: "general" as const }
  if (turn.kind === "missing") {
    return Response.json(
      { error: "That interview could not be opened." },
      { status: 404 }
    )
  }

  const interview = turn.kind === "interview"
  const audit = turn.kind === "audit" || (!interview && requestedAudit)
  if (audit && !(await canConductInternalAudit(context))) {
    return Response.json(
      {
        error:
          "An administrator on the Registered plan runs the internal audit.",
      },
      { status: 403 }
    )
  }
  if (interview && (await registeredError(context))) {
    return Response.json(
      { error: "Interviews are part of the Registered plan." },
      { status: 403 }
    )
  }
  // The browser sends the new answer only. The transcript is the server's.
  const interviewPlan = interview
    ? planInterviewTurn(turn.messages, incoming.at(-1))
    : null
  if (interview) {
    if (!hasAdminClient()) {
      return Response.json(
        { error: "Interviews are not connected yet." },
        { status: 501 }
      )
    }
    if (!interviewPlan) {
      return Response.json({ error: "Send your answer." }, { status: 400 })
    }
  }
  const general = !interview && !audit
  const canReviewDocuments = general && can(context, "documents.approve")
  const taskTeams =
    general && can(context, "workers.manage")
      ? (await listTeams(context)).map((team) => ({
          code: team.code,
          name: team.name,
        }))
      : []
  const taskStandards =
    general && can(context, "settings.manage")
      ? standardsForGroups(context.organisationRegistrationGroups).map(
          (standard) => ({
            code: standard.code,
            name: standard.name,
          })
        )
      : []
  const taskAllowed = [
    ...(canReviewDocuments ? (["review_documents"] as const) : []),
    ...(taskTeams.length > 0 ? (["add_worker"] as const) : []),
    ...(taskStandards.length > 0 ? (["file_policy"] as const) : []),
  ]
  const imageInstruction =
    "Attached images are visible to you. Look at each image and answer from what is in it. Do not say you cannot see images. Do not call a tool to answer a question about an attached image."
  const instructions = interview
    ? [turn.instructions, imageInstruction].join("\n\n")
    : audit
      ? [
          conductInstructions(
            chosenAuditGroups(incoming, context.organisationRegistrationGroups)
          ),
          imageInstruction,
          "",
          await assistantSnapshot(context),
        ].join("\n")
      : [
          "You are Kinsa's compliance assistant for an Australian NDIS provider.",
          "Answer in a few short sentences.",
          "The customer can attach images, text, and files. Read an attached file before you answer.",
          imageInstruction,
          "When asked to generate or draft a policy, call draft_policy once with the full policy. If they do not name one, draft the most important missing policy from the snapshot. Do not paste the policy into the chat. After the tool, say it is a Word draft and has not been filed.",
          "Use only the snapshot for facts about this organisation. Do not invent records or guarantee an audit pass.",
          "When the customer asks how an NDIS update affects the organisation and includes an article title, link, and summary, answer from that summary and this organisation's registration groups. Say what they need to change and what does not apply. Do not add rules that are not in the summary.",
          "If the customer drops a staff list or certificates, talk through who will be added and which files will be filed. Do not say those records are in until the customer says they added them.",
          "Drafts do not count. If the snapshot does not say, say it is not in this snapshot.",
          taskAllowed.length > 0
            ? "When asked to add a worker, file a policy, or check pending documents, call propose_task once. Nothing is saved until they press Confirm. Do not say the change is done."
            : "",
          can(context, "workers.manage")
            ? "When asked to create or assign a task, call assign_tasks once with kind task, a short title, and a one-line detail. Do not choose an assignee. When asked what to do to become more compliant, or to raise compliance by a percent, call assign_tasks once with kind compliance and lift set to that number of percentage points (20 if they said 20% more). Do not also call show_records or show_snapshot for that question. Do not list the tasks in the reply. The card is how they assign each task, or all of them. After the tool, one sentence. Do not say the tasks are assigned until they press Assign."
            : "",
          can(context, "workers.read_all")
            ? "When the customer asks to see something specific, call show_snapshot once and do not also call show_records. view worker plus their name shows one person's compliance ring. If several people share the name, a chooser appears; if they then give a worker id, pass workerId. view readiness, open_items, and areas show the dashboard charts. view participant shows a participant's support plan and service agreement. view policy shows an existing policy. view register shows an incident, complaint, or risk; pass a short name or 'latest incident'. After the tool, one sentence. Do not repeat the numbers on the chart. For a list of records, call show_records instead of show_snapshot. After show_records, say what to do first in one or two sentences. Do not repeat every row."
            : "",
          "",
          await assistantSnapshot(context),
        ]
          .filter(Boolean)
          .join("\n")
  const assessment = interview
    ? tool({
        description:
          "Propose the rating for this criterion once the interview has covered policy, practice, responsibility, and evidence. Nothing is saved until the person presses Confirm.",
        inputSchema: z.object({
          rating: z.enum(["met", "partial", "not_met"]),
          summary: z.string().min(1).max(2000),
        }),
        execute: async ({ rating, summary }) => {
          if (!isAuditRating(rating) || turn.kind !== "interview")
            return { proposed: false }
          const proposal = await mintRatingProposal({
            organisationId: context.organisationId,
            assignmentId: turn.assignmentId,
            userId: context.userId,
            rating,
            summary,
          })
          if (!proposal) return { proposed: false }
          return {
            proposed: true,
            proposalId: proposal.id,
            rating,
            summary: proposal.summary,
          }
        },
      })
    : null
  const finding = audit
    ? tool({
        description:
          "Propose one internal audit finding once the area has enough evidence. Nothing is recorded until the person presses Confirm. Include what is happening, the next action, who does it, and how completion will be checked.",
        inputSchema: z.object({
          area: z.string().min(1).max(80),
          rating: z.enum(["met", "partial", "not_met", "not_applicable"]),
          finding: z.string().min(1).max(500),
          action: z.string().min(1).max(500),
          owner: z.string().min(1).max(80),
          check: z.string().min(1).max(240),
        }),
        execute: async (input) => {
          const recorded = parseAuditFinding(input)
          if (!recorded) return { proposed: false }
          return { proposed: true, ...recorded }
        },
      })
    : null

  let showedVisual = false
  function claimVisual() {
    if (showedVisual) return false
    showedVisual = true
    return true
  }

  const showSnapshot =
    !interview && !audit && can(context, "workers.read_all")
      ? tool({
          description:
            "Show one chart or record from the product. Call it once per reply, and do not also call show_records. view worker shows a compliance ring; pass name, or workerId after a chooser. view readiness, open_items, and areas are the dashboard charts. view participant, policy, and register show that record. register covers an incident, complaint, or risk.",
          inputSchema: z.object({
            view: z.enum(snapshotViews),
            name: z.string().max(80).optional(),
            workerId: z.string().max(80).optional(),
          }),
          execute: async ({ view, name, workerId }) => {
            if (!claimVisual())
              return {
                shown: false,
                reason: "This reply already shows one view.",
              }
            return prepareAssistantSnapshot(context, { view, name, workerId })
          },
        })
      : null

  const showRecords =
    !interview && !audit && can(context, "workers.read_all")
      ? tool({
          description:
            "Show compliance records as cards the customer can open. Use for a list of gaps, not when show_snapshot already shows the chart or record. For a general question, leave area and query empty. Set query only to find a name. clearance covers worker screening and credentials.",
          inputSchema: z.object({
            area: z.enum(recordAreas).optional(),
            query: z.string().max(80).optional(),
          }),
          execute: async ({ area, query }) => {
            if (!claimVisual()) return { available: false }
            const items = await loadAssistantPackItems(context)
            if (!items) return { available: false }
            return selectRecords(items, { area, query })
          },
        })
      : null

  const draftPolicy =
    !interview && !audit
      ? tool({
          description:
            "Write one policy as a Word document the customer can preview and download. Use when asked to generate, draft, or write a policy. Do not paste the policy text into the chat.",
          inputSchema: z.object({
            title: z.string().min(1).max(160),
            purpose: z.string().min(1).max(900),
            scope: z.string().min(1).max(700),
            statement: z.string().min(1).max(1800),
            responsibilities: z.array(z.string().min(1).max(280)).min(1).max(8),
            procedure: z.array(z.string().min(1).max(360)).min(2).max(12),
          }),
          execute: async (input) => {
            const draft = parsePolicyDraft({
              ...input,
              organisation: context.organisationName,
            })
            if (!draft) return { drafted: false }
            return draft
          },
        })
      : null

  const proposeTask =
    taskAllowed.length > 0
      ? tool({
          description: proposeTaskDescription(
            taskAllowed,
            taskTeams,
            taskStandards
          ),
          inputSchema: assistantTaskInputSchema,
          execute: async (input) =>
            prepareAssistantTask(input, {
              organisation: context.organisationName,
              teams: taskTeams,
              standards: taskStandards,
              allowed: taskAllowed,
            }),
        })
      : null

  const assignTasks =
    general && can(context, "workers.manage")
      ? tool({
          description:
            "Propose staff tasks. Nothing is saved until the customer presses Assign. kind task is one task: pass title and detail, and do not choose an assignee. kind compliance lists the open items that raise compliance by lift percentage points. Pass lift as the number they asked for.",
          inputSchema: assignTasksInputSchema,
          execute: async (input) => {
            if (!claimVisual())
              return {
                proposed: false,
                reason: "This reply already shows one view.",
              }
            try {
              const people = await listTaskAssignees(context)
              const directory = { people, youId: context.workerId }
              if (input.kind === "task")
                return prepareTaskAssignment(input, directory)
              if (input.kind === "compliance") {
                const plan = await loadComplianceLift(context, input.lift ?? 20)
                if (!plan.ok) return { proposed: false, reason: plan.reason }
                return prepareComplianceAssignment(plan, directory)
              }
              const neverInput: never = input
              return neverInput
            } catch (error) {
              console.error("assign tasks", error)
              return { proposed: false, reason: "Tasks could not be prepared." }
            }
          },
        })
      : null

  const flagTurn = general && isPolicyFlagPrompt(lastUserText(incoming))
  if (general && can(context, "workers.manage") && !flagTurn) {
    const asked = assignmentRequest(lastUserText(incoming))
    if (asked) return streamAssignmentReply(context, asked)
  }

  const messages = recentMessages(
    interviewPlan?.history ?? incoming,
    interview || audit ? interviewHistoryLimit : assistantHistoryLimit,
    interview || audit ? 2000 : 800,
    allowance.kind === "trial" ? trialDataUrlLimit : undefined
  )
  let tools: ToolSet | undefined
  if (assessment) tools = { record_assessment: assessment }
  else if (finding) tools = { record_finding: finding }
  else if (
    proposeTask ||
    assignTasks ||
    showSnapshot ||
    showRecords ||
    draftPolicy
  ) {
    tools = {
      ...(proposeTask ? { propose_task: proposeTask } : {}),
      ...(assignTasks ? { assign_tasks: assignTasks } : {}),
      ...(showSnapshot ? { show_snapshot: showSnapshot } : {}),
      ...(showRecords ? { show_records: showRecords } : {}),
      ...(draftPolicy ? { draft_policy: draftPolicy } : {}),
    }
  }
  if (flagTurn) tools = undefined
  const guided = flagTurn
    ? `${instructions}\nThe customer asked why a flagged policy does not meet its practice standard. Explain the gaps in a few sentences and list the changes. End by asking whether they want you to implement the changes or assign them to someone. Do not call a tool.`
    : instructions
  const replyTokens = flagTurn
    ? interviewReplyTokens
    : assistantReplyBudget(
        general ? "general" : interview ? "interview" : "audit",
        lastUserText(incoming)
      )
  let outputTokens = replyTokens
  const claim = { tokens: 0, at: new Date().toISOString() }
  if (allowance.kind === "trial" || allowance.kind === "included") {
    const granted = await claimAssistantTrialTokens(
      context.organisationId,
      Math.min(allowance.remaining, replyTokens + 4_000)
    )
    if (granted <= 0) {
      return new Response(
        assistantAllowanceMessage({
          kind: "spent",
          reset: allowance.kind === "trial" ? "trial" : "month",
          included: allowance.included,
        }),
        { status: 402 }
      )
    }
    claim.tokens = granted
    outputTokens = Math.min(replyTokens, granted)
  }
  const organisationId = context.organisationId
  const settle = (actual: number) =>
    settleAssistantTokens(organisationId, claim, actual).catch((error: unknown) => {
      console.error("assistant settlement", error)
    })
  const saveInterview = async (stored: AssistantStoredMessage[]) => {
    if (turn.kind !== "interview" || stored.length === 0) return
    const { error } = await createAdminSupabase().rpc("append_interview_messages", {
      p_chat_id: turn.chatId,
      p_organisation_id: organisationId,
      p_user_id: context.userId,
      p_messages: storedMessagesJson(stored),
    })
    if (error) throw new Error(error.message)
  }

  try {
    if (interviewPlan?.append) await saveInterview([interviewPlan.append])

    const modelMessages = await convertToModelMessages(messages, {
      tools,
      ignoreIncompleteToolCalls: true,
    })
    const reply = {
      id: crypto.randomUUID(),
      text: "",
      tools: [] as { toolName: string; toolCallId: string; output: unknown }[],
      stepChars: 0,
    }
    const result = streamText({
      model: assistantModel,
      temperature: assistantTemperature,
      maxOutputTokens: outputTokens,
      ...(tools ? { stopWhen: isStepCount(general ? 5 : 4) } : {}),
      tools,
      abortSignal: request.signal,
      experimental_transform: smoothStream({ delayInMs: 45, chunking: "word" }),
      instructions: guided,
      messages: modelMessages,
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta") {
          reply.text += chunk.text
          reply.stepChars += chunk.text.length
        }
        if (chunk.type === "tool-result" && !chunk.preliminary) {
          reply.tools.push({
            toolName: chunk.toolName,
            toolCallId: chunk.toolCallId,
            output: chunk.output,
          })
        }
      },
      onStepEnd: () => {
        reply.stepChars = 0
      },
      onError: ({ error }) => {
        console.error("assistant stream", error)
      },
    })

    // These settle on finish, abort, and error alike. A rejection means no step finished.
    const finished = Promise.resolve(result.steps)
      .then(
        (steps) => steps,
        () => []
      )
      .then(async (steps) => {
        const total = await Promise.resolve(result.totalUsage).then(
          (usage) => usage.totalTokens,
          () => null
        )
        const stored =
          turn.kind === "interview" ? interviewReply(reply.id, reply.text, reply.tools) : null
        await Promise.all([
          settle(
            settledTokens({
              claimed: claim.tokens,
              total,
              stepTokens: steps.map((step) => step.usage.totalTokens),
              aborted: request.signal.aborted,
              promptChars: promptChars(guided, messages),
              partialChars: reply.stepChars,
            })
          ),
          saveInterview(stored ? [stored] : []).catch((error: unknown) => {
            console.error("interview reply", error)
          }),
        ])
      })
      .catch((error: unknown) => {
        console.error("assistant finish", error)
      })
    // A dropped connection never reaches the stream's end, so keep the function alive for this.
    after(() => finished)

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: surfaceEmptyError(result.stream, finished),
        onError: (error) => assistantErrorText(error),
        ...(interview ? { generateMessageId: () => reply.id } : {}),
      }),
    })
  } catch (error) {
    console.error("assistant start", error)
    await settle(0)
    return Response.json(
      { error: "The assistant could not answer. Try again." },
      { status: 500 }
    )
  }
}

const settleWait = 4_000

/**
 * Gemini sometimes ends a tool call with no text and finish reason error. Surface that, or the chat looks like it ignored the question.
 * The stream stays open until usage is settled, so the next turn sees the right allowance.
 */
function surfaceEmptyError<T extends StreamPart>(
  stream: ReadableStream<T>,
  finished: Promise<unknown>
) {
  let sawContent = false
  return stream.pipeThrough(
    new TransformStream<T, T>({
      transform(part, controller) {
        if (isReplyContent(part)) sawContent = true
        if (
          !sawContent &&
          part.type === "finish" &&
          part.finishReason === "error"
        ) {
          controller.enqueue({
            type: "error",
            error: new Error("The assistant could not answer. Try again."),
          } as T)
        }
        controller.enqueue(part)
      },
      async flush() {
        await Promise.race([
          finished,
          new Promise((resolve) => setTimeout(resolve, settleWait)),
        ])
      },
    })
  )
}

function isReplyContent(part: StreamPart) {
  if (part.type === "text-delta") return (part.text?.length ?? 0) > 0
  return (
    part.type === "tool-call" ||
    part.type === "tool-input-start" ||
    part.type === "tool-result" ||
    part.type === "tool-error"
  )
}

type StreamPart = {
  type: string
  text?: string
  finishReason?: string
  error?: unknown
}

function lastUserText(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== "user") continue
    return message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("")
      .trim()
  }
  return ""
}

async function streamAssignmentReply(
  context: TenantContext,
  asked: AssignmentRequest
) {
  const people = await listTaskAssignees(context)
  const directory = { people, youId: context.workerId }
  const prepared =
    asked.kind === "task"
      ? prepareTaskAssignment(asked, directory)
      : await compliancePrepared(context, asked, directory)
  const sentence = prepared.proposed
    ? prepared.assignment.kind === "task"
      ? "Choose who this goes to."
      : "Choose who each of these goes to, or assign them all to one person."
    : prepared.reason
  const stream = createUIMessageStream({
    execute({ writer }) {
      const textId = "assignment-text"
      writer.write({ type: "start" })
      writer.write({ type: "start-step" })
      writer.write({ type: "text-start", id: textId })
      writer.write({ type: "text-delta", id: textId, delta: sentence })
      writer.write({ type: "text-end", id: textId })
      if (prepared.proposed) {
        const toolCallId = crypto.randomUUID()
        writer.write({
          type: "tool-input-available",
          toolCallId,
          toolName: "assign_tasks",
          input:
            asked.kind === "task"
              ? {
                  kind: "task",
                  title: asked.title,
                  detail: asked.detail || "Choose who this goes to.",
                }
              : { kind: "compliance", lift: prepared.assignment.lift ?? 20 },
        })
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: prepared,
        })
      }
      writer.write({ type: "finish-step" })
      writer.write({ type: "finish" })
    },
  })
  return createUIMessageStreamResponse({ stream })
}

async function compliancePrepared(
  context: TenantContext,
  asked: Extract<AssignmentRequest, { kind: "compliance" }>,
  directory: { people: { id: string; name: string }[]; youId: string | null }
) {
  switch (asked.mode) {
    case "lift": {
      const plan = await loadComplianceLift(context, asked.points)
      if (!plan.ok) return { proposed: false as const, reason: plan.reason }
      return prepareComplianceAssignment(plan, directory)
    }
    case "target": {
      const plan = await loadComplianceTarget(context, asked.percent)
      if (!plan.ok) return { proposed: false as const, reason: plan.reason }
      return prepareComplianceAssignment(plan, directory)
    }
    case "count": {
      const plan = await loadComplianceCount(context, asked.count)
      if (!plan.ok) return { proposed: false as const, reason: plan.reason }
      return prepareComplianceAssignment(plan, directory, {
        heading: complianceCountHeading(plan.tasks.length),
        note: complianceCountNote(plan, asked.count),
      })
    }
    default: {
      const neverMode: never = asked
      return neverMode
    }
  }
}

function proposeTaskDescription(
  allowed: readonly AssistantTaskKind[],
  teams: { code: string; name: string }[],
  standards: { code: string; name: string }[]
) {
  const lines = [
    "Propose one change in the software. Nothing is saved until the customer presses Confirm.",
  ]
  if (allowed.includes("review_documents")) {
    lines.push(
      "review_documents checks pending worker documents. Pass only kind."
    )
  }
  if (allowed.includes("add_worker")) {
    const names = teams.map((team) => `${team.name} (${team.code})`).join(", ")
    lines.push(`add_worker adds one worker. team must be one of: ${names}.`)
  }
  if (allowed.includes("file_policy")) {
    const names = standards
      .map((standard) => `${standard.code} (${standard.name})`)
      .join("; ")
    lines.push(
      `file_policy saves one policy draft. standardCode must be one of: ${names}. Include the full policy.`
    )
  }
  return lines.join(" ")
}
