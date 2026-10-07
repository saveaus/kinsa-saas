export const policyDocxType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export const policyAttachmentAccept = [
  "application/pdf",
  policyDocxType,
  "image/jpeg",
  "image/png",
].join(",")

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  policyDocxType,
])

export function policyAttachmentType(file: { type: string; name: string }) {
  if (allowedTypes.has(file.type)) return file.type
  if (file.name.toLowerCase().endsWith(".docx")) return policyDocxType
  return null
}
