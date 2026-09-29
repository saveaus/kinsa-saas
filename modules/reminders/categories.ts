export const REMINDER_CATEGORIES = ["documents", "courses"] as const

export type ReminderCategory = (typeof REMINDER_CATEGORIES)[number]

export function reminderCategoryLabel(category: ReminderCategory) {
  switch (category) {
    case "documents":
      return "Documents"
    case "courses":
      return "Courses"
    default: {
      const unreachable: never = category
      return unreachable
    }
  }
}

export function parseReminderCategory(value: string): ReminderCategory | null {
  switch (value) {
    case "documents":
    case "courses":
      return value
    default:
      return null
  }
}
