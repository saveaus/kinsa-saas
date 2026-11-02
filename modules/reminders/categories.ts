export const REMINDER_CATEGORIES = ["documents"] as const

export type ReminderCategory = (typeof REMINDER_CATEGORIES)[number]

export function reminderCategoryLabel(category: ReminderCategory) {
  switch (category) {
    case "documents":
      return "Documents"
    default: {
      const unreachable: never = category
      return unreachable
    }
  }
}

export function parseReminderCategory(value: string): ReminderCategory | null {
  switch (value) {
    case "documents":
      return value
    default:
      return null
  }
}
