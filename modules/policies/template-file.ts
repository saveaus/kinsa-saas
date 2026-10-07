import path from "node:path"

import { policyTemplate } from "@/modules/policies/templates"

export function templateDocxPath(key: string) {
  const template = policyTemplate(key)
  if (!template) return null
  const directory = path.join(process.cwd(), "modules/policies/templates/files")
  const filePath = path.join(directory, `${template.key}.docx`)
  if (!filePath.startsWith(`${directory}${path.sep}`)) return null
  return { template, filePath }
}
