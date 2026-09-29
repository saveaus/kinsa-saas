export type SettingsSection = {
  href: string
  label: string
  group: "Organisation" | "Notifications"
  description: string
}

/** Add a section here when a feature needs organisation configuration. */
export const settingsSections: SettingsSection[] = [
  {
    href: "/settings/general",
    label: "General",
    group: "Organisation",
    description: "Business name, ABN, NDIS registration number, registration groups, and logo for certificates.",
  },
  {
    href: "/settings/courses",
    label: "Courses",
    group: "Organisation",
    description: "Pass marks, renewals, and which roles must complete each course.",
  },
  {
    href: "/settings/credentials",
    label: "Credentials",
    group: "Organisation",
    description: "Which documents each role must hold.",
  },
  {
    href: "/settings/emails",
    label: "Automatic emails",
    group: "Notifications",
    description: "Follow-up emails for documents and courses.",
  },
]

export const settingsGroups = ["Organisation", "Notifications"] as const
