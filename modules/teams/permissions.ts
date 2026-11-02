import type { AppPermission } from "@/lib/database.types"
import { ALL_PERMISSIONS } from "@/lib/permissions"

export const permissionGroups: {
  label: string
  items: { permission: AppPermission; label: string; description: string }[]
}[] = [
  {
    label: "Workforce",
    items: [
      {
        permission: "workers.manage",
        label: "Add and edit workers",
        description: "Create records, change details, and remove people.",
      },
      {
        permission: "workers.read_all",
        label: "See every worker",
        description: "Open the workforce list and other people's records.",
      },
    ],
  },
  {
    label: "Documents",
    items: [
      {
        permission: "documents.upload_own",
        label: "Upload their own documents",
        description: "Add files to their own record.",
      },
      {
        permission: "documents.read_all",
        label: "See every document",
        description: "Open documents across the organisation.",
      },
      {
        permission: "documents.approve",
        label: "Approve documents",
        description: "Accept or reject uploaded evidence.",
      },
    ],
  },
  {
    label: "Organisation",
    items: [
      {
        permission: "reminders.manage",
        label: "Manage automatic emails",
        description: "Change follow-up emails.",
      },
      {
        permission: "reports.export",
        label: "Export evidence packs",
        description: "Download organisation and activity exports.",
      },
      {
        permission: "audit.read",
        label: "Read the activity log",
        description: "See what people have done.",
      },
      {
        permission: "settings.manage",
        label: "Manage settings",
        description: "Change organisation settings, teams, and credentials.",
      },
    ],
  },
]

const permissionSet = new Set<string>(ALL_PERMISSIONS)

export function listedPermissions() {
  return permissionGroups.flatMap((group) =>
    group.items.map((item) => item.permission)
  )
}

export function parseTeamPermissions(formData: FormData) {
  const selected = new Set<AppPermission>()
  for (const value of formData.getAll("permissions")) {
    const permission = String(value)
    if (permissionSet.has(permission)) selected.add(permission as AppPermission)
  }
  return ALL_PERMISSIONS.filter((permission) => selected.has(permission))
}
