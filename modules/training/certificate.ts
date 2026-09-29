import { formatAbn } from "@/lib/abn"
import { can, type TenantContext } from "@/lib/tenant"
import { createServerSupabase } from "@/lib/supabase/server"
import { renewalExpiryLabel } from "@/modules/training/renewal"

export type CourseCertificate = {
  enrolmentId: string
  workerName: string
  courseTitle: string
  completedOn: string
  score: number | null
  validUntil: string | null
  organisationName: string
  abn: string | null
  abnLabel: string
  registrationNumber: string | null
  registrationLabel: string
  logoUrl: string | null
  logoDataUri: string | null
}

async function toDataUri(url: string | null) {
  if (!url) return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    const mime = response.headers.get("content-type") ?? "image/png"
    return `data:${mime};base64,${bytes.toString("base64")}`
  } catch {
    return null
  }
}

export async function loadCourseCertificate(
  context: TenantContext,
  enrolmentId: string
): Promise<CourseCertificate | null> {
  const supabase = await createServerSupabase()
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id, status, completed_at, worker_id, courses(title, renewal_months)")
    .eq("id", enrolmentId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()

  if (!enrolment || enrolment.status !== "completed" || !enrolment.completed_at) {
    return null
  }

  const own = context.workerId === enrolment.worker_id
  if (!own && !can(context, "workers.read_all") && !can(context, "courses.manage")) {
    return null
  }

  const [{ data: completions }, { data: worker }, { data: organisation }] = await Promise.all([
    supabase.from("completions").select("passed, score").eq("enrolment_id", enrolment.id).eq("passed", true),
    supabase
      .from("workers")
      .select("first_name, last_name")
      .eq("id", enrolment.worker_id)
      .eq("organisation_id", context.organisationId)
      .maybeSingle(),
    supabase
      .from("organisations")
      .select("name, abn, registration_number, logo_path")
      .eq("id", context.organisationId)
      .maybeSingle(),
  ])

  if (!worker || (completions ?? []).length === 0) return null

  const course = enrolment.courses as unknown as { title: string; renewal_months: number | null }
  const scored = (completions ?? []).find((row) => row.score != null)
  let logoUrl: string | null = null
  if (organisation?.logo_path) {
    const { data: signed } = await supabase.storage
      .from("organisation-logos")
      .createSignedUrl(organisation.logo_path, 60 * 10)
    logoUrl = signed?.signedUrl ?? null
  }

  return {
    enrolmentId: enrolment.id,
    workerName: `${worker.first_name} ${worker.last_name}`,
    courseTitle: course.title,
    completedOn: enrolment.completed_at,
    score: scored?.score ?? null,
    validUntil: renewalExpiryLabel(enrolment.completed_at, course.renewal_months),
    organisationName: organisation?.name ?? context.organisationName,
    abn: organisation?.abn ?? null,
    abnLabel: formatAbn(organisation?.abn) ?? "not recorded",
    registrationNumber: organisation?.registration_number ?? null,
    registrationLabel: organisation?.registration_number
      ? `NDIS registration ${organisation.registration_number}`
      : "NDIS registration not recorded",
    logoUrl,
    logoDataUri: await toDataUri(logoUrl),
  }
}
