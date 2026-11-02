import { addDays, format, startOfDay } from "date-fns"

export function isReminderDue(
  expiresOn: string,
  today: Date,
  daysBefore: number
) {
  const start = format(startOfDay(today), "yyyy-MM-dd")
  const end = format(addDays(startOfDay(today), daysBefore), "yyyy-MM-dd")
  return expiresOn >= start && expiresOn <= end
}

type RenewableDocument = {
  worker_id: string
  document_type_version_id: string
  expires_on: string | null
}

export function hasRenewal(
  document: RenewableDocument,
  others: RenewableDocument[]
) {
  return others.some(
    (other) =>
      other.worker_id === document.worker_id &&
      other.document_type_version_id === document.document_type_version_id &&
      !!other.expires_on &&
      !!document.expires_on &&
      other.expires_on > document.expires_on
  )
}
