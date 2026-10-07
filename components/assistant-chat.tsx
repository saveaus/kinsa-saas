"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { ArrowUp, Paperclip } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  AssistantImport,
  type CertificateDraft,
  type StaffDraft,
} from "@/components/assistant-import"
import { AuditFindingCard } from "@/components/audit-finding"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { findingsFromParts } from "@/modules/internal-audits/conduct"
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
import { certificateCheckMessage, staffCheckMessage, teamLabel } from "@/modules/migration/speak"
import {
  clearAssistantDraft,
  readAssistantDraft,
  toStoredMessages,
  toUIMessages,
  type AssistantStoredMessage,
} from "@/modules/assistant/messages"

const suggestions = ["Generate me a new policy"]

const interviewSuggestions = [
  "I'm ready",
  "That's everything I have",
  "Can you ask that another way?",
]

const auditSuggestions = [
  "Start with the biggest gap",
  "Review worker screening and training",
  "Review incidents from report to close",
  "Review how complaints are handled",
]

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

export function AssistantChat({
  chat,
  mode,
  canImport = false,
}: {
  chat?: {
    id: string
    title: string
    messages: AssistantStoredMessage[]
    interviewAuditId?: string | null
    purpose?: "general" | "internal_audit"
  }
  mode?: "internal_audit"
  canImport?: boolean
}) {
  const interview = Boolean(chat?.interviewAuditId)
  const audit = !interview && (mode === "internal_audit" || chat?.purpose === "internal_audit")
  const prompts = interview ? interviewSuggestions : audit ? auditSuggestions : suggestions
  const router = useRouter()
  const pathname = usePathname()
  const [input, setInput] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const imports = canImport && !interview && !audit
  const chatId = chat?.id
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant",
        body: {
          ...(chatId ? { chatId } : {}),
          ...(audit ? { mode: "internal_audit" } : {}),
        },
      }),
    [audit, chatId]
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
    const stored = toStoredMessages(next)
    persistChain.current = persistChain.current.catch(() => undefined).then(async () => {
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
      if (!auditRef.current) return
      const result = await saveAssistantChat(stored, { purpose: "internal_audit" })
      if (result.error || !result.id) {
        persistFailed.current = true
        setNotice(result.error ?? "The review could not be saved.")
        return
      }
      savedId.current = result.id
      persistFailed.current = false
    })
  }
  const { messages, sendMessage, status, stop, error } = useChat({
    id: chat?.id,
    messages: chat ? toUIMessages(chat.messages) : undefined,
    transport,
    onFinish: ({ messages: next, isAbort, isError }) => {
      if (isAbort || isError) return
      persistRef.current(next)
    },
  })

  const startedDraft = useRef<string | null>(null)

  useEffect(() => {
    if (chat || pathname !== "/assistant") {
      startedDraft.current = null
      return
    }
    const draft = readAssistantDraft()
    if (!draft || startedDraft.current === draft || messages.length > 0) return
    startedDraft.current = draft
    void sendMessage({ text: draft })
  }, [chat, messages.length, pathname, sendMessage])

  useEffect(() => {
    const draft = readAssistantDraft()
    if (!draft) return
    const sent = messages.some(
      (message) =>
        message.role === "user" &&
        message.parts.some((part) => part.type === "text" && part.text.trim() === draft)
    )
    if (!sent) return
    const handle = window.setTimeout(() => clearAssistantDraft(), 0)
    return () => window.clearTimeout(handle)
  }, [messages])
  const busy = status === "submitted" || status === "streaming"

  useEffect(() => {
    if (chat || !audit || busy) return
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
  }, [audit, busy, chat, messages, router])

  const started = messages.length > 0
  const lastUser = [...messages]
    .reverse()
    .find((message) => message.role === "user")
  const lastUserText = lastUser
    ? lastUser.parts
        .flatMap((part) => (part.type === "text" ? [part.text] : []))
        .join("")
        .trim()
    : ""
  const followUps = prompts.filter((suggestion) => suggestion !== lastUserText)

  function ask(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setInput("")
    setNotice(null)
    void sendMessage({ text: trimmed })
  }

  async function openCertificates(files: File[]) {
    const preview = await previewCertificatesAction(files.map((file) => file.name))
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
    ask(certificateCheckMessage(described))
  }

  async function receiveFiles(list: File[]) {
    if (!imports || importing) return
    if (busy) {
      setNotice("Wait for the reply, then drop the file.")
      return
    }
    try {
      const spreadsheets = list.filter((file) => /\.xlsx?$/i.test(file.name))
      const rosters = list.filter((file) => /\.(csv|tsv)$/i.test(file.name) && !file.name.startsWith("."))
      const notes = list.filter((file) => /\.txt$/i.test(file.name) && !file.name.startsWith("."))
      const tooBig = list.filter(
        (file) => /\.(pdf|png|jpe?g)$/i.test(file.name) && file.size > 10 * 1024 * 1024
      )
      const evidence = list
        .filter(
          (file) =>
            /\.(pdf|png|jpe?g)$/i.test(file.name) &&
            !file.name.startsWith(".") &&
            file.size > 0 &&
            file.size <= 10 * 1024 * 1024
        )
        .slice(0, 80)
      const warning =
        tooBig.length > 0
          ? tooBig.length === 1
            ? `${tooBig[0]?.name ?? "A file"} is over 10 MB.`
            : `${tooBig.length} files are over 10 MB.`
          : spreadsheets.length > 0 && rosters.length === 0 && notes.length === 0
            ? "Save the spreadsheet as CSV and drop it again."
            : null
      const rosterFiles = rosters.length > 0 ? rosters : notes
      if (rosterFiles.length > 0) {
        const csv = (await Promise.all(rosterFiles.map((file) => file.text()))).join("\n")
        const preview = await previewStaffAction(csv)
        if (!("people" in preview)) {
          if (evidence.length === 0 || rosters.length > 0) {
            setNotice(preview.error ?? warning ?? "That file could not be read.")
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
          ask(
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
          if (warning) setNotice(warning)
          return
        }
      }
      if (evidence.length > 0) {
        setDone(null)
        await openCertificates(evidence)
        if (warning) setNotice(warning)
        return
      }
      if (warning) setNotice(warning)
    } catch (error) {
      console.error(error)
      setNotice("That file could not be read.")
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
        const added = result.added.length === 1 ? "1 worker added." : `${result.added.length} workers added.`
        const here = result.alreadyHere > 0 ? ` ${result.alreadyHere} already here.` : ""
        const missed = result.failed > 0 ? ` ${result.failed} could not be added.` : ""
        setDone(`${added}${here}${missed}`)
        if (held.length > 0) {
          await openCertificates(held)
          return
        }
        ask("The staff list is added.")
        return
      }
      let filed = 0
      const failed: string[] = []
      let remaining = pending.files
      try {
        while (remaining.length > 0) {
          const group = remaining.slice(0, 12)
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
              const count = filed === 1 ? "1 certificate filed." : `${filed} certificates filed.`
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
          const count = filed === 1 ? "1 certificate filed." : `${filed} certificates filed.`
          setDone(`${count} The rest are still in the list.`)
        }
        setNotice("Those records could not be added.")
        return
      }
      setPending(null)
      const count = filed === 1 ? "1 certificate filed." : `${filed} certificates filed.`
      const missed = failed.length > 0 ? ` ${failed.length} could not be saved.` : ""
      setDone(`${count}${missed} The assistant checks the ones it can read.`)
      ask("The certificates are filed.")
    } catch (error) {
      console.error(error)
      setNotice("Those records could not be added.")
    } finally {
      setImporting(false)
    }
  }

  const importCard = pending || done ? (
    <>
      {done ? <p className="mb-3 text-sm text-muted-foreground">{done}</p> : null}
      {pending ? (
    <AssistantImport
      staff={pending.kind === "staff" ? { people: pending.people, skipped: pending.skipped } : null}
      certificates={pending.kind === "certificates" ? pending.files : null}
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
              personIndex === index ? { ...person, roles: [role] } : person
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

  async function save() {
    setSaving(true)
    const result = await saveAssistantChat(toStoredMessages(messages))
    setSaving(false)
    if (result.error || !result.id) {
      setNotice(result.error ?? "The chat could not be saved.")
      return
    }
    router.push(`/assistant/${result.id}`)
    router.refresh()
  }

  return (
    <div data-assistant="" className="flex min-h-0 flex-1 flex-col bg-background">
      {started && !(audit && !chat) ? (
        <div className="flex h-12 shrink-0 items-center gap-2 px-4">
          {chat ? (
            <div className="flex min-w-0 items-center gap-3">
              <p className="max-w-sm truncate text-sm font-medium">{chat.title}</p>
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
          ) : audit ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={saving || busy}
              onClick={() => void save()}
            >
              Save
            </Button>
          )}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {started ? (
          <ul className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
            {messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[75%] rounded-3xl bg-muted px-4 py-2.5 text-sm"
                    : "max-w-3xl text-[15px] leading-7"
                }
              >
                {message.role === "assistant"
                  ? (findingsFromParts(message.parts).length > 0
                      ? findingsFromParts(message.parts)
                      : (chat?.messages.find((item) => item.id === message.id)?.findings ?? [])
                    ).map((finding) => (
                      <AuditFindingCard
                        key={`${finding.area}-${finding.rating}-${finding.action}`}
                        finding={finding}
                      />
                    ))
                  : null}
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <p key={index} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  ) : null
                )}
              </li>
            ))}
            {status === "submitted" ? (
              <li className="text-sm text-muted-foreground">Thinking</li>
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
                  A check of what is actually happening, before an external audit. Each gap comes back with a next action.
                </p>
              ) : null}
              <div className="mt-6">
                {importCard}
                <Composer
                  input={input}
                  setInput={setInput}
                  busy={busy}
                  placeholder={imports ? "Ask anything, or drop a staff list" : audit ? "What should we review?" : "Ask anything"}
                  onAsk={ask}
                  onStop={() => stop()}
                  allowFiles={imports}
                  onFiles={(files) => void receiveFiles(files)}
                />
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {prompts.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-full border bg-background px-3 py-1.5 text-sm hover:bg-muted"
                    onClick={() => ask(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {started ? (
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          {notice || error ? (
            <p className="mb-2 text-center text-xs text-destructive">
              {notice ?? error?.message}
            </p>
          ) : null}
          {!busy && followUps.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {followUps.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border bg-background px-3 py-1.5 text-sm hover:bg-muted"
                  onClick={() => ask(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
          {importCard}
          <Composer
            input={input}
            setInput={setInput}
            busy={busy}
            placeholder={interview ? "Your answer" : imports ? "Ask anything, or drop a staff list" : audit ? "What should we review?" : "Ask anything"}
            onAsk={ask}
            onStop={() => stop()}
            allowFiles={imports}
            onFiles={(files) => void receiveFiles(files)}
          />
        </div>
      ) : notice || error ? (
        <p className="pb-4 text-center text-xs text-destructive">
          {notice ?? error?.message}
        </p>
      ) : null}
    </div>
  )
}

function Composer({
  input,
  setInput,
  busy,
  placeholder,
  onAsk,
  onStop,
  allowFiles = false,
  onFiles,
}: {
  input: string
  setInput: (value: string) => void
  busy: boolean
  placeholder: string
  onAsk: (text: string) => void
  onStop: () => void
  allowFiles?: boolean
  onFiles?: (files: File[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onAsk(input)
      }}
      onDragOver={(event) => {
        if (!allowFiles) return
        event.preventDefault()
      }}
      onDrop={(event) => {
        if (!allowFiles || !onFiles) return
        event.preventDefault()
        void filesFromTransfer(event.dataTransfer).then((files) => {
          if (files.length > 0) onFiles(files)
        })
      }}
    >
      <div className="rounded-[1.75rem] border bg-background px-3 py-2 shadow-sm">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              onAsk(input)
            }
          }}
          placeholder={placeholder}
          disabled={busy}
          rows={1}
          aria-label="Message"
          className="min-h-12 resize-none border-0 bg-transparent px-2 py-1.5 text-base shadow-none focus-visible:ring-0 md:text-base"
        />
        <div className="flex items-center justify-between">
          {allowFiles ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Attach a staff list or certificates"
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
                accept=".csv,.tsv,.txt,.pdf,.png,.jpg,.jpeg,text/csv,application/pdf,image/png,image/jpeg"
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])]
                  event.target.value = ""
                  if (files.length > 0) onFiles?.(files)
                }}
              />
            </>
          ) : (
            <span />
          )}
          {busy ? (
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onStop}>
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="rounded-full"
              aria-label="Send"
              disabled={!input.trim()}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

type DropEntry = FileSystemEntry

function filesFromTransfer(transfer: DataTransfer): Promise<File[]> {
  const entries = [...transfer.items]
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is DropEntry => entry !== null)
  if (!entries.some((entry) => entry.isDirectory)) return Promise.resolve([...transfer.files])
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
