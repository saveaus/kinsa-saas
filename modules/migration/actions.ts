"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"

import { revalidateCompliance } from "@/lib/revalidate-compliance"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { reviewUploadedDocument } from "@/modules/documents/assist"
import { staffError } from "@/modules/billing/guard"
import { syncSubscriptionSeats } from "@/modules/billing/stripe"
import { addStaff, placeRecords, previewCertificateNames } from "@/modules/migration/run"
import { parseRoster, type RosterRow } from "@/modules/migration/roster"
import { listTeams } from "@/modules/teams/queries"

const csvLimit = 1024 * 1024

export async function previewStaffAction(csv: string): Promise<
  | { error: string }
  | {
      people: RosterRow[]
      skipped: number
      teams: { code: string; name: string }[]
    }
> {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")
  if (csv.length > csvLimit) return { error: "That spreadsheet is too large." }
  const teams = await listTeams(context)
  const parsed = parseRoster(csv, teams.map((team) => ({ code: team.code, name: team.name })))
  if (parsed.rows.length === 0) return { error: "No staff rows had a name and an email." }
  return {
    people: parsed.rows,
    skipped: parsed.skipped,
    teams: teams.map((team) => ({ code: team.code, name: team.name })),
  }
}

export async function commitStaffAction(
  people: { firstName: string; lastName: string; email: string; roles: string[] }[]
) {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")
  const closed = await staffError(context)
  if (closed) return { error: closed, added: [], alreadyHere: 0, failed: 0 }
  const teams = await listTeams(context)
  const result = await addStaff({
    organisationId: context.organisationId,
    teams: teams.map((team) => ({ code: team.code, name: team.name })),
    people,
  })
  if (result.added.length > 0) {
    await syncSubscriptionSeats(context.organisationId).catch((error: unknown) => {
      console.error("staff import seats", error)
    })
    revalidatePath("/workers")
    revalidateCompliance()
  }
  return result
}

export async function previewCertificatesAction(filenames: string[]) {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")
  requirePermission(context, "documents.read_all")
  return previewCertificateNames(context.organisationId, filenames)
}

export async function commitCertificatesAction(formData: FormData) {
  const { context } = await requireTenant()
  requirePermission(context, "workers.manage")
  requirePermission(context, "documents.read_all")
  const closed = await staffError(context)
  if (closed) {
    return { error: closed, documentsFiled: 0, failed: [] as string[], left: [] as number[] }
  }
  const result = await placeRecords({
    organisationId: context.organisationId,
    userId: context.userId,
    formData,
  })
  revalidatePath("/workers")
  revalidatePath("/approvals")
  revalidateCompliance()
  if (result.documentIds.length > 0) {
    after(async () => {
      for (const documentId of result.documentIds) {
        await reviewUploadedDocument(context.organisationId, documentId).catch((error: unknown) => {
          console.error("certificate review", error)
        })
      }
      revalidatePath("/approvals")
      revalidateCompliance()
    })
  }
  return result.value
}
