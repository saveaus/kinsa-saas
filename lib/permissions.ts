import type { AppPermission, AppRole } from "@/lib/database.types"

export type { AppPermission, AppRole }

export const ALL_PERMISSIONS: AppPermission[] = [
  "workers.manage",
  "workers.read_all",
  "documents.approve",
  "documents.upload_own",
  "documents.read_all",
  "courses.manage",
  "courses.take",
  "reminders.manage",
  "reports.export",
  "audit.read",
  "settings.manage",
]

export function hasPermission(
  permissions: AppPermission[],
  required: AppPermission | AppPermission[]
) {
  const needed = Array.isArray(required) ? required : [required]
  return needed.every((permission) => permissions.includes(permission))
}
