import Link from "next/link"
import { notFound } from "next/navigation"

import { PolicyPdf } from "@/components/policy-pdf"
import { formatDate } from "@/lib/format-date"
import { practiceStandardName } from "@/lib/ndis-practice-standards"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { getPolicy } from "@/modules/policies/queries"

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const policy = await getPolicy(context, id)
  if (!policy) notFound()

  const image = policy.mime_type.startsWith("image/")
  const fileUrl = `/api/policies/${policy.id}`

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Link
          href="/policies"
          className="w-fit text-sm text-muted-foreground hover:text-foreground"
        >
          Policies
        </Link>
        <h1 className="font-heading text-lg">{policy.name}</h1>
        <p className="text-sm text-muted-foreground">
          {policy.original_filename} ·{" "}
          {practiceStandardName(policy.standard_code)} · Review{" "}
          {formatDate(policy.review_on)}
        </p>
      </div>
      {image ? (
        // The file is the policy the user asked to view.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl}
          alt={policy.name}
          className="max-h-[calc(100svh-12rem)] w-full rounded-lg border object-contain"
        />
      ) : (
        <PolicyPdf url={fileUrl} />
      )}
    </div>
  )
}
