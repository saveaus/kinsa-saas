import { auditCatalogue, findCriterion } from "@/lib/audit-catalogue"
import { formatPersonLabel } from "@/lib/person-name"
import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import { parseStoredMessages, type AssistantStoredMessage } from "@/modules/assistant/messages"
import {
  interviewInstructions,
  priorQuestionPhrases,
} from "@/modules/internal-audits/prompt"
import {
  isAuditRating,
  isAuditRatingSource,
  type AuditRating,
  type AuditRatingSource,
} from "@/modules/internal-audits/rating"

export type OrgMember = {
  id: string
  label: string
}

export type AuditAssignmentView = {
  id: string
  auditId: string
  standardCode: string
  userId: string
  label: string
  chatId: string | null
  rating: AuditRating | null
  ratingSource: AuditRatingSource | null
  summary: string | null
  messages: AssistantStoredMessage[]
}

export type InternalAuditListItem = {
  id: string
  title: string
  createdAt: string
  assigned: number
  rated: number
}

function memberLabel(user: { full_name: string | null; email: string } | undefined) {
  const name = user?.full_name?.trim()
  if (name) return formatPersonLabel(name)
  return user?.email ?? "Team member"
}

export async function listOrgMembers(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organisation_id", context.organisationId)
  if (error) throw new Error(error.message)
  const ids = (memberships ?? []).map((membership) => membership.user_id)
  if (ids.length === 0) return []

  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", ids)
  if (userError) throw new Error(userError.message)

  return (users ?? [])
    .map((user) => ({ id: user.id, label: memberLabel(user) }))
    .sort((a, b) => a.label.localeCompare(b.label)) satisfies OrgMember[]
}

export async function listInternalAudits(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data: audits, error } = await supabase
    .from("internal_audits")
    .select("id, title, created_at")
    .eq("organisation_id", context.organisationId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  const rows = audits ?? []
  if (rows.length === 0) return [] satisfies InternalAuditListItem[]

  const auditIds = rows.map((audit) => audit.id)
  const { data: assignments, error: assignmentError } = await supabase
    .from("internal_audit_assignments")
    .select("id, audit_id")
    .in("audit_id", auditIds)
  if (assignmentError) throw new Error(assignmentError.message)

  const assignmentRows = assignments ?? []
  const assignmentIds = assignmentRows.map((assignment) => assignment.id)
  const rated = new Set<string>()
  if (assignmentIds.length > 0) {
    const { data: assessments, error: assessmentError } = await supabase
      .from("internal_audit_assessments")
      .select("assignment_id, rating")
      .in("assignment_id", assignmentIds)
    if (assessmentError) throw new Error(assessmentError.message)
    for (const assessment of assessments ?? []) {
      if (isAuditRating(assessment.rating)) rated.add(assessment.assignment_id)
    }
  }

  return rows.map((audit) => {
    const mine = assignmentRows.filter((assignment) => assignment.audit_id === audit.id)
    return {
      id: audit.id,
      title: audit.title,
      createdAt: audit.created_at,
      assigned: mine.length,
      rated: mine.filter((assignment) => rated.has(assignment.id)).length,
    }
  }) satisfies InternalAuditListItem[]
}

export async function getInternalAudit(context: TenantContext, auditId: string) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("internal_audits")
    .select("id, title, created_at")
    .eq("id", auditId)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { id: data.id, title: data.title, createdAt: data.created_at }
}

