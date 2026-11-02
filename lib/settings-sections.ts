export type SettingsGroup = "Account" | "Organisation"

export type SettingsSection = {
  href: string
  label: string
  group: SettingsGroup
  /** Account is available to every signed-in person. Organisation is for administrators. */
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
    href: "/settings/teams",
    label: "Teams",
    group: "Organisation",
    audience: "admin",
    description: "Create, rename, and delete worker teams.",
  },
  {
    href: "/settings/permissions",
    label: "Permissions",
    group: "Organisation",
    audience: "admin",
    description: "Choose what people on each team can do.",
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
]

export const settingsGroups: SettingsGroup[] = ["Account", "Organisation"]
