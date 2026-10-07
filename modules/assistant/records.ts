import {
  packAreaLabel,
  packGaps,
  packStatusLabel,
  type PackItem,
  type PackStatus,
} from "@/modules/audit-pack/score"

export const recordAreas = [
  "policy",
  "clearance",
  "course",
  "support_plan",
  "service_agreement",
  "incident",
  "complaint",
  "risk",
  "restrictive_practice",
] as const

export type RecordArea = (typeof recordAreas)[number]

export type AssistantRecordItem = {
  label: string
  status: PackStatus
  detail: string
  href: string
}

export type AssistantRecordCard = {
  title: string
  items: AssistantRecordItem[]
  matched: number
}

export const recordCardLimit = 8

const labelLimit = 120
const detailLimit = 120

function toRecordItem(item: PackItem): AssistantRecordItem {
  return {
    label: item.label.slice(0, labelLimit),
    status: item.status,
    detail: item.detail.slice(0, detailLimit),
    href: item.href,
  }
}

function matchesQuery(item: PackItem, needle: string) {
  return (
    item.label.toLowerCase().includes(needle) ||
    item.detail.toLowerCase().includes(needle) ||
    packStatusLabel(item.status).toLowerCase().includes(needle)
  )
}

export function selectRecords(
  items: PackItem[],
  input: { area?: RecordArea; query?: string }
): AssistantRecordCard {
  const area = input.area
  const needle = input.query?.trim().toLowerCase() ?? ""
  const inArea = area ? items.filter((item) => item.area === area) : items
  let matched = packGaps(inArea)
  if (needle) {
    matched = matched.filter((item) => matchesQuery(item, needle))
    if (matched.length === 0) {
      matched = inArea.filter((item) => matchesQuery(item, needle))
    }
  }
  const title = needle
    ? `Records for “${input.query?.trim()}”`
    : area
      ? `Open ${packAreaLabel(area).toLowerCase()} items`
      : "Open items"
  return {
    title,
    items: matched.slice(0, recordCardLimit).map(toRecordItem),
    matched: matched.length,
  }
}

const recordStatuses = new Set<string>([
  "met",
  "lapsing",
  "missing",
  "overdue",
  "unaccepted",
])

function parseRecordItem(value: unknown): AssistantRecordItem | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const { label, status, detail, href } = record
  if (typeof label !== "string" || !label.trim()) return null
  if (typeof status !== "string" || !recordStatuses.has(status)) return null
  if (typeof detail !== "string") return null
  if (typeof href !== "string" || !href.startsWith("/")) return null
  return {
    label: label.trim().slice(0, labelLimit),
    status: status as PackStatus,
    detail: detail.trim().slice(0, detailLimit),
    href,
  }
}

export function parseRecordCard(value: unknown): AssistantRecordCard | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.title !== "string" || !record.title.trim()) return null
  if (!Array.isArray(record.items)) return null
  const items = record.items
    .flatMap((item) => {
      const parsed = parseRecordItem(item)
      return parsed ? [parsed] : []
    })
    .slice(0, recordCardLimit)
  const matched =
    typeof record.matched === "number" && Number.isFinite(record.matched)
      ? Math.max(items.length, Math.floor(record.matched))
      : items.length
  return { title: record.title.trim().slice(0, labelLimit), items, matched }
}

export function recordCardsFromParts(parts: readonly unknown[]) {
  const cards: AssistantRecordCard[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const record = part as Record<string, unknown>
    if (record.type !== "tool-show_records" || record.state !== "output-available") continue
    const card = parseRecordCard(record.output)
    if (card) cards.push(card)
  }
  return cards
}
