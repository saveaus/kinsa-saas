import type { UIMessage } from "ai"

const excerptLimit = 6000
const dataUrlLimit = 6_000_000
export const trialDataUrlLimit = 16_000
const imagePrompt = "Look at the attached image and say what you can see."

const imageTypes: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
}

export function expandAttachmentText(
  messages: UIMessage[],
  textLimit: number,
  fileLimit = dataUrlLimit
): UIMessage[] {
  return messages.map((message) => {
    const parts = message.parts.flatMap((part): UIMessage["parts"] => {
      if (part.type === "text") return [{ ...part, text: part.text.slice(0, textLimit) }]
      if (part.type !== "file") return [part]
      if (part.url.length > fileLimit) {
        const name = part.filename?.trim() || "A file"
        return [{ type: "text", text: `Attached file ${name} was too large to read.` }]
      }
      const image = imageMediaType(part.mediaType, part.url)
      if (image) return [{ ...part, mediaType: image }]
      const excerpt = textExcerpt(part.mediaType, part.filename, part.url)
      return excerpt ? [part, { type: "text", text: excerpt }] : [part]
    })
    const hasImage = parts.some((part) => part.type === "file" && part.mediaType.startsWith("image/"))
    const hasText = parts.some((part) => part.type === "text" && part.text.trim().length > 0)
    if (hasImage && !hasText) parts.push({ type: "text", text: imagePrompt })
    return { ...message, parts }
  })
}

export function imageMediaType(mediaType: string, url: string) {
  return canonicalImage(mediaType) ?? dataUrlImage(url) ?? sniffImage(url)
}

function canonicalImage(mediaType: string) {
  return imageTypes[mediaType.toLowerCase()] ?? null
}

function textExcerpt(mediaType: string, filename: string | undefined, url: string) {
  const name = filename?.trim() || "file"
  if (!isTextFile(mediaType, name)) return null
  const decoded = decodeDataUrl(url)
  if (!decoded) return null
  const text = decoded.replace(/\u0000/g, "").trim()
  if (!text) return null
  return `Attached file ${name}:\n${text.slice(0, excerptLimit)}`
}

function isTextFile(mediaType: string, name: string) {
  if (mediaType.startsWith("text/")) return true
  if (mediaType === "application/csv" || mediaType === "text/csv") return true
  return /\.(txt|csv|tsv|md)$/i.test(name)
}

function dataUrlImage(url: string) {
  if (!url.startsWith("data:")) return null
  const marker = url.indexOf(",")
  if (marker < 0) return null
  return canonicalImage(url.slice(5, marker).split(";")[0] ?? "")
}

function sniffImage(url: string) {
  const bytes = dataUrlBytes(url, 12)
  if (!bytes || bytes.length < 4) return null
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}

function dataUrlBytes(url: string, count: number) {
  if (!url.startsWith("data:")) return null
  const marker = url.indexOf(",")
  if (marker < 0) return null
  const meta = url.slice(5, marker)
  const body = url.slice(marker + 1)
  try {
    if (meta.includes("base64")) {
      return Buffer.from(body.slice(0, Math.ceil(count / 3) * 4), "base64").subarray(0, count)
    }
    return Buffer.from(decodeURIComponent(body).slice(0, count), "latin1")
  } catch {
    return null
  }
}

function decodeDataUrl(url: string) {
  if (!url.startsWith("data:")) return null
  const marker = url.indexOf(",")
  if (marker < 0) return null
  const meta = url.slice(5, marker)
  const body = url.slice(marker + 1)
  try {
    if (meta.includes("base64")) return Buffer.from(body, "base64").toString("utf8")
    return decodeURIComponent(body)
  } catch {
    return null
  }
}
