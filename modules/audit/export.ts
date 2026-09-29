import { format } from "date-fns"

import type { Database } from "@/lib/database.types"
import { auditSentence } from "@/modules/audit/sentence"

type AuditEvent = Database["public"]["Tables"]["audit_events"]["Row"]

function csvCell(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`
  }
  return value
}

export function activityCsv(events: AuditEvent[]) {
  const header = ["When", "Actor", "Event", "Action", "Target type", "Target id"]
  const lines = events.map((event) => {
    const actor = event.actor_role ?? "system"
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
