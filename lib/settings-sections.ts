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
      "Business name, ABN, NDIS registration number, registration groups, and logo.",
  },
  {
    href: "/settings/roles",
    label: "Roles and permissions",
    group: "Organisation",
    audience: "admin",
    description: "Create teams and choose what each one can do.",
  },
  {
    href: "/settings/credentials",
    label: "Credentials",
    group: "Organisation",
    audience: "admin",
    description:
      "Choose a team, then turn on the documents that team must hold.",
  },
  {
    href: "/settings/billing",
    label: "Billing",
    group: "Organisation",
    audience: "admin",
    description:
      "Update your payment information or switch plans according to your needs.",
  },
  {
    href: "/settings/emails",
    label: "Automatic emails",
    group: "Notifications",
    audience: "admin",
    description: "Follow-up emails for documents.",
  },
]

export const settingsGroups: SettingsGroup[] = [
  "Account",
  "Organisation",
  "Notifications",
]
