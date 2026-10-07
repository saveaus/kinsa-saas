import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
  type ToolSet,
  type UIMessage,
} from "ai"
import { z } from "zod"

import { can, getTenantContext } from "@/lib/tenant"
import { assistantAllowanceMessage } from "@/modules/assistant/allowance"
import { assistantSnapshot } from "@/modules/assistant/context"
import { loadAssistantAllowance, recordAssistantTokens } from "@/modules/assistant/usage"
import {
  assistantHistoryLimit,
  assistantModel,
  assistantReplyTokens,
  interviewHistoryLimit,
  interviewReplyTokens,
} from "@/modules/assistant/model"
import { canConductInternalAudit } from "@/modules/internal-audits/access"
import { reviewPendingDocuments } from "@/modules/documents/assist"
import { conductInstructions, externalAuditKind, parseAuditFinding } from "@/modules/internal-audits/conduct"
import { interviewTurn } from "@/modules/internal-audits/queries"
import { writeAssessment } from "@/modules/internal-audits/rate"
import { isAuditRating } from "@/modules/internal-audits/rating"

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
  return "The assistant could not answer. Try again."
}

function recentMessages(messages: UIMessage[], limit: number, textLimit: number) {
  return messages.slice(-limit).map((message) => ({
    ...message,
    parts: message.parts.map((part) =>
      part.type === "text" ? { ...part, text: part.text.slice(0, textLimit) } : part
    ),
  }))
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
  const canReviewDocuments = can(context, "documents.approve")
  const instructions = interview
    ? turn.instructions
    : audit
      ? [
          conductInstructions(externalAuditKind(context.organisationRegistrationGroups)),
          "",
          await assistantSnapshot(context),
        ].join("\n")
      : [
          "You are Kinsa's compliance assistant for an Australian NDIS provider.",
          "Answer in a few short sentences, unless asked to draft a policy.",
          "When asked to generate a policy, write the draft. Say it is a draft and has not been filed.",
          "Use only the snapshot for facts about this organisation. Do not invent records or guarantee an audit pass.",
          "If the customer drops a staff list or certificates, talk through who will be added and which files will be filed. Do not say those records are in until the customer says they added them.",
          "Drafts do not count. If the snapshot does not say, say it is not in this snapshot.",
          canReviewDocuments
            ? "When asked to check worker documents, call review_documents. Approve only through that tool. Flag a document for a person instead of rejecting it."
            : "",
          "",
          await assistantSnapshot(context),
        ]
          .filter(Boolean)
          .join("\n")
  const assessment = interview
    ? tool({
        description:
          "Record the rating for this criterion once the interview has covered policy, practice, responsibility, and evidence.",
        inputSchema: z.object({
          rating: z.enum(["met", "partial", "not_met"]),
          summary: z.string().min(1).max(2000),
        }),
        execute: async ({ rating, summary }) => {
          if (!isAuditRating(rating) || turn.kind !== "interview") return { saved: false }
          const result = await writeAssessment(context, turn.assignmentId, {
            rating,
            source: "assistant",
            summary,
          })
          if (result.error) return { saved: false, reason: result.error }
          return { saved: true }
        },
      })
    : null
  const finding = audit
    ? tool({
        description:
          "Record one internal audit finding once the area has enough evidence: what is happening, the next action, who does it, and how completion will be checked.",
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
          if (!recorded) return { recorded: false }
          return { recorded: true, ...recorded }
        },
      })
    : null

  const reviewDocuments =
    !interview && !audit && canReviewDocuments
      ? tool({
          description:
            "Check pending worker documents. Approve a file when it matches the worker, the document type, and a current expiry. Flag the rest for a person in Approvals. Do not reject.",
          inputSchema: z.object({}),
          execute: async () => {
            const reviewed = await reviewPendingDocuments(context.organisationId)
            const approved = reviewed.filter((item) => item.decision === "approve")
            const flagged = reviewed.filter((item) => item.decision === "flag")
            return {
              approved: approved.length,
              flagged: flagged.length,
              flaggedFor: flagged.map((item) => `${item.worker} — ${item.type}: ${item.note}`),
            }
          },
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
  else if (reviewDocuments) tools = { review_documents: reviewDocuments }
  const result = streamText({
    model: assistantModel,
    maxOutputTokens: interview || audit || reviewDocuments ? interviewReplyTokens : assistantReplyTokens,
    ...(interview || audit || reviewDocuments ? { stopWhen: isStepCount(4) } : {}),
    tools,
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
