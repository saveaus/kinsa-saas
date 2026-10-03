export type SettingsGroup = "Account" | "Organisation" | "Notifications"

export type SettingsSection = {
  href: string
  label: string
  group: SettingsGroup
  /** Account is available to every signed-in person. Organisation and notifications are for administrators. */
  audience: "everyone" | "admin"
  description: string
}

/** Add a section here when a feature needs organisation configuration. */
export const settingsSections: SettingsSection[] = [
  {
    href: "/settings/password",
    label: "Password",
    group: "Account",
    audience: "everyone",
    description: "Change the password for your sign-in.",
  },
  {
    href: "/settings/general",
    label: "General",
    group: "Organisation",
    audience: "admin",
    description:
      "Business name, ABN, NDIS registration number, registration groups, and logo for certificates.",
  },
  {
    href: "/settings/courses",
    label: "Courses",
    group: "Organisation",
    audience: "admin",
    description:
      "Pass marks, renewals, and which roles must complete each course.",
  },
  {
    href: "/settings/credentials",
    label: "Credentials",
    group: "Organisation",
    audience: "admin",
    description: "Which documents each role must hold.",
  },
  {
    href: "/settings/logs",
    label: "Logs",
    group: "Organisation",
    audience: "admin",
    description:
      "Show, hide, and add logs for the organisation or for one person.",
  },
  {
    href: "/settings/emails",
    label: "Automatic emails",
    group: "Notifications",
    audience: "admin",
    description: "Follow-up emails for documents and courses.",
  },
]

export const settingsGroups: SettingsGroup[] = [
  "Account",
  "Organisation",
  "Notifications",
]
