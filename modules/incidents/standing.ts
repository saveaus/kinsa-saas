export type IncidentKind =
  | "incident"
  | "complaint"
  | "risk"
  | "restrictive_practice"
export type IncidentStatus = "draft" | "accepted"
export type IncidentStanding = "draft" | "recorded"

export function incidentStanding(status: IncidentStatus): IncidentStanding {
  if (status !== "accepted") return "draft"
  return "recorded"
}

export function incidentKindLabel(kind: IncidentKind) {
  switch (kind) {
    case "incident":
      return "Incident"
    case "complaint":
      return "Complaint"
    case "risk":
      return "Risk"
    case "restrictive_practice":
      return "Restrictive practice"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function incidentRegisterTitle(kind: IncidentKind) {
  switch (kind) {
    case "incident":
      return "Incidents"
    case "complaint":
      return "Complaints"
    case "risk":
      return "Risks"
    case "restrictive_practice":
      return "Restrictive practices"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function incidentListPath(kind: IncidentKind) {
  switch (kind) {
    case "incident":
      return "/logs/incidents"
    case "complaint":
      return "/logs/complaints"
    case "risk":
      return "/logs/risks"
    case "restrictive_practice":
      return "/logs/restrictive-practices"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function incidentRequiresParticipant(kind: IncidentKind) {
  switch (kind) {
    case "incident":
    case "complaint":
    case "risk":
      return false
    case "restrictive_practice":
      return true
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function incidentAuditAction(
  kind: IncidentKind,
  event: "drafted" | "accepted" | "draft_removed" | "viewed"
) {
  switch (kind) {
    case "incident":
      return `incident.${event}` as const
    case "complaint":
      return `complaint.${event}` as const
    case "risk":
      return `risk.${event}` as const
    case "restrictive_practice":
      return `restrictive_practice.${event}` as const
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function incidentStandingLabel(standing: IncidentStanding) {
  switch (standing) {
    case "draft":
      return "Draft"
    case "recorded":
      return "Recorded"
    default: {
      const unreachable: never = standing
      return unreachable
    }
  }
}
