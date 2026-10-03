import Link from "next/link"
import { notFound } from "next/navigation"

import { Chip } from "@/components/chip"
import { PolicyPdf } from "@/components/policy-pdf"
import { formatDate } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { listLogRegisters } from "@/modules/logs/queries"
import { logShown } from "@/modules/logs/standing"
import { getSupportPlanCheck } from "@/modules/support-plan-checks/queries"
import {
  supportPlanCheckResult,
  supportPlanCheckResultLabel,
} from "@/modules/support-plan-checks/standing"

export async function SupportPlanCheckFilePage({ id }: { id: string }) {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const check = await getSupportPlanCheck(context, id)
  if (!check) notFound()
  const logs = await listLogRegisters(context)
  if (!logShown(logs, "support_plan_check")) notFound()

  const result = supportPlanCheckResult(check.followed)
  const image = check.mime_type?.startsWith("image/") ?? false
  const fileUrl = `/api/support-plan-checks/${check.id}`

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Link
          href="/support-plan-checks"
          className="w-fit text-sm text-muted-foreground hover:text-foreground"
        >
          Back to support plan checks
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-lg">{check.note}</h1>
          <Chip tone={result === "followed" ? "green" : "red"}>
            {supportPlanCheckResultLabel(result)}
          </Chip>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(check.checked_on)}
          {check.participant_name ? (
            <>
              {" · "}
              <Link
                href={`/participants/${check.participant_id}`}
                className="hover:text-foreground"
              >
                {check.participant_name}
              </Link>
            </>
          ) : null}
          {check.plan_filename ? (
            <>
              {" · "}
              <Link
                href={`/participants/${check.participant_id}/files/${check.plan_id}`}
                className="hover:text-foreground"
              >
                {check.plan_filename}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      {check.storage_path && check.mime_type ? (
        image ? (
          // The file is the note or screenshot the user asked to view.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl}
            alt={check.note}
            className="max-h-[calc(100svh-12rem)] w-full rounded-lg border object-contain"
          />
        ) : (
          <PolicyPdf url={fileUrl} />
        )
      ) : (
        <p className="text-sm text-muted-foreground">No file attached.</p>
      )}
    </div>
  )
}
