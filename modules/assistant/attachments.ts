export const attachmentCountLimit = 8
export const attachmentByteLimit = 3 * 1024 * 1024
export const attachmentTotalLimit = 8 * 1024 * 1024

export type AssistantAttachment = {
  name: string
  mediaType: string
  url?: string
}

const imageUrlLimit = 500_000

const pastedTextPattern = /^Pasted text( \d+)?\.txt$/i

export function pasteAsAttachment(text: string) {
  const normalised = text.replace(/\r\n/g, "\n").trim()
  if (!normalised) return false
  if (normalised.length >= 1200) return true
  return normalised.split("\n").length >= 10
}

export function pastedTextName(existing: readonly string[]) {
  const taken = new Set(existing)
  let name = "Pasted text.txt"
  let count = 2
  while (taken.has(name)) {
    name = `Pasted text ${count}.txt`
    count += 1
  }
  return name
}

export function isPastedTextName(name: string) {
  return pastedTextPattern.test(name)
}

export function acceptAttachments(
  current: readonly { size: number }[],
  incoming: readonly { name: string; size: number }[]
) {
  const accepted: number[] = []
  const rejected: string[] = []
  let count = current.length
  let total = current.reduce((sum, file) => sum + file.size, 0)
  for (const [index, file] of incoming.entries()) {
    const name = file.name.trim() || "A file"
    if (file.size <= 0) {
      rejected.push(`${name} is empty.`)
      continue
    }
    if (file.size > attachmentByteLimit) {
      rejected.push(`${name} is over 3 MB.`)
      continue
    }
    if (count >= attachmentCountLimit) {
      rejected.push("You can attach up to 8 files.")
      break
    }
    if (total + file.size > attachmentTotalLimit) {
      rejected.push("Those files are over 8 MB together.")
      break
    }
    accepted.push(index)
    count += 1
    total += file.size
  }
  return { accepted, rejected }
}

export function attachmentLabel(file: { name: string; mediaType: string; size: number }) {
  return `${attachmentKind(file)} · ${formatBytes(file.size)}`
}

export function attachmentsFromParts(parts: readonly unknown[]) {
  const files: AssistantAttachment[] = []
  for (const part of parts) {
    const file = parseAttachmentPart(part)
    if (!file) continue
    files.push(file)
    if (files.length >= attachmentCountLimit) break
  }
  return files
}

export function parseAttachment(value: unknown): AssistantAttachment | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const name = clean(record.name, 160)
  const mediaType = clean(record.mediaType, 80)
  if (!name || !mediaType) return null
  const url = imageUrl(record.url, mediaType)
  return url ? { name, mediaType, url } : { name, mediaType }
}

function parseAttachmentPart(value: unknown): AssistantAttachment | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (record.type !== "file") return null
  const name = clean(record.filename, 160) || "Attachment"
  const mediaType = clean(record.mediaType, 80) || "application/octet-stream"
  const url = imageUrl(record.url, mediaType)
  return url ? { name, mediaType, url } : { name, mediaType }
}

function imageUrl(value: unknown, mediaType: string) {
  if (!mediaType.startsWith("image/") || typeof value !== "string") return undefined
  if (!value.startsWith("data:image/") || value.length > imageUrlLimit) return undefined
  return value
}

function attachmentKind(file: { name: string; mediaType: string }) {
  const name = file.name.toLowerCase()
  if (file.mediaType.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(name)) return "Image"
  if (file.mediaType === "application/pdf" || name.endsWith(".pdf")) return "PDF"
  if (file.mediaType.startsWith("text/") || /\.(txt|csv|tsv|md)$/.test(name)) return "Text"
  return "File"
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}
