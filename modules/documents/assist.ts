import { generateText, Output } from "ai"
import { z } from "zod"

import { createAdminSupabase, hasAdminClient } from "@/lib/supabase/admin"
import { recordAudit } from "@/modules/audit/write"
import { assistantModel, assistantTemperature } from "@/modules/assistant/model"
import { claimAssistantTrialTokens, loadAssistantAllowance } from "@/modules/assistant/usage"
import {
  assistantDocumentDecision,
  type DocumentDecision,
  type DocumentRead,
} from "@/modules/documents/assist-decision"

const readSchema = z.object({
  readable: z.boolean(),
  typeMatches: z.boolean(),
  nameMatches: z.boolean(),
  confident: z.boolean(),
  expirySeen: z.enum(["future", "past", "missing", "none"]),
  note: z.string().max(400),
})

const reviewLimit = 8

export type DocumentReviewResult = {
  decision: DocumentDecision | "skipped"
  note: string | null
}

type PendingDocument = {
  id: string
  storage_path: string
  original_filename: string
  mime_type: string
  expires_on: string | null
  workers: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  document_type_versions: { name: string; requires_expiry: boolean } | { name: string; requires_expiry: boolean }[] | null
}

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function assistantReady() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) && hasAdminClient()
}

export async function reviewUploadedDocument(organisationId: string, documentId: string) {
  const reviewed = await reviewDocuments(organisationId, [documentId])
  return reviewed[0] ?? { id: documentId, decision: "skipped" as const, note: null, worker: "", type: "" }
}

export async function reviewPendingDocuments(organisationId: string) {
  if (!assistantReady()) return []
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("documents")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("approval_status", "pending")
    .order("created_at")
    .limit(reviewLimit)
  if (error) throw new Error(error.message)
  return reviewDocuments(
    organisationId,
    (data ?? []).map((row) => row.id)
  )
}

async function reviewDocuments(organisationId: string, documentIds: string[]) {
  if (documentIds.length === 0 || !assistantReady()) return []
  const allowance = await loadAssistantAllowance(organisationId)
  if (allowance.kind === "spent" || allowance.kind === "ended") return []

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("documents")
    .select(
      "id, storage_path, original_filename, mime_type, expires_on, workers(first_name, last_name), document_type_versions(name, requires_expiry)"
    )
    .eq("organisation_id", organisationId)
    .eq("approval_status", "pending")
    .in("id", documentIds)
  if (error) throw new Error(error.message)

  const documents = (data ?? []) as unknown as PendingDocument[]
  const results = []
  for (const document of documents) {
    const meter = allowance.kind === "trial" || allowance.kind === "included" ? allowance.kind : "open"
    results.push(await reviewOne(organisationId, document, meter))
  }
  return results
}

async function reviewOne(
  organisationId: string,
  document: PendingDocument,
  meter: "trial" | "included" | "open"
) {
  const worker = one(document.workers)
  const type = one(document.document_type_versions)
  const workerName = worker ? `${worker.first_name} ${worker.last_name}` : "the worker"
  const typeName = type?.name ?? "the selected type"
  const base = { id: document.id, worker: workerName, type: typeName }

  try {
    const read = await readDocument({
      organisationId,
      document,
      workerName,
      typeName,
      requiresExpiry: type?.requires_expiry ?? false,
      meter,
    })
    const decision = assistantDocumentDecision({
      read,
      requiresExpiry: type?.requires_expiry ?? false,
      expiresOn: document.expires_on,
      today: today(),
    })
    await saveDecision(organisationId, document.id, decision)
    return { ...base, decision: "flag" as const, note: decision.note }
  } catch (error) {
    console.error("document review", error)
    return { ...base, decision: "skipped" as const, note: null }
  }
}

async function readDocument(input: {
  organisationId: string
  document: PendingDocument
  workerName: string
  typeName: string
  requiresExpiry: boolean
  meter: "trial" | "included" | "open"
}): Promise<DocumentRead> {
  const admin = createAdminSupabase()
  const downloaded = await admin.storage.from("worker-documents").download(input.document.storage_path)
  if (downloaded.error || !downloaded.data) {
    return {
      readable: false,
      typeMatches: false,
      nameMatches: false,
      confident: false,
      expirySeen: "missing",
      note: "The file could not be opened. A person needs to check it.",
    }
  }

  const bytes = new Uint8Array(await downloaded.data.arrayBuffer())
  if (input.meter === "trial" && bytes.length > 1_500_000) {
    return {
      readable: false,
      typeMatches: false,
      nameMatches: false,
      confident: false,
      expirySeen: "missing",
      note: "This file is too large for the trial assistant. A person needs to check it.",
    }
  }
  if (input.meter === "trial" || input.meter === "included") {
    const granted = await claimAssistantTrialTokens(input.organisationId, 4_000)
    if (granted <= 0) {
      return {
        readable: false,
        typeMatches: false,
        nameMatches: false,
        confident: false,
        expirySeen: "missing",
        note:
          input.meter === "trial"
            ? "The trial assistant allowance is used. A person needs to check this file."
            : "This month's assistant allowance is used. A person needs to check this file.",
      }
    }
  }
  const expiry = input.document.expires_on ?? "none entered"
  const result = await generateText({
    model: assistantModel,
    temperature: assistantTemperature,
    maxOutputTokens: 300,
    output: Output.object({ schema: readSchema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `Today is ${today()}.`,
              `Worker: ${input.workerName}.`,
              `Document type: ${input.typeName}.`,
              `Expiry entered on the record: ${expiry}.`,
              input.requiresExpiry
                ? "This document type needs a current expiry."
                : "This document type does not need an expiry.",
              "Read the file. Approve only when you can read it, it is that document for that worker, and you are confident.",
              "If you are unsure, set confident to false. The note is one sentence for the person who may have to check it.",
            ].join("\n"),
          },
          {
            type: "file",
            data: bytes,
            mediaType: input.document.mime_type,
            filename: input.document.original_filename,
          },
        ],
      },
    ],
  })

  if (!result.output) {
    return {
      readable: false,
      typeMatches: false,
      nameMatches: false,
      confident: false,
      expirySeen: "missing",
      note: "The assistant could not read this file. A person needs to check it.",
    }
  }
  return result.output
}

async function saveDecision(
  organisationId: string,
  documentId: string,
  decision: { decision: DocumentDecision; note: string }
) {
  const admin = createAdminSupabase()
  switch (decision.decision) {
    case "approve": {
      const { error } = await admin
        .from("documents")
        .update({
          flagged: true,
          review_note: decision.note,
        })
        .eq("id", documentId)
        .eq("organisation_id", organisationId)
        .eq("approval_status", "pending")
      if (error) throw new Error(error.message)
      await recordAudit("document.flagged", "document", documentId, {
        source: "assistant",
        note: decision.note,
      })
      return
    }
    case "flag": {
      const { error } = await admin
        .from("documents")
        .update({
          flagged: true,
          review_note: decision.note,
        })
        .eq("id", documentId)
        .eq("organisation_id", organisationId)
        .eq("approval_status", "pending")
      if (error) throw new Error(error.message)
      await recordAudit("document.flagged", "document", documentId, { note: decision.note })
      return
    }
    default: {
      const unreachable: never = decision.decision
      return unreachable
    }
  }
}
