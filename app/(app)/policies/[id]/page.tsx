import { notFound } from "next/navigation"

import { ActionForm } from "@/components/action-form"
import { BackLink } from "@/components/back-link"
import { PolicyPdf } from "@/components/policy-pdf"
import { formatDate } from "@/lib/format-date"
import { practiceStandardName } from "@/lib/ndis-practice-standards"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { acknowledgePolicyAction } from "@/modules/policies/actions"
import { getPolicy, getPolicyAcknowledgement } from "@/modules/policies/queries"

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const [policy, acknowledgement] = await Promise.all([
    getPolicy(context, id),
    getPolicyAcknowledgement(context, id),
  ])
  if (!policy) notFound()

  const hasFile = Boolean(policy.storage_path && policy.mime_type)
  const image = policy.mime_type?.startsWith("image/") ?? false
  const fileUrl = `/api/policies/${policy.id}`

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <BackLink href="/policies" />
        <h1 className="font-heading text-lg">{policy.name}</h1>
        <p className="text-sm text-muted-foreground">
          {policy.original_filename ?? "Library policy"} ·{" "}
          {practiceStandardName(policy.standard_code)} · Review{" "}
          {formatDate(policy.review_on)}
        </p>
      </div>
      {policy.status === "draft" ? (
        <p className="text-sm text-muted-foreground">
          This draft does not count until someone accepts it. After that, it
          counts once it is acknowledged or linked to an accepted record.
        </p>
      ) : acknowledgement.mine ? (
        <p className="text-sm text-muted-foreground">
          You acknowledged this policy.
        </p>
      ) : (
        <ActionForm
          action={acknowledgePolicyAction}
          submitLabel="Acknowledge"
          submitSize="sm"
        >
          <input type="hidden" name="policy_id" value={policy.id} />
        </ActionForm>
      )}
      {policy.body ? (
        <article className="max-w-2xl whitespace-pre-wrap rounded-lg border bg-card p-4 text-sm leading-6">
          {policy.body}
        </article>
      ) : null}
      {hasFile && image ? (
        // The file is the policy the user asked to view.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl}
          alt={policy.name}
          className="max-h-[calc(100svh-12rem)] w-full rounded-lg border object-contain"
        />
      ) : null}
      {hasFile && !image ? <PolicyPdf url={fileUrl} /> : null}
    </div>
  )
}
