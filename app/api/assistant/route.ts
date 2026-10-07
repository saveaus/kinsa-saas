import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  smoothStream,
  streamText,
  toUIMessageStream,
  tool,
  type ToolSet,
  type UIMessage,
} from "ai"
import { z } from "zod"

import { standardsForGroups } from "@/lib/ndis-practice-standards"
import { can, getTenantContext } from "@/lib/tenant"
import { expandAttachmentText } from "@/modules/assistant/attachment-text"
import { assistantAllowanceMessage } from "@/modules/assistant/allowance"
import { assistantSnapshot } from "@/modules/assistant/context"
import { loadAssistantAllowance, recordAssistantTokens } from "@/modules/assistant/usage"
import {
  assistantHistoryLimit,
  assistantModel,
  assistantReplyTokens,
  interviewHistoryLimit,
  interviewReplyTokens,
  policyReplyTokens,
} from "@/modules/assistant/model"
import { parsePolicyDraft } from "@/modules/assistant/policy"
import { recordAreas, selectRecords } from "@/modules/assistant/records"
import { loadAssistantPackItems } from "@/modules/assistant/records-query"
import { prepareAssistantSnapshot } from "@/modules/assistant/snapshot-query"
import { snapshotViews } from "@/modules/assistant/snapshots"
import {
  assistantTaskInputSchema,
  prepareAssistantTask,
  type AssistantTaskKind,
} from "@/modules/assistant/tasks"
import { canConductInternalAudit } from "@/modules/internal-audits/access"
import {
  chosenAuditGroups,
  conductInstructions,
  parseAuditFinding,
} from "@/modules/internal-audits/conduct"
import { interviewTurn } from "@/modules/internal-audits/queries"
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

function recentMessages(messages: UIMessage[], limit: number, textLimit: number) {
  return expandAttachmentText(messages.slice(-limit), textLimit)
}

function readRequest(body: unknown) {
  if (!body || typeof body !== "object") return { messages: null, chatId: null, audit: false }
  const record = body as Record<string, unknown>
  const messages = Array.isArray(record.messages) ? (record.messages as UIMessage[]) : null
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

  const { messages: incoming, chatId, audit: requestedAudit } = readRequest(await request.json())
  if (!incoming || incoming.length === 0) {
    return Response.json({ error: "Send a message." }, { status: 400 })
  }

  const allowance = await loadAssistantAllowance(context.organisationId)
  if (allowance.kind === "spent" || allowance.kind === "ended") {
    return new Response(assistantAllowanceMessage(allowance.kind), { status: 402 })
  }
  const meterTrial = allowance.kind === "trial"

  const turn = chatId ? await interviewTurn(context, chatId) : { kind: "general" as const }
  if (turn.kind === "missing") {
    return Response.json({ error: "That interview could not be opened." }, { status: 404 })
  }

  const interview = turn.kind === "interview"
  const audit = turn.kind === "audit" || (!interview && requestedAudit)
  if (audit && !(await canConductInternalAudit(context))) {
    return Response.json(
      { error: "An administrator on the Registered plan runs the internal audit." },
      { status: 403 }
    )
  }
  const general = !interview && !audit
  const canReviewDocuments = general && can(context, "documents.approve")
  const taskTeams =
    general && can(context, "workers.manage")
      ? (await listTeams(context)).map((team) => ({ code: team.code, name: team.name }))
      : []
  const taskStandards =
    general && can(context, "settings.manage")
      ? standardsForGroups(context.organisationRegistrationGroups).map((standard) => ({
          code: standard.code,
          name: standard.name,
        }))
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
          "If the customer drops a staff list or certificates, talk through who will be added and which files will be filed. Do not say those records are in until the customer says they added them.",
          "Drafts do not count. If the snapshot does not say, say it is not in this snapshot.",
          taskAllowed.length > 0
            ? "When asked to add a worker, file a policy, or check pending documents, call propose_task once. Nothing is saved until they press Confirm. Do not say the change is done."
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
          if (!isAuditRating(rating) || turn.kind !== "interview") return { proposed: false }
          return { proposed: true, rating, summary }
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
            if (!claimVisual()) return { shown: false, reason: "This reply already shows one view." }
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
          description: proposeTaskDescription(taskAllowed, taskTeams, taskStandards),
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

  const messages = recentMessages(
    incoming,
    interview || audit ? interviewHistoryLimit : assistantHistoryLimit,
    interview || audit ? 2000 : 800
  )
  let tools: ToolSet | undefined
  if (assessment) tools = { record_assessment: assessment }
  else if (finding) tools = { record_finding: finding }
  else if (proposeTask || showSnapshot || showRecords || draftPolicy) {
    tools = {
      ...(proposeTask ? { propose_task: proposeTask } : {}),
      ...(showSnapshot ? { show_snapshot: showSnapshot } : {}),
      ...(showRecords ? { show_records: showRecords } : {}),
      ...(draftPolicy ? { draft_policy: draftPolicy } : {}),
    }
  }
  const replyTokens = draftPolicy
    ? policyReplyTokens
    : tools
      ? interviewReplyTokens
      : assistantReplyTokens
  const result = streamText({
    model: assistantModel,
    maxOutputTokens: replyTokens,
    ...(tools ? { stopWhen: isStepCount(general ? 5 : 4) } : {}),
    tools,
    experimental_transform: smoothStream({ delayInMs: 45, chunking: "word" }),
    instructions,
    messages: await convertToModelMessages(messages, {
      tools,
      ignoreIncompleteToolCalls: true,
    }),
    onFinish: (event) => {
      if (!meterTrial) return
      const tokens = (event.usage.inputTokens ?? 0) + (event.usage.outputTokens ?? 0)
      void recordAssistantTokens(context.organisationId, tokens).catch((error: unknown) => {
        console.error("assistant usage", error)
      })
    },
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => assistantErrorText(error),
    }),
  })
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
    lines.push("review_documents checks pending worker documents. Pass only kind.")
  }
  if (allowed.includes("add_worker")) {
    const names = teams.map((team) => `${team.name} (${team.code})`).join(", ")
    lines.push(`add_worker adds one worker. team must be one of: ${names}.`)
  }
  if (allowed.includes("file_policy")) {
    const names = standards.map((standard) => `${standard.code} (${standard.name})`).join("; ")
    lines.push(
      `file_policy saves one policy draft. standardCode must be one of: ${names}. Include the full policy.`
    )
  }
  return lines.join(" ")
}