export async function listAuditAssignments(
  context: TenantContext,
  auditId: string,
  options?: { messages?: boolean; userId?: string }
) {
  const supabase = await createServerSupabase()
  let request = supabase
    .from("internal_audit_assignments")
    .select("id, audit_id, standard_code, user_id")
    .eq("audit_id", auditId)
    .eq("organisation_id", context.organisationId)
  if (options?.userId) request = request.eq("user_id", options.userId)
  const { data: assignments, error } = await request
  if (error) throw new Error(error.message)
  const rows = assignments ?? []
  if (rows.length === 0) return [] satisfies AuditAssignmentView[]

  const assignmentIds = rows.map((assignment) => assignment.id)
  const userIds = [...new Set(rows.map((assignment) => assignment.user_id))]

  const [usersResult, chatsResult, assessmentsResult] = await Promise.all([
    supabase.from("users").select("id, full_name, email").in("id", userIds),
    supabase
      .from("assistant_chats")
      .select("id, assignment_id, messages")
      .in("assignment_id", assignmentIds),
    supabase
      .from("internal_audit_assessments")
      .select("assignment_id, rating, source, summary")
      .in("assignment_id", assignmentIds),
  ])
  if (usersResult.error) throw new Error(usersResult.error.message)
  if (chatsResult.error) throw new Error(chatsResult.error.message)
  if (assessmentsResult.error) throw new Error(assessmentsResult.error.message)

  const users = new Map((usersResult.data ?? []).map((user) => [user.id, user]))
  const chats = new Map(
    (chatsResult.data ?? []).flatMap((chat) =>
      chat.assignment_id ? [[chat.assignment_id, chat] as const] : []
    )
  )
  const assessments = new Map(
    (assessmentsResult.data ?? []).map((assessment) => [
      assessment.assignment_id,
      assessment,
    ])
  )

  return rows.map((assignment) => {
    const assessment = assessments.get(assignment.id)
    const chat = chats.get(assignment.id)
    const messages = options?.messages ? parseStoredMessages(chat?.messages) : []
    return {
      id: assignment.id,
      auditId: assignment.audit_id,
      standardCode: assignment.standard_code,
      userId: assignment.user_id,
      label: memberLabel(users.get(assignment.user_id)),
      chatId: chat?.id ?? null,
      rating:
        assessment && isAuditRating(assessment.rating) ? assessment.rating : null,
      ratingSource:
        assessment && isAuditRatingSource(assessment.source)
          ? assessment.source
          : null,
      summary: assessment?.summary ?? null,
      messages,
    }
  }) satisfies AuditAssignmentView[]
}

export async function interviewTurn(context: TenantContext, chatId: string) {
  const supabase = await createServerSupabase()
  const { data: chat } = await supabase
    .from("assistant_chats")
    .select("id, assignment_id, purpose")
    .eq("id", chatId)
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .maybeSingle()
  if (!chat) return { kind: "missing" as const }
  if (!chat.assignment_id) {
    if (chat.purpose === "internal_audit") return { kind: "audit" as const }
    return { kind: "general" as const }
  }

  const { data: assignment } = await supabase
    .from("internal_audit_assignments")
    .select("id, standard_code, user_id")
    .eq("id", chat.assignment_id)
    .maybeSingle()
  if (!assignment || assignment.user_id !== context.userId) {
    return { kind: "missing" as const }
  }

  const criterion = findCriterion(
    context.organisationRegistrationGroups,
    assignment.standard_code
  ) ?? {
    code: assignment.standard_code,
    name: assignment.standard_code,
    module: "Practice standards",
    category: "Practice standards",
  }

  const [policyResult, earlierResult, assessmentResult] = await Promise.all([
    supabase
      .from("policies")
      .select("id")
      .eq("organisation_id", context.organisationId)
      .eq("standard_code", assignment.standard_code)
      .eq("status", "accepted")
      .limit(1),
    supabase
      .from("internal_audit_assignments")
      .select("id")
      .eq("organisation_id", context.organisationId)
      .eq("user_id", context.userId)
      .eq("standard_code", assignment.standard_code)
      .neq("id", assignment.id),
    supabase
      .from("internal_audit_assessments")
      .select("rating, source")
      .eq("assignment_id", assignment.id)
      .maybeSingle(),
  ])
  if (policyResult.error) throw new Error(policyResult.error.message)
  if (earlierResult.error) throw new Error(earlierResult.error.message)
  if (assessmentResult.error) throw new Error(assessmentResult.error.message)

  const earlierIds = (earlierResult.data ?? []).map((row) => row.id)
  let priorPhrases: string[] = []
  if (earlierIds.length > 0) {
    const { data: previousChats, error: previousError } = await supabase
      .from("assistant_chats")
      .select("messages")
      .in("assignment_id", earlierIds)
      .order("created_at", { ascending: false })
      .limit(3)
    if (previousError) throw new Error(previousError.message)
    priorPhrases = priorQuestionPhrases(
      (previousChats ?? []).map((previous) =>
        parseStoredMessages(previous.messages)
          .filter((message) => message.role === "assistant")
          .map((message) => message.text)
      )
    )
  }

  const recorded =
    assessmentResult.data &&
    isAuditRating(assessmentResult.data.rating) &&
    isAuditRatingSource(assessmentResult.data.source)
      ? {
          rating: assessmentResult.data.rating,
          source: assessmentResult.data.source,
        }
      : null

  return {
    kind: "interview" as const,
    assignmentId: assignment.id,
    instructions: interviewInstructions({
      criterion,
      policyOnFile: (policyResult.data ?? []).length > 0,
      priorPhrases,
      recorded,
    }),
  }
}

export function applicableCatalogue(context: TenantContext) {
  return auditCatalogue(context.organisationRegistrationGroups)
}
