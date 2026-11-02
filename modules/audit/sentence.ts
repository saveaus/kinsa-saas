const verbs: Record<string, string> = {
  "document.approved": "approved a document",
  "document.flagged": "flagged a document for a person to check",
  "document.rejected": "rejected a document",
  "document.pending": "returned a document to pending",
  "document.uploaded": "uploaded a document",
  "document.viewed": "viewed a document",
  "document_roles.updated": "updated credential roles",
  "worker.created": "added a worker",
  "note.added": "added a note",
  "note.updated": "updated a note",
  "note.removed": "removed a note",
  "task.created": "assigned a task",
  "task.completed": "completed a task",
  "task.reopened": "reopened a task",
  "worker.updated": "updated a worker",
  "worker.deleted": "deleted a worker",
  "worker.invited": "invited a worker",
  "reminder.sent": "sent a reminder",
  "reminder.failed": "could not send a reminder",
  "reminder_rule.created": "created a reminder rule",
  "reminder_rule.updated": "updated a reminder rule",
  "reminder_rule.deleted": "deleted a reminder rule",
  "report.exported": "exported evidence",
  "activity.exported": "exported activity",
  "organisation.logo_updated": "updated the organisation logo",
  "organisation.logo_removed": "removed the organisation logo",
  "organisation.identity_updated": "updated business details",
  "organisation.registration_groups_updated": "updated registration groups",
  "billing.updated": "updated billing",
  "team.created": "created a team",
  "team.updated": "updated a team",
  "team.deleted": "removed a team",
  "admin.invited": "invited an administrator",
  "policy.drafted": "saved a policy draft",
  "policy.accepted": "accepted a policy",
  "policy.acknowledged": "acknowledged a policy",
  "policy.draft_removed": "removed a policy draft",
  "policy.viewed": "viewed a policy",
  "policy.moved": "moved a policy into a file",
  "policy.flagged": "flagged a policy that does not meet the current standard",
  "policy_file.created": "added a policy file",
  "policy_file.renamed": "renamed a policy file",
  "policy_file.removed": "removed a policy file",
  "participant.added": "added a participant",
  "participant.updated": "updated a participant",
  "participant.removed": "removed a participant",
  "service_agreement.drafted": "saved a service agreement draft",
  "service_agreement.accepted": "accepted a service agreement",
  "service_agreement.draft_removed": "removed a service agreement draft",
  "service_agreement.viewed": "viewed a service agreement",
  "support_plan.drafted": "saved a support plan draft",
  "support_plan.accepted": "accepted a support plan",
  "support_plan.draft_removed": "removed a support plan draft",
  "support_plan.viewed": "viewed a support plan",
  "incident.drafted": "saved an incident draft",
  "incident.accepted": "accepted an incident",
  "incident.draft_removed": "removed an incident draft",
  "incident.viewed": "viewed an incident",
  "complaint.drafted": "saved a complaint draft",
  "complaint.accepted": "accepted a complaint",
  "complaint.draft_removed": "removed a complaint draft",
  "complaint.viewed": "viewed a complaint",
  "risk.drafted": "saved a risk draft",
  "risk.accepted": "accepted a risk",
  "risk.draft_removed": "removed a risk draft",
  "risk.viewed": "viewed a risk",
  "restrictive_practice.drafted": "saved a restrictive practice draft",
  "restrictive_practice.accepted": "accepted a restrictive practice",
  "restrictive_practice.draft_removed": "removed a restrictive practice draft",
  "restrictive_practice.viewed": "viewed a restrictive practice",
  "support_plan_check.drafted": "saved a support plan check draft",
  "support_plan_check.accepted": "accepted a support plan check",
  "support_plan_check.draft_removed": "removed a support plan check draft",
  "support_plan_check.viewed": "viewed a support plan check",
  "log.created": "added a log",
  "log.removed": "removed a log",
  "log.visibility_updated": "updated which logs are shown",
  "log.drafted": "saved a log draft",
  "log.accepted": "accepted a log entry",
  "log.draft_removed": "removed a log draft",
  "log.viewed": "viewed a log entry",
}

const workerVerbs: Record<string, string> = {
  ...verbs,
  "worker.created": "added this worker",
  "worker.updated": "updated this worker",
  "worker.deleted": "deleted this worker",
  "worker.invited": "invited this worker",
  "report.exported": "exported this record",
}

function assistantChecked(metadata: unknown) {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    "source" in metadata &&
    metadata.source === "assistant"
  )
}

function inviteWasNotEmailed(metadata: unknown) {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    "emailed" in metadata &&
    metadata.emailed === false
  )
}

export function auditSentence(
  action: string,
  targetType: string,
  scope: "org" | "worker" = "org",
  metadata?: unknown
) {
  if (action === "document.approved" && assistantChecked(metadata)) {
    return "had the assistant approve a document"
  }
  if (action === "document.flagged") {
    return "had the assistant flag a document for a person to check"
  }
  if (action === "task.created" && assistantChecked(metadata)) {
    return "had the assistant assign a task"
  }
  if (action === "worker.invited" && inviteWasNotEmailed(metadata)) {
    return scope === "worker"
      ? "saved an invite for this worker, but the email was not sent"
      : "saved an invite, but the email was not sent"
  }
  const map = scope === "worker" ? workerVerbs : verbs
  return (
    map[action] ??
    `${action.replaceAll(/[._]/g, " ")} on ${targetType.replaceAll("_", " ")}`
  )
}
