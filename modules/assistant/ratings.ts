import { isAuditRating, type AuditRating } from "@/modules/internal-audits/rating"

export type AssistantRatingStatus = "pending" | "done" | "cancelled"

export type AssistantRatingProposal = {
  id: string
  rating: AuditRating
  summary: string
  status: AssistantRatingStatus
  result?: string
}

export function ratingsFromParts(parts: readonly unknown[]) {
  const ratings: { id: string; rating: AuditRating; summary: string }[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-record_assessment" || record.state !== "output-available") continue
    const output = record.output
    if (!output || typeof output !== "object") continue
    const row = output as Record<string, unknown>
    if (row.proposed !== true || !isAuditRating(row.rating)) continue
    if (typeof row.summary !== "string" || !row.summary.trim()) continue
    const id = typeof record.toolCallId === "string" ? record.toolCallId : ""
    if (!id) continue
    ratings.push({ id, rating: row.rating, summary: row.summary.trim().slice(0, 2000) })
  }
  return ratings
}

export function applyRatingOutcomes(
  current: readonly { id: string; rating: AuditRating; summary: string }[],
  earlier: readonly AssistantRatingProposal[] | undefined,
  outcomes: Readonly<Record<string, { status: "done" | "cancelled"; result: string }>>
) {
  const source =
    current.length > 0
      ? current
      : (earlier ?? []).filter((item) => item.status === "pending")
  const ratings: AssistantRatingProposal[] = []
  for (const item of source) {
    const outcome = outcomes[item.id]
    const stored = earlier?.find((row) => row.id === item.id)
    ratings.push({
      id: item.id,
      rating: item.rating,
      summary: item.summary,
      status: outcome?.status ?? stored?.status ?? "pending",
      result: outcome?.result ?? stored?.result,
    })
  }
  if (current.length === 0 && earlier) {
    for (const item of earlier) {
      if (item.status === "pending") continue
      if (ratings.some((row) => row.id === item.id)) continue
      ratings.push(item)
    }
  }
  return ratings
}

export function parseRatingProposal(value: unknown): AssistantRatingProposal | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== "string" || !isAuditRating(record.rating)) return null
  if (typeof record.summary !== "string" || !record.summary.trim()) return null
  if (record.status !== "pending" && record.status !== "done" && record.status !== "cancelled") {
    return null
  }
  return {
    id: record.id,
    rating: record.rating,
    summary: record.summary.trim().slice(0, 2000),
    status: record.status,
    ...(typeof record.result === "string" ? { result: record.result.slice(0, 240) } : {}),
  }
}
