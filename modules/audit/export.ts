import { format } from "date-fns"

import { auditSentence } from "@/modules/audit/sentence"
import type { NamedAuditEvent } from "@/modules/audit/queries"

function csvCell(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`
  }
  return value
}

export function activityCsv(events: NamedAuditEvent[]) {
  const header = ["When", "Actor", "Event", "Action", "Target type", "Target id"]
  const lines = events.map((event) => {
    const actor = event.actorName
    return [
      format(new Date(event.created_at), "yyyy-MM-dd HH:mm:ss"),
      actor,
      `${actor} ${auditSentence(event.action, event.target_type)}`,
      event.action,
      event.target_type,
      event.target_id ?? "",
    ]
      .map(csvCell)
      .join(",")
  })
  return [header.join(","), ...lines].join("\n")
}
