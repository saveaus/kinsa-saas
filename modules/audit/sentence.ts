const verbs: Record<string, string> = {
  "document.approved": "approved a document",
  "document.rejected": "rejected a document",
  "document.uploaded": "uploaded a document",
  "document.viewed": "viewed a document",
  "document_roles.updated": "updated credential roles",
  "worker.created": "added a worker",
  "worker.updated": "updated a worker",
  "worker.deleted": "deleted a worker",
  "worker.invited": "invited a worker",
  "reminder.sent": "sent a reminder",
  "reminder_rule.created": "created a reminder rule",
  "reminder_rule.updated": "updated a reminder rule",
  "reminder_rule.deleted": "deleted a reminder rule",
  "course.created": "created a course",
  "course.updated": "updated a course",
  "course.settings_updated": "updated course settings",
  "enrolment.created": "enrolled a worker",
  "completion.recorded": "recorded a course result",
  "completion.attempts_reset": "reset exam attempts",
  "certificate.downloaded": "downloaded a certificate",
  "report.exported": "exported evidence",
  "organisation.logo_updated": "updated the organisation logo",
  "organisation.logo_removed": "removed the organisation logo",
  "organisation.identity_updated": "updated business details",
  "admin.invited": "invited an administrator",
}

const workerVerbs: Record<string, string> = {
  ...verbs,
  "worker.created": "added this worker",
  "worker.updated": "updated this worker",
  "worker.deleted": "deleted this worker",
  "worker.invited": "invited this worker",
  "report.exported": "exported this record",
}

export function auditSentence(action: string, targetType: string, scope: "org" | "worker" = "org") {
  const map = scope === "worker" ? workerVerbs : verbs
  return map[action] ?? `${action.replaceAll(/[._]/g, " ")} on ${targetType.replaceAll("_", " ")}`
}
