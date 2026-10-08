import { notFound } from "next/navigation"

import { ActionForm } from "@/components/action-form"
import { BackLink } from "@/components/back-link"
import { PolicyFlagLink } from "@/components/policy-flag"
import { PolicyPdf } from "@/components/policy-pdf"
import { buttonVariants } from "@/components/ui/button"
import { formatDate } from "@/lib/format-date"
import { practiceStandardName } from "@/lib/ndis-practice-standards"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { acknowledgePolicyAction } from "@/modules/policies/actions"
import { policyDocxType } from "@/modules/policies/attachments"
import { categoryLabel, policyCategory } from "@/modules/policies/categories"
import {
  getPolicy,
  getPolicyAcknowledgement,
  getPolicyFile,
} from "@/modules/policies/queries"
import { cn } from "cn"

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

  const category = policyCategory(policy)
  const policyFile = policy.file_id
    ? await getPolicyFile(context, policy.file_id)
    : null
  const hasFile = Boolean(policy.storage_path && policy.mime_type)
  const image = policy.mime_type?.startsWith("image/") ?? false
  const word = policy.mime_type === policyDocxType
  const fileUrl = `/api/policies/${policy.id}`

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <BackLink
          href={
            policyFile
              ? `/policies/files/${policyFile.id}`
              : `/policies/group/${category}`
          }
        >
          {policyFile?.name ?? categoryLabel(category)}
        </BackLink>
        <h1 className="font-heading text-lg">{policy.name}</h1>
        <p className="text-sm text-muted-foreground">
          {policy.original_filename ?? "Written policy"} ·{" "}
          {practiceStandardName(policy.standard_code)} · Review{" "}
          {formatDate(policy.review_on)}
        </p>
      </div>
      {policy.compliance_flagged ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
          <p className="text-sm">
            This policy does not meet the current standard.
          </p>
          <PolicyFlagLink id={policy.id} labeled />
        </div>
      ) : null}
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
        <article className="max-w-2xl rounded-lg border bg-card p-4 text-sm leading-6 whitespace-pre-wrap">
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
      {hasFile && word ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-fit"
          )}
        >
          Open attachment
        </a>
      ) : null}
      {hasFile && !image && !word ? <PolicyPdf url={fileUrl} /> : null}
    </div>
  )
}
