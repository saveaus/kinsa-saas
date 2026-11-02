import { inflateRawSync } from "node:zlib"

export const complianceNoteLimit = 400
export const policyTextLimit = 12000
const documentXmlLimit = 32 * 1024 * 1024

export type PolicyComplianceRead = {
  current: boolean
  gaps: string[]
}

export type PolicyComplianceResult = {
  flagged: boolean
  note: string | null
}

const unreadNote = "The file could not be read against the current standard."
const fallbackNote = "It does not meet the current practice standard."

export function policyComplianceDecision(
  read: PolicyComplianceRead | null
): PolicyComplianceResult {
  if (!read || read.current) return { flagged: false, note: null }
  const note = read.gaps
    .map((gap) => gap.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
  return {
    flagged: true,
    note: (note || fallbackNote).slice(0, complianceNoteLimit),
  }
}

export function unreadPolicyCompliance(): PolicyComplianceResult {
  return { flagged: true, note: unreadNote }
}

export function docxPlainText(bytes: Uint8Array) {
  const xml = zipEntry(bytes, "word/document.xml")
  if (!xml) return ""
  return xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, policyTextLimit)
}

function zipEntry(bytes: Uint8Array, name: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break
    const method = view.getUint16(offset + 8, true)
    const compressed = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const start = offset + 30
    const entryName = new TextDecoder().decode(
      bytes.subarray(start, start + nameLength)
    )
    const dataStart = start + nameLength + extraLength
    const dataEnd = dataStart + compressed
    if (dataEnd > bytes.length) return null
    if (entryName === name) {
      const data = bytes.subarray(dataStart, dataEnd)
      if (method === 0) return new TextDecoder().decode(data)
      if (method === 8) {
        return new TextDecoder().decode(
          inflateRawSync(data, { maxOutputLength: documentXmlLimit })
        )
      }
      return null
    }
    offset = dataEnd
  }
  return null
}
