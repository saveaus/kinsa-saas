import { addDays, isBefore, parseISO } from "date-fns"

import { today as appToday } from "@/lib/today"

import { roleApplies, type StaffRole } from "@/modules/workforce/roles"

import type { DocumentApprovalStatus } from "@/lib/database.types"

export type ComplianceItemStatus = "met" | "pending" | "expired" | "lapsing" | "missing"

export type ComplianceItem = {
  key: string
  label: string
  kind: "document"
  status: ComplianceItemStatus
  expiresOn?: string | null
  code?: string | null
}

export type WorkerCompliance = {
  workerId: string
  items: ComplianceItem[]
  met: number
  total: number
  percent: number
  overall: "compliant" | "lapsing" | "pending" | "noncompliant"
}

type DocumentLike = {
  worker_id: string
  document_type_version_id: string
  approval_status: DocumentApprovalStatus
  expires_on: string | null
}

type TypeLike = {
  id: string
  name: string
  code?: string | null
  requires_expiry: boolean
  required: boolean
  roles?: StaffRole[]
}

function appliesToWorker(required: boolean, roles: StaffRole[] | undefined, workerRoles: StaffRole[]) {
  if (roles && roles.length > 0) return roleApplies(roles, workerRoles)
  return required
}

export function computeWorkerCompliance(input: {
  workerId: string
  workerRoles?: StaffRole[]
  types: TypeLike[]
  documents: DocumentLike[]
  lapsingWindowDays: number
}): WorkerCompliance {
  const today = appToday()
  const workerRoles = input.workerRoles ?? []
  const items: ComplianceItem[] = []

  for (const type of input.types) {
    if (!appliesToWorker(type.required, type.roles, workerRoles)) continue
    const docs = input.documents
      .filter((doc) => doc.worker_id === input.workerId && doc.document_type_version_id === type.id)
      .sort((a, b) => (b.expires_on ?? "").localeCompare(a.expires_on ?? ""))

    const approved = docs.find((doc) => doc.approval_status === "approved")
    const pending = docs.find((doc) => doc.approval_status === "pending")

    let status: ComplianceItemStatus = "missing"
    const expiresOn: string | null = approved?.expires_on ?? pending?.expires_on ?? null

    if (approved) {
      if (type.requires_expiry && approved.expires_on) {
        const expiry = parseISO(approved.expires_on)
        if (isBefore(expiry, today)) {
          status = "expired"
        } else if (isBefore(expiry, addDays(today, input.lapsingWindowDays))) {
          status = "lapsing"
        } else {
          status = "met"
        }
      } else if (type.requires_expiry) {
        // Without a date nothing can lapse or remind, so it cannot count as current.
        status = "pending"
      } else {
        status = "met"
      }
    } else if (pending) {
      status = "pending"
    }

    items.push({
      key: `doc:${type.id}`,
      label: type.name,
      kind: "document",
      code: type.code ?? null,
      status,
      expiresOn,
    })
  }

  const met = items.filter((item) => item.status === "met" || item.status === "lapsing").length
  const total = items.length
  const percent = total === 0 ? 100 : Math.round((met / total) * 100)

  let overall: WorkerCompliance["overall"] = "compliant"
  if (items.some((item) => item.status === "expired" || item.status === "missing")) {
    overall = "noncompliant"
  } else if (items.some((item) => item.status === "pending")) {
    overall = "pending"
  } else if (items.some((item) => item.status === "lapsing")) {
    overall = "lapsing"
  }

  return { workerId: input.workerId, items, met, total, percent, overall }
}

export const overallLabels: Record<WorkerCompliance["overall"], string> = {
  compliant: "Compliant",
  lapsing: "Lapsing",
  pending: "Pending review",
  noncompliant: "Not compliant",
}

export function overallLabel(overall: WorkerCompliance["overall"]) {
  return overallLabels[overall]
}

export function isExpired(expiresOn: string | null) {
  if (!expiresOn) return false
  return isBefore(parseISO(expiresOn), appToday())
}
