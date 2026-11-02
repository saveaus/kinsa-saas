"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { ArrowUp, Paperclip } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  AssistantAttachmentChips,
  AssistantImagePreviews,
  type AssistantAttachmentChip,
} from "@/components/assistant-attachments"
import {
  AssistantImport,
  type CertificateDraft,
  type StaffDraft,
} from "@/components/assistant-import"
import { AssistantPolicyCard } from "@/components/assistant-policy"
import { AssistantRatingCard } from "@/components/assistant-rating"
import { AssistantRecordsCard } from "@/components/assistant-records"
import {
  AssistantSnapshotCard,
  AssistantSnapshotSkeleton,
} from "@/components/assistant-snapshot"
import { AssistantAssignCard } from "@/components/assistant-assign"
import { PolicyComplianceChoice } from "@/components/policy-compliance-choice"
import { AssistantTaskCard } from "@/components/assistant-task"
import { AuditChoice } from "@/components/audit-choice"
import { AssistantSuggestions } from "@/components/assistant-suggestions"
import { AuditFindingCard } from "@/components/audit-finding"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  acceptAttachments,
  attachmentByteLimit,
  attachmentCountLimit,
  certificateBatchSize,
  certificateTooLarge,
  isOldWordFile,
  isPastedTextName,
  pasteAsAttachment,
  pastedTextName,
} from "@/modules/assistant/attachments"
import {
  cancelInterviewRating,
  confirmInterviewRating,
} from "@/modules/internal-audits/actions"
import {
  auditSelectionPrefix,
  findingsFromParts,
  proposedFindingsFromParts,
} from "@/modules/internal-audits/conduct"
import type { AssistantUpgrade } from "@/modules/assistant/allowance"
import type { AssistantPolicyDraft } from "@/modules/assistant/policy"
import {
  policyDraftsFromParts,
  policyFilingKey,
  policyRevisionPrompt,
  policyRevisionTarget,
} from "@/modules/assistant/policy"
import {
  assistantHistoryLimit,
  interviewHistoryLimit,
} from "@/modules/assistant/model"
import {
  interviewRequest,
  requestWindow,
} from "@/modules/assistant/request-window"
import { messageText, policyFlagId } from "@/modules/policies/flag-prompt"
import {
  ratingCancelledResult,
  ratingSavedResult,
  ratingsFromParts,
} from "@/modules/assistant/ratings"
import { recordCardsFromParts } from "@/modules/assistant/records"
import {
  snapshotPending,
  snapshotsFromParts,
} from "@/modules/assistant/snapshots"
import {
  confirmAssistantTask,
  fileAssistantPolicy,
} from "@/modules/assistant/task-actions"
import {
  assignmentsFromParts,
  type AssignmentOutcome,
} from "@/modules/assistant/assignments"
import {
  tasksFromParts,
  type AssistantStoredTask,
  type AssistantTaskOutcome,
} from "@/modules/assistant/tasks"
import {
  saveAssistantChat,
  updateAssistantChatMessages,
} from "@/modules/assistant/actions"
import {
  commitCertificatesAction,
  commitStaffAction,
  previewCertificatesAction,
  previewStaffAction,
} from "@/modules/migration/actions"
import {
  certificateCheckMessage,
  staffCheckMessage,
  teamLabel,
} from "@/modules/migration/speak"
import {
  clearAssistantDraft,
  readAssistantDraft,
  toStoredMessages,
  toUIMessages,
  type AssistantStoredMessage,
} from "@/modules/assistant/messages"

const interviewSuggestions = [
  "I'm ready",
  "That's everything I have",
  "Can you ask that another way?",
]

const auditSuggestions = [
  "Start with the biggest gap",
  "Review worker screening and documents",
  "Review incidents from report to close",
  "Review how complaints are handled",
]

type ComposerFile = {
  id: string
  file: File
  previewUrl: string | null
}

type PendingImport =
  | {
      kind: "staff"
      people: StaffDraft[]
      skipped: number
      teams: { code: string; name: string }[]
      heldCertificates: File[]
    }
  | {
      kind: "certificates"
      files: CertificateDraft[]
      workers: { id: string; firstName: string; lastName: string }[]
      types: { id: string; name: string }[]
    }

/**
 * What was on screen when a new chat moved to its own page. Moving remounts this
 * component, and what someone typed while the page loaded should not disappear.
 */
let carried: { id: string; input: string; done: string | null } | null = null

function takeCarried(id: string | undefined) {
  if (!id || carried?.id !== id) return null
  const taken = carried
  carried = null
  return taken
}

