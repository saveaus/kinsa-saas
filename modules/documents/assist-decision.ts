import type { DocumentApprovalStatus } from "@/lib/database.types"

export type DocumentRead = {
  readable: boolean
  typeMatches: boolean
  nameMatches: boolean
  confident: boolean
  expirySeen: "future" | "past" | "missing" | "none"
  note: string
}

export type DocumentDecision = "approve" | "flag"

export function assistantDocumentDecision(input: {
  read: DocumentRead
  requiresExpiry: boolean
  expiresOn: string | null
  today: string
}): { decision: DocumentDecision; note: string } {
  const note = input.read.note.trim() || "A person needs to check this document."
  const { read } = input
  if (!read.readable || !read.typeMatches || !read.nameMatches || !read.confident) {
    return { decision: "flag", note }
  }
  if (read.expirySeen === "past" || read.expirySeen === "missing") {
    return { decision: "flag", note }
  }
  if (input.requiresExpiry && (!input.expiresOn || input.expiresOn < input.today)) {
    return { decision: "flag", note }
  }
  return {
    decision: "approve",
    note: "The assistant checked the name, the document type, and the expiry.",
  }
}

export function documentReviewLabel(status: DocumentApprovalStatus, flagged: boolean) {
  switch (status) {
    case "approved":
      return "Approved"
    case "rejected":
      return "Rejected"
    case "pending":
      return flagged ? "Needs a person" : "Pending"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

export function documentReviewTone(status: DocumentApprovalStatus, flagged: boolean) {
  switch (status) {
    case "approved":
      return "green" as const
    case "rejected":
      return "red" as const
    case "pending":
      return flagged ? ("yellow" as const) : ("orange" as const)
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}