export function AssistantChat({
  chat,
  mode,
  canImport = false,
  suggestions = [],
  auditChoices = [],
  starter,
  policyFlag = null,
  canAssign = false,
  policyStandards = [],
  upgrade = null,
}: {
  chat?: {
    id: string
    title: string
    messages: AssistantStoredMessage[]
    interviewAuditId?: string | null
    assignmentId?: string | null
    purpose?: "general" | "internal_audit"
  }
  mode?: "internal_audit"
  canImport?: boolean
  suggestions?: string[]
  auditChoices?: { code: string; label: string }[]
  starter?: string
  policyFlag?: {
    id: string
    stamp: string
    filename: string
    prompt: string
  } | null
  canAssign?: boolean
  policyStandards?: { code: string; name: string }[]
  upgrade?: AssistantUpgrade | null
}) {
  const interview = Boolean(chat?.interviewAuditId || chat?.assignmentId)
  const audit =
    !interview &&
    (mode === "internal_audit" || chat?.purpose === "internal_audit")
  const prompts = interview
    ? interviewSuggestions
    : audit
      ? suggestions.length > 0
        ? suggestions
        : auditSuggestions
      : suggestions
  const router = useRouter()
  const pathname = usePathname()
  const [restored] = useState(() => takeCarried(chat?.id))
  const [input, setInput] = useState(restored?.input ?? starter ?? "")
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(restored?.done ?? null)
  const [importing, setImporting] = useState(false)
  const [reading, setReading] = useState(false)
  const [newChatId, setNewChatId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [attachments, setAttachments] = useState<ComposerFile[]>([])
  const [outcomes, setOutcomes] = useState<
    Record<string, AssistantTaskOutcome>
  >({})
  const [assignmentOutcomes, setAssignmentOutcomes] = useState<
    Record<string, AssignmentOutcome>
  >({})
  const [findingOutcomes, setFindingOutcomes] = useState<
    Record<string, { status: "confirmed" | "cancelled"; result: string }>
  >({})
  const [ratingOutcomes, setRatingOutcomes] = useState<
    Record<string, { status: "done" | "cancelled"; result: string }>
  >({})
  const [policyFilings, setPolicyFilings] = useState<Record<string, string>>({})
  const imports = canImport && !interview && !audit
  const outcomesRef = useRef(outcomes)
  const assignmentRef = useRef(assignmentOutcomes)
  const findingRef = useRef(findingOutcomes)
  const ratingRef = useRef(ratingOutcomes)
  const policyFilingRef = useRef(policyFilings)
  const previousRef = useRef<AssistantStoredMessage[]>(chat?.messages ?? [])
  const messagesRef = useRef<UIMessage[]>([])
  const attachmentsRef = useRef(attachments)
  outcomesRef.current = outcomes
  assignmentRef.current = assignmentOutcomes
  findingRef.current = findingOutcomes
  ratingRef.current = ratingOutcomes
  policyFilingRef.current = policyFilings
  attachmentsRef.current = attachments
  const chatId = chat?.id
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant",
        body: {
          ...(chatId ? { chatId } : {}),
          ...(audit ? { mode: "internal_audit" } : {}),
        },
        // The server only reads this window, and old file data can exceed Vercel's request limit.
        prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({
          body: {
            ...body,
            id,
            trigger,
            messageId,
            messages: interview
              ? interviewRequest(messages)
              : requestWindow(messages, {
                  limit: audit ? interviewHistoryLimit : assistantHistoryLimit,
                  // The audit's chosen registration groups are in the first message.
                  keepFirstUser: audit,
                }),
          },
        }),
      }),
    [audit, chatId, interview]
  )
  const savedId = useRef<string | null>(chat?.id ?? null)
  const persistChain = useRef(Promise.resolve())
  const persistFailed = useRef(false)
  const auditRef = useRef(audit)
  const hasChat = useRef(Boolean(chat))
  auditRef.current = audit
  hasChat.current = Boolean(chat)
  const persistRef = useRef<(next: UIMessage[]) => void>(() => undefined)
  persistRef.current = (next) => {
    const stored = toStoredMessages(
      next,
      previousRef.current,
      outcomesRef.current,
      {
        findings: findingRef.current,
        ratings: ratingRef.current,
        assignments: assignmentRef.current,
        policies: policyFilingRef.current,
      }
    )
    previousRef.current = stored
    // The server writes an interview's transcript. Nothing here can change it.
    if (interview) return
    persistChain.current = persistChain.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const existingId = savedId.current
          if (existingId) {
            const result = await updateAssistantChatMessages(existingId, stored)
            if (result.error || !result.id) {
              persistFailed.current = true
              setNotice(result.error ?? "The chat could not be saved.")
              return
            }
            persistFailed.current = false
            if (hasChat.current) router.refresh()
            return
          }
          const result = await saveAssistantChat(
            stored,
            auditRef.current ? { purpose: "internal_audit" } : undefined
          )
          if (result.error || !result.id) {
            persistFailed.current = true
            setNotice(result.error ?? "The chat could not be saved.")
            return
          }
          savedId.current = result.id
          persistFailed.current = false
          if (!auditRef.current) setNewChatId(result.id)
        } catch (caught) {
          console.error(caught)
          persistFailed.current = true
          setNotice("The chat could not be saved.")
        }
      })
  }
  useEffect(() => {
    return () => releaseAttachments(attachmentsRef.current)
  }, [])

  const { messages, sendMessage, status, stop, error, regenerate, clearError } =
    useChat({
      id: chat?.id,
      messages: chat ? toUIMessages(chat.messages) : undefined,
      transport,
      onFinish: ({ messages: next, isAbort, isError, finishReason }) => {
        if (isAbort || isError || finishReason === "error") return
        persistRef.current(next)
      },
    })

  const startedDraft = useRef<string | null>(null)

  useEffect(() => {
    if (!starter || messages.length > 0) return
    setInput(starter)
  }, [starter, messages.length])

  useEffect(() => {
    if (upgrade || !policyFlag || chat || messages.length > 0) return
    let cancel = false
    void (async () => {
      const file = await loadPolicyFile(policyFlag).catch(() => null)
      if (cancel) return
      if (file)
        void sendMessage({ text: policyFlag.prompt, files: toFileList([file]) })
      else void sendMessage({ text: policyFlag.prompt })
    })()
    return () => {
      cancel = true
    }
  }, [chat, messages.length, policyFlag, sendMessage, upgrade])

  useEffect(() => {
    if (upgrade || chat || starter || pathname !== "/assistant") {
      startedDraft.current = null
      return
    }
    const draft = readAssistantDraft()
    if (!draft || startedDraft.current === draft || messages.length > 0) return
    startedDraft.current = draft
    void sendMessage({ text: draft })
  }, [chat, messages.length, pathname, sendMessage, starter, upgrade])

  useEffect(() => {
    const draft = readAssistantDraft()
    if (!draft) return
    const sent = messages.some(
      (message) =>
        message.role === "user" &&
        message.parts.some(
          (part) => part.type === "text" && part.text.trim() === draft
        )
    )
    if (!sent) return
    const handle = window.setTimeout(() => clearAssistantDraft(), 0)
    return () => window.clearTimeout(handle)
  }, [messages])
  messagesRef.current = messages
  const busy = status === "submitted" || status === "streaming"
  const liveReply = busy ? messages.at(-1) : undefined
  const liveHasText =
    liveReply?.role === "assistant" &&
    liveReply.parts.some((part) => part.type === "text" && part.text.length > 0)
  const showThinking =
    busy &&
    !liveHasText &&
    !(
      liveReply &&
      (snapshotPending(liveReply.parts) ||
        snapshotsFromParts(liveReply.parts).length > 0)
    )

  // Moving a new chat to its own page remounts this component, which would drop an
  // import card and its files, attached files, and anything typed. So it waits.
  const holdNavigation =
    busy ||
    importing ||
    reading ||
    Boolean(pending) ||
    attachments.length > 0 ||
    input.trim().length > 0

  useEffect(() => {
    if (!newChatId || chat || holdNavigation) return
    if (pathname !== "/assistant") return
    router.replace(`/assistant/${newChatId}`)
  }, [chat, holdNavigation, newChatId, pathname, router])

  useEffect(() => {
    if (newChatId && !chat) carried = { id: newChatId, input, done }
  }, [chat, done, input, newChatId])

  useEffect(() => {
    if (chat || !audit || busy || holdNavigation) return
    let cancel = false
    void persistChain.current.then(() => {
      if (cancel || persistFailed.current) return
      const id = savedId.current
      if (!id) return
      router.replace(`/audits/reviews/${id}`)
    })
    return () => {
      cancel = true
    }
  }, [audit, busy, chat, holdNavigation, messages, router])

  const started = messages.length > 0

  function startAudit(selected: { code: string; label: string }[]) {
    if (selected.length === 0 || busy || upgrade) return
    setNotice(null)
    void sendMessage({
      text: [
        auditSelectionPrefix,
        ...selected.map((group) => group.label),
      ].join("\n"),
    })
  }

  function ask(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy || upgrade) return
    setInput("")
    setNotice(null)
    void sendMessage({ text: trimmed })
  }

  /** Says something for the person, such as an import note, and leaves what they typed alone. */
  function tell(text: string) {
    if (busy || upgrade) return
    setNotice(null)
    void sendMessage({ text })
  }

  function submit(text: string) {
    const trimmed = text.trim()
    const staged = attachments
    if (busy || upgrade) return
    if (!trimmed && staged.length === 0) return
    setInput("")
    setNotice(null)
    setAttachments([])
    releaseAttachments(staged)
    const files = staged.map((item) => item.file)
    const list = files.length > 0 ? toFileList(files) : null
    if (list && list.length > 0) {
      void sendMessage(
        trimmed ? { text: trimmed, files: list } : { files: list }
      )
    } else if (trimmed) {
      void sendMessage({ text: trimmed })
    }
    const rosters = imports ? files.filter(isStaffRoster) : []
    if (rosters.length > 0) void receiveFiles(rosters, { announce: false })
  }

  function addAttachments(files: File[]) {
    const decision = acceptAttachments(
      attachments.map((item) => ({ size: item.file.size })),
      files.map((file) => ({ name: file.name, size: file.size }))
    )
    if (decision.rejected[0]) setNotice(decision.rejected[0])
    else if (decision.accepted.length > 0) setNotice(null)
    const next = decision.accepted.flatMap((index) => {
      const file = files[index]
      if (!file) return []
      return [
        {
          id: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : null,
        },
      ]
    })
    if (next.length === 0) return
    setAttachments((current) => [...current, ...next])
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const removed = current.find((item) => item.id === id)
      if (removed) releaseAttachments([removed])
      return current.filter((item) => item.id !== id)
    })
  }

  function takeFiles(files: File[], source: "paste" | "pick") {
    if (files.length === 0) return
    if (busy) {
      setNotice("Wait for the reply, then add the file.")
      return
    }
    if (source === "pick" && imports && shouldImportNow(files)) {
      void receiveFiles(files)
      return
    }
    addAttachments(files)
  }

  async function confirmTask(
    task: AssistantStoredTask,
    revisesPolicyId: string | null
  ) {
    const result = await confirmAssistantTask(task, { revisesPolicyId })
    if (result.error) return result
    const outcome: AssistantTaskOutcome = {
      status: "done",
      result: result.message ?? "Done.",
    }
    outcomesRef.current = { ...outcomesRef.current, [task.id]: outcome }
    setOutcomes(outcomesRef.current)
    persistRef.current(messagesRef.current)
    return result
  }

  async function filePolicy(
    messageId: string,
    draft: AssistantPolicyDraft,
    standardCode: string | null,
    revisesPolicyId: string | null
  ) {
    const result = await fileAssistantPolicy({
      draft,
      standardCode,
      revisesPolicyId,
    })
    if (result.error) return result
    policyFilingRef.current = {
      ...policyFilingRef.current,
      [policyFilingKey(messageId, draft.filename)]: result.message ?? "Filed.",
    }
    setPolicyFilings(policyFilingRef.current)
    persistRef.current(messagesRef.current)
    return result
  }

  function cancelTask(id: string) {
    const outcome: AssistantTaskOutcome = {
      status: "cancelled",
      result: "Cancelled. Nothing was changed.",
    }
    outcomesRef.current = { ...outcomesRef.current, [id]: outcome }
    setOutcomes(outcomesRef.current)
    persistRef.current(messagesRef.current)
  }

  async function openCertificates(files: File[], announce = true) {
    const preview = await previewCertificatesAction(
      files.map((file) => file.name)
    )
    setPending({
      kind: "certificates",
      workers: preview.workers,
      types: preview.types,
      files: files.map((file, index) => ({
        file,
        workerId: preview.files[index]?.workerId ?? "",
        typeId: preview.files[index]?.typeId ?? "",
      })),
    })
    const described = files.map((file, index) => {
      const match = preview.files[index]
      const worker = preview.workers.find((item) => item.id === match?.workerId)
      const type = preview.types.find((item) => item.id === match?.typeId)
      return {
        name: file.name,
        worker: worker ? `${worker.firstName} ${worker.lastName}` : null,
        type: type?.name ?? null,
      }
    })
    if (announce) tell(certificateCheckMessage(described))
  }

  async function receiveFiles(list: File[], options?: { announce?: boolean }) {
    const announce = options?.announce !== false
    if (!imports || importing) return
    if (busy) {
      setNotice("Wait for the reply, then drop the file.")
      return
    }
    setReading(true)
    try {
      const spreadsheets = list.filter((file) => /\.xlsx?$/i.test(file.name))
      const rosters = list.filter(
        (file) => /\.(csv|tsv)$/i.test(file.name) && !file.name.startsWith(".")
      )
      const notes = list.filter(
        (file) => /\.txt$/i.test(file.name) && !file.name.startsWith(".")
      )
      const tooBig = list.filter(
        (file) =>
          /\.(pdf|png|jpe?g)$/i.test(file.name) && certificateTooLarge(file.size)
      )
      const evidence = list
        .filter(
          (file) =>
            /\.(pdf|png|jpe?g)$/i.test(file.name) &&
            !file.name.startsWith(".") &&
            file.size > 0 &&
            !certificateTooLarge(file.size)
        )
        .slice(0, 80)
      const warning =
        tooBig.length > 0
          ? tooBig.length === 1
            ? `${tooBig[0]?.name ?? "A file"} is over 4 MB, so it cannot be filed here. Make it smaller and add it again.`
            : `${tooBig.length} files are over 4 MB, so they cannot be filed here. Make them smaller and add them again.`
          : spreadsheets.length > 0 &&
              rosters.length === 0 &&
              notes.length === 0
            ? "Save the spreadsheet as CSV and drop it again."
            : null
      const rosterFiles = rosters.length > 0 ? rosters : notes
      if (rosterFiles.length > 0) {
        const csv = (
          await Promise.all(rosterFiles.map((file) => file.text()))
        ).join("\n")
        const preview = await previewStaffAction(csv)
        if (!("people" in preview)) {
          if (evidence.length === 0 || rosters.length > 0) {
            setNotice(
              preview.error ?? warning ?? "That file could not be read."
            )
            return
          }
        } else {
          setDone(null)
          setPending({
            kind: "staff",
            people: preview.people,
            skipped: preview.skipped,
            teams: preview.teams,
            heldCertificates: evidence,
          })
          if (announce) {
            tell(
              staffCheckMessage(
                preview.people.map((person) => ({
                  firstName: person.firstName,
                  lastName: person.lastName,
                  email: person.email,
                  team: teamLabel(person.roles, preview.teams),
                })),
                preview.skipped
              )
            )
          }
          if (warning) setNotice(warning)
          return
        }
      }
      if (evidence.length > 0) {
        setDone(null)
        await openCertificates(evidence, announce)
        if (warning) setNotice(warning)
        return
      }
      if (warning) setNotice(warning)
    } catch (error) {
      console.error(error)
      setNotice("That file could not be read.")
    } finally {
      setReading(false)
    }
  }

  async function approveImport() {
    if (!pending || importing) return
    setImporting(true)
    setNotice(null)
    try {
      if (pending.kind === "staff") {
        const result = await commitStaffAction(pending.people)
        if (result.error) {
          setNotice(result.error)
          return
        }
        const held = pending.heldCertificates
        setPending(null)
        const added =
          result.added.length === 1
            ? "1 worker added."
            : `${result.added.length} workers added.`
        const here =
          result.alreadyHere > 0 ? ` ${result.alreadyHere} already here.` : ""
        const missed =
          result.failed > 0 ? ` ${result.failed} could not be added.` : ""
        setDone(`${added}${here}${missed}`)
        if (held.length > 0) {
          await openCertificates(held)
          return
        }
        tell("The staff list is added.")
        return
      }
      let filed = 0
      const failed: string[] = []
      let remaining = pending.files
      try {
        while (remaining.length > 0) {
          const size = certificateBatchSize(
            remaining.map((item) => item.file.size)
          )
          if (size === 0) {
            setPending({ ...pending, files: remaining })
            setNotice(
              `${remaining[0]?.file.name ?? "A file"} is too large to file here. Make it smaller and add it again.`
            )
            return
          }
          const group = remaining.slice(0, size)
          const data = new FormData()
          for (const item of group) {
            data.append("file", item.file)
            data.append("worker_id", item.workerId)
            data.append("type_id", item.typeId)
          }
          const result = await commitCertificatesAction(data)
          if (result.error && result.documentsFiled === 0) {
            setPending({ ...pending, files: remaining })
            if (filed > 0) {
              const count =
                filed === 1
                  ? "1 certificate filed."
                  : `${filed} certificates filed.`
              setDone(`${count} The rest are still in the list.`)
            }
            setNotice(result.error)
            return
          }
          filed += result.documentsFiled
          failed.push(...result.failed)
          remaining = remaining.slice(group.length)
        }
      } catch (error) {
        console.error(error)
        setPending({ ...pending, files: remaining })
        if (filed > 0) {
          const count =
            filed === 1
              ? "1 certificate filed."
              : `${filed} certificates filed.`
          setDone(`${count} The rest are still in the list.`)
        }
        setNotice("Those records could not be added.")
        return
      }
      setPending(null)
      const count =
        filed === 1 ? "1 certificate filed." : `${filed} certificates filed.`
      const missed =
        failed.length > 0 ? ` ${failed.length} could not be saved.` : ""
      setDone(`${count}${missed} The assistant checks the ones it can read.`)
      tell("The certificates are filed.")
    } catch (error) {
      console.error(error)
      setNotice("Those records could not be added.")
    } finally {
      setImporting(false)
    }
  }

  const importCard =
    pending || done ? (
      <>
        {done ? (
          <p className="mb-3 text-sm text-muted-foreground">{done}</p>
        ) : null}
        {pending ? (
          <AssistantImport
            staff={
              pending.kind === "staff"
                ? { people: pending.people, skipped: pending.skipped }
                : null
            }
            certificates={
              pending.kind === "certificates" ? pending.files : null
            }
            teams={pending.kind === "staff" ? pending.teams : []}
            workers={pending.kind === "certificates" ? pending.workers : []}
            types={pending.kind === "certificates" ? pending.types : []}
            busy={importing}
            onStaffRole={(index, role) =>
              setPending((current) => {
                if (!current || current.kind !== "staff") return current
                return {
                  ...current,
                  people: current.people.map((person, personIndex) =>
                    personIndex === index
                      ? { ...person, roles: [role] }
                      : person
                  ),
                }
              })
            }
            onCertificate={(index, patch) =>
              setPending((current) => {
                if (!current || current.kind !== "certificates") return current
                return {
                  ...current,
                  files: current.files.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, ...patch } : item
                  ),
                }
              })
            }
            onApprove={() => void approveImport()}
            onDismiss={() => setPending(null)}
          />
        ) : null}
      </>
    ) : null

  return (
    <div
      data-assistant=""
      className="flex min-h-0 flex-1 flex-col bg-background"
    >
      {started && chat ? (
        <div className="flex h-12 shrink-0 items-center gap-2 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <p className="max-w-sm truncate text-sm font-medium">
              {chat.title}
            </p>
            {chat.interviewAuditId ? (
              <Link
                href={`/audits/${chat.interviewAuditId}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Internal audit
              </Link>
            ) : audit ? (
              <Link
                href="/audits"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Internal audits
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {started ? (
          <ul className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-8">
            {messages.map((message, index) => {
              const live =
                busy &&
                index === messages.length - 1 &&
                message.role === "assistant"
              const hasText = message.parts.some(
                (part) => part.type === "text" && part.text.length > 0
              )
              const cardReady =
                snapshotsFromParts(message.parts).length > 0 ||
                snapshotPending(message.parts) ||
                assignmentsFromParts(message.parts).length > 0 ||
                proposedFindingsFromParts(message.parts).length > 0 ||
                ratingsFromParts(message.parts).length > 0
              if (live && !hasText && !cardReady) return null
              const stored =
                chat?.messages.find((item) => item.id === message.id) ||
                previousRef.current.find((item) => item.id === message.id)
              const findings =
                message.role === "assistant"
                  ? findingsFromParts(message.parts).length > 0
                    ? findingsFromParts(message.parts)
                    : (stored?.findings ?? [])
                  : []
              const records =
                message.role === "assistant"
                  ? recordCardsFromParts(message.parts).length > 0
                    ? recordCardsFromParts(message.parts)
                    : (stored?.records ?? [])
                  : []
              const snapshots =
                message.role === "assistant"
                  ? snapshotsFromParts(message.parts).length > 0
                    ? snapshotsFromParts(message.parts)
                    : (stored?.snapshots ?? [])
                  : []
              const policies =
                message.role === "assistant"
                  ? policyDraftsFromParts(message.parts).length > 0
                    ? policyDraftsFromParts(message.parts)
                    : (stored?.policies ?? [])
                  : []
              const tasks =
                message.role === "assistant"
                  ? tasksFromParts(message.parts).length > 0
                    ? tasksFromParts(message.parts)
                    : (stored?.tasks ?? [])
                  : []
              const assignments =
                message.role === "assistant"
                  ? (assignmentsFromParts(message.parts).length > 0
                      ? assignmentsFromParts(message.parts)
                      : (stored?.assignments ?? [])
                    ).map((item) => {
                      const outcome = assignmentOutcomes[item.id]
                      return outcome
                        ? {
                            ...item,
                            status: outcome.status,
                            result: outcome.result,
                          }
                        : item
                    })
                  : []
              const proposals =
                message.role === "assistant"
                  ? (proposedFindingsFromParts(message.parts).length > 0
                      ? proposedFindingsFromParts(message.parts).map(
                          (item) => ({
                            ...item,
                            status: "pending" as const,
                            result: undefined as string | undefined,
                          })
                        )
                      : (stored?.proposedFindings ?? [])
                    ).map((item) => {
                      const outcome = findingOutcomes[item.id]
                      return outcome
                        ? {
                            ...item,
                            status: outcome.status,
                            result: outcome.result,
                          }
                        : item
                    })
                  : []
              const ratings =
                message.role === "assistant"
                  ? (ratingsFromParts(message.parts).length > 0
                      ? ratingsFromParts(message.parts).map((item) => ({
                          ...item,
                          status: "pending" as const,
                          result: undefined as string | undefined,
                        }))
                      : (stored?.ratings ?? [])
                    ).map((item) => {
                      const outcome = ratingOutcomes[item.id]
                      return outcome
                        ? {
                            ...item,
                            status: outcome.status,
                            result: outcome.result,
                          }
                        : item
                    })
                  : []
              const showSkeleton =
                snapshotPending(message.parts) && snapshots.length === 0
              const chips =
                message.role === "user" ? messageChips(message, stored) : []
              const caption = chips.map((chip) => chip.name).join(", ")
              const text = messageText(message.parts)
              const previous = messages[index - 1]
              const flaggedId =
                message.role === "assistant" && previous?.role === "user"
                  ? policyFlagId(messageText(previous.parts))
                  : null
              const laterUser = messages
                .slice(index + 1)
                .some((item) => item.role === "user")
              const showText = text.length > 0 && text !== caption
              const revision =
                policies.length > 0 || tasks.length > 0
                  ? policyRevisionTarget(
                      messages.map((item) => ({
                        role: item.role,
                        text: messageText(item.parts),
                      })),
                      index
                    )
                  : null
              return (
                <li
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto grid max-w-[min(100%,32rem)] justify-items-end gap-2"
                      : "max-w-3xl text-[15px] leading-7 text-foreground"
                  }
                >
                  <AssistantImagePreviews items={chips} />
                  {chips.some(
                    (chip) => !chip.mediaType.startsWith("image/")
                  ) ? (
                    <AssistantAttachmentChips
                      items={chips.filter(
                        (chip) => !chip.mediaType.startsWith("image/")
                      )}
                    />
                  ) : null}
                  {showText ? (
                    message.role === "user" ? (
                      <div className="rounded-2xl bg-secondary px-3.5 py-2 text-[15px] leading-6">
                        <p className="whitespace-pre-wrap">{text}</p>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{text}</p>
                    )
                  ) : null}
                  {findings.map((finding) => (
                    <AuditFindingCard
                      key={`${finding.area}-${finding.rating}-${finding.action}`}
                      finding={finding}
                    />
                  ))}
                  {proposals.map((item) =>
                    item.status === "cancelled" ? (
                      <p
                        key={item.id}
                        className="my-3 text-sm text-muted-foreground"
                      >
                        {item.result}
                      </p>
                    ) : item.status === "confirmed" ? (
                      <AuditFindingCard key={item.id} finding={item.finding} />
                    ) : (
                      <AuditFindingCard
                        key={item.id}
                        finding={item.finding}
                        pending
                        onConfirm={() => {
                          const next = {
                            ...findingRef.current,
                            [item.id]: {
                              status: "confirmed" as const,
                              result: "Recorded.",
                            },
                          }
                          findingRef.current = next
                          setFindingOutcomes(next)
                          persistRef.current(messagesRef.current)
                        }}
                        onCancel={() => {
                          const next = {
                            ...findingRef.current,
                            [item.id]: {
                              status: "cancelled" as const,
                              result: "Cancelled. Nothing was recorded.",
                            },
                          }
                          findingRef.current = next
                          setFindingOutcomes(next)
                          persistRef.current(messagesRef.current)
                        }}
                      />
                    )
                  )}
                  {ratings.map((item) => (
                    <AssistantRatingCard
                      key={item.id}
                      rating={item.rating}
                      summary={item.summary}
                      status={item.status}
                      result={item.result}
                      onConfirm={async () => {
                        const result = await confirmInterviewRating({
                          proposalId: item.proposalId,
                        })
                        if (result.error) return { error: result.error }
                        const next = {
                          ...ratingRef.current,
                          [item.id]: {
                            status: "done" as const,
                            result: result.message ?? ratingSavedResult,
                          },
                        }
                        ratingRef.current = next
                        setRatingOutcomes(next)
                        persistRef.current(messagesRef.current)
                        return {}
                      }}
                      onCancel={() => {
                        const next = {
                          ...ratingRef.current,
                          [item.id]: {
                            status: "cancelled" as const,
                            result: ratingCancelledResult,
                          },
                        }
                        ratingRef.current = next
                        setRatingOutcomes(next)
                        persistRef.current(messagesRef.current)
                        void cancelInterviewRating({
                          proposalId: item.proposalId,
                        }).catch((caught: unknown) => {
                          console.error(caught)
                        })
                      }}
                    />
                  ))}
                  {showSkeleton ? <AssistantSnapshotSkeleton /> : null}
                  {snapshots.map((snapshot, snapshotIndex) => (
                    <AssistantSnapshotCard
                      key={`${snapshot.kind}-${snapshotIndex}`}
                      snapshot={snapshot}
                      onAsk={ask}
                    />
                  ))}
                  {live
                    ? null
                    : records.map((card, cardIndex) => (
                        <AssistantRecordsCard
                          key={`${card.title}-${cardIndex}`}
                          card={card}
                          onAsk={ask}
                        />
                      ))}
                  {policies.map((policy) => (
                    <AssistantPolicyCard
                      key={policy.filename}
                      draft={policy}
                      standards={policyStandards}
                      revision={revision}
                      filed={
                        policyFilings[
                          policyFilingKey(message.id, policy.filename)
                        ] ?? policy.filed
                      }
                      onFile={
                        policyStandards.length > 0
                          ? (standardCode) =>
                              filePolicy(
                                message.id,
                                policy,
                                standardCode,
                                revision?.policyId ?? null
                              )
                          : undefined
                      }
                    />
                  ))}
                  {live
                    ? null
                    : tasks.map((task) => (
                        <AssistantTaskCard
                          key={task.id}
                          task={task}
                          outcome={outcomes[task.id]}
                          onConfirm={(item) =>
                            confirmTask(item, revision?.policyId ?? null)
                          }
                          onCancel={cancelTask}
                        />
                      ))}
                  {flaggedId && text && !live && !laterUser ? (
                    <PolicyComplianceChoice
                      policyId={flaggedId}
                      changes={text.slice(0, 2000)}
                      canAssign={canAssign}
                      onImplement={() => ask(policyRevisionPrompt)}
                    />
                  ) : null}
                  {assignments.map((assignment) => (
                    <AssistantAssignCard
                      key={assignment.id}
                      assignment={assignment}
                      onAssigned={(result) => {
                        const next = {
                          ...assignmentRef.current,
                          [assignment.id]: { status: "done" as const, result },
                        }
                        assignmentRef.current = next
                        setAssignmentOutcomes(next)
                        persistRef.current(messagesRef.current)
                      }}
                      onCancel={() => {
                        const next = {
                          ...assignmentRef.current,
                          [assignment.id]: {
                            status: "cancelled" as const,
                            result: "Cancelled. Nothing was assigned.",
                          },
                        }
                        assignmentRef.current = next
                        setAssignmentOutcomes(next)
                        persistRef.current(messagesRef.current)
                      }}
                    />
                  ))}
                </li>
              )
            })}
            {error && !upgrade ? (
              <li className="grid justify-items-start gap-2">
                <p className="text-sm text-destructive">{error.message}</p>
                <button
                  type="button"
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.04)] hover:bg-muted"
                  onClick={() => {
                    clearError()
                    void regenerate()
                  }}
                >
                  Retry
                </button>
              </li>
            ) : null}
            {showThinking ? (
              <li>
                <p className="assistant-thinking text-sm" aria-live="polite">
                  Thinking
                </p>
              </li>
            ) : null}
          </ul>
        ) : (
          <div className="flex h-full items-center justify-center px-4 pb-16">
            <div className="w-full max-w-2xl">
              <h1 className="text-center font-heading text-[1.75rem] font-medium tracking-tight">
                {audit ? "Internal audit" : "What can I help with?"}
              </h1>
              {audit ? (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  A check of what is actually happening, before an external
                  audit. Each gap comes back with a next action.
                </p>
              ) : null}
              {audit && auditChoices.length > 0 ? (
                <AuditChoice groups={auditChoices} onStart={startAudit} />
              ) : null}
              <div className="mt-6">
                {importCard}
                {upgrade ? (
                  <div className="mb-3">
                    <UpgradeNotice upgrade={upgrade} />
                  </div>
                ) : null}
                <Composer
                  input={input}
                  setInput={setInput}
                  busy={busy}
                  roomy
                  placeholder={composerPlaceholder(interview, audit, imports, false)}
                  attachments={composerChips(attachments)}
                  attachmentNames={attachments.map((item) => item.file.name)}
                  onAsk={submit}
                  onStop={() => stop()}
                  onRemove={removeAttachment}
                  onFiles={takeFiles}
                />
              </div>
              {audit && auditChoices.length > 0 ? null : (
                <AssistantSuggestions prompts={prompts} onPick={submit} />
              )}
            </div>
          </div>
        )}
      </div>
      {started ? (
        <div className="relative mx-auto w-full max-w-3xl px-4 pb-4">
          <div className="pointer-events-none absolute inset-x-4 -top-10 h-10 bg-gradient-to-t from-background to-transparent" />
          {upgrade ? (
            <div className="mb-2">
              <UpgradeNotice upgrade={upgrade} />
            </div>
          ) : notice ? (
            <p className="mb-2 text-center text-xs text-destructive">
              {notice}
            </p>
          ) : null}
          {importCard}
          <Composer
            input={input}
            setInput={setInput}
            busy={busy}
            placeholder={composerPlaceholder(interview, audit, imports, true)}
            attachments={composerChips(attachments)}
            attachmentNames={attachments.map((item) => item.file.name)}
            onAsk={submit}
            onStop={() => stop()}
            onRemove={removeAttachment}
            onFiles={takeFiles}
          />
        </div>
      ) : !upgrade && (notice || error) ? (
        <p className="pb-4 text-center text-xs text-destructive">
          {notice ?? error?.message}
        </p>
      ) : null}
    </div>
  )
}

function UpgradeNotice({ upgrade }: { upgrade: AssistantUpgrade }) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {upgrade.message}{" "}
      {upgrade.href ? (
        <Link
          href={upgrade.href}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {upgrade.label}
        </Link>
      ) : upgrade.label === "Upgrade" ? (
        "Ask an administrator to upgrade the plan."
      ) : null}
    </p>
  )
}

function Composer({
  input,
  setInput,
  busy,
  roomy = false,
  placeholder,
  attachments,
  attachmentNames,
  onAsk,
  onStop,
  onRemove,
  onFiles,
}: {
  input: string
  setInput: (value: string) => void
  busy: boolean
  roomy?: boolean
  placeholder: string
  attachments: AssistantAttachmentChip[]
  attachmentNames: string[]
  onAsk: (text: string) => void
  onStop: () => void
  onRemove: (id: string) => void
  onFiles: (files: File[], source: "paste" | "pick") => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onAsk(input)
      }}
      onDragOver={(event) => {
        event.preventDefault()
      }}
      onDrop={(event) => {
        event.preventDefault()
        void filesFromTransfer(event.dataTransfer).then((files) => {
          if (files.length > 0) onFiles(files, "pick")
        })
      }}
    >
      <div className="rounded-2xl border border-border bg-background shadow-[0_1px_1px_rgba(0,0,0,0.04)]">
        {attachments.length > 0 ? (
          <div className="px-3 pt-3">
            <AssistantAttachmentChips items={attachments} onRemove={onRemove} />
          </div>
        ) : null}
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onPaste={(event) => {
            const pasted = filesFromClipboard(event.clipboardData)
            if (pasted.length > 0) {
              event.preventDefault()
              onFiles(pasted, "paste")
              return
            }
            const text = event.clipboardData.getData("text/plain")
            if (!pasteAsAttachment(text)) return
            event.preventDefault()
            onFiles(
              [
                new File([text], pastedTextName(attachmentNames), {
                  type: "text/plain",
                }),
              ],
              "paste"
            )
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              onAsk(input)
            }
          }}
          placeholder={placeholder}
          disabled={busy}
          rows={roomy ? 2 : 1}
          aria-label="Message"
          className={`max-h-40 resize-none border-0 bg-transparent px-4 pt-3 pb-1 text-base leading-6 shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent ${
            roomy ? "min-h-16" : "min-h-10"
          }`}
        />
        <div className="flex items-center justify-between gap-1 px-2 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Attach a file"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip />
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            multiple
            accept="image/*,.pdf,.txt,.csv,.tsv,.md,.docx,application/pdf,text/plain,text/csv"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])]
              event.target.value = ""
              if (files.length > 0) onFiles(files, "pick")
            }}
          />
          {busy ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={onStop}
            >
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="rounded-full"
              aria-label="Send"
              disabled={!input.trim() && attachments.length === 0}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

function composerPlaceholder(
  interview: boolean,
  audit: boolean,
  imports: boolean,
  started: boolean
) {
  if (interview) return "Your answer"
  if (audit) return "What should we review?"
  if (imports) return "Ask anything, or paste a staff list"
  if (started) return "Reply"
  return "How can I help you today?"
}

function composerChips(items: ComposerFile[]): AssistantAttachmentChip[] {
  return items.map((item) => ({
    id: item.id,
    name: item.file.name,
    mediaType: item.file.type || "application/octet-stream",
    size: item.file.size,
    previewUrl: item.previewUrl,
  }))
}

function messageChips(
  message: UIMessage,
  stored?: AssistantStoredMessage
): AssistantAttachmentChip[] {
  const fromParts = message.parts.flatMap((part) => {
    if (part.type !== "file") return []
    return [
      {
        id: part.url,
        name: part.filename?.trim() || "Attachment",
        mediaType: part.mediaType,
        previewUrl: part.mediaType.startsWith("image/") ? part.url : null,
      },
    ]
  })
  if (fromParts.length > 0) return fromParts
  return (stored?.attachments ?? []).map((file) => ({
    id: `${file.name}-${file.mediaType}`,
    name: file.name,
    mediaType: file.mediaType,
    previewUrl:
      file.url && file.mediaType.startsWith("image/") ? file.url : null,
  }))
}

function releaseAttachments(items: readonly ComposerFile[]) {
  for (const item of items) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  }
}

async function loadPolicyFile(flag: { id: string; filename: string }) {
  const response = await fetch(`/api/policies/${flag.id}`)
  if (!response.ok) return null
  if (isOldWordFile(flag.filename)) return null
  const blob = await response.blob()
  if (blob.size < 1 || blob.size > attachmentByteLimit) return null
  return new File([blob], flag.filename, {
    type: blob.type || "application/octet-stream",
  })
}

function toFileList(files: File[]) {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  return data.files
}

function isStaffRoster(file: File) {
  if (file.name.startsWith(".") || isPastedTextName(file.name)) return false
  return /\.(csv|tsv|xlsx?)$/i.test(file.name)
}

function shouldImportNow(files: readonly File[]) {
  if (files.length === 0 || files.some((file) => file.name.startsWith(".")))
    return false
  if (files.every((file) => /\.(csv|tsv|txt|xlsx?)$/i.test(file.name)))
    return true
  return (
    files.length > attachmentCountLimit &&
    files.every((file) => /\.(pdf|png|jpe?g)$/i.test(file.name))
  )
}

function filesFromClipboard(data: DataTransfer) {
  const listed = [...data.files]
  if (listed.length > 0) return listed
  const files: File[] = []
  for (const item of data.items) {
    if (item.kind !== "file") continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}

type DropEntry = FileSystemEntry

function filesFromTransfer(transfer: DataTransfer): Promise<File[]> {
  const entries = [...transfer.items]
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is DropEntry => entry !== null)
  if (!entries.some((entry) => entry.isDirectory))
    return Promise.resolve([...transfer.files])
  return collectDropped(entries)
}

async function collectDropped(entries: DropEntry[]) {
  const files: File[] = []
  for (const entry of entries) {
    if (files.length >= 300) break
    await readDropped(entry, files)
  }
  return files.length > 0 ? files : []
}

function readDropped(entry: DropEntry, files: File[]): Promise<void> {
  if (files.length >= 300) return Promise.resolve()
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    return new Promise((resolve) => {
      fileEntry.file(
        (file) => {
          files.push(file)
          resolve()
        },
        () => resolve()
      )
    })
  }
  if (!entry.isDirectory) return Promise.resolve()
  const reader = (entry as FileSystemDirectoryEntry).createReader()
  return new Promise((resolve) => {
    const children: DropEntry[] = []
    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            void (async () => {
              for (const child of children) {
                if (files.length >= 300) break
                await readDropped(child, files)
              }
              resolve()
            })()
            return
          }
          children.push(...batch)
          readBatch()
        },
        () => resolve()
      )
    }
    readBatch()
  })
}
