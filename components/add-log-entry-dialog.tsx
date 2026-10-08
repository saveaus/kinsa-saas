"use client"

import { Calendar, FileText, Plus, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

import { cn } from "cn"
import { ActionForm } from "@/components/action-form"
import { LogPersonField, type LogPersonOption } from "@/components/log-person-field"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveLogEntryAction } from "@/modules/logs/actions"

export function AddLogEntryDialog({
  registerId,
  people,
  today,
}: {
  registerId: string
  people: LogPersonOption[]
  today: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [due, setDue] = useState("")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setDue("")
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus />
        Add entry
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add entry</DialogTitle>
          <DialogDescription>
            A due date puts this entry in Today&apos;s check. A reminder emails
            administrators on that date.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={saveLogEntryAction.bind(null, registerId)}
          submitLabel="Save"
          pendingLabel="Saving..."
          className="grid gap-3"
          onSuccess={() => {
            setOpen(false)
            setDue("")
            router.refresh()
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="entry-name">Name</Label>
            <Input id="entry-name" name="name" required maxLength={160} />
          </div>
          <div className="grid gap-1.5">
            <Label>Person record</Label>
            <LogPersonField people={people} name="people" multiple />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="entry-created">Created date</Label>
            <DateField id="entry-created" name="occurred_on" required defaultValue={today} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="entry-due">Due date</Label>
            <DateField
              id="entry-due"
              name="due_on"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="remind"
              disabled={due.length === 0}
              className="size-4 accent-primary"
            />
            Remind administrators
          </label>
          <AttachmentDrop key={open ? "open" : "closed"} />
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

function DateField({
  id,
  name,
  required,
  defaultValue,
  value,
  onChange,
}: {
  id: string
  name: string
  required?: boolean
  defaultValue?: string
  value?: string
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div className="relative min-w-0">
      <Input
        ref={ref}
        id={id}
        name={name}
        type="date"
        required={required}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        className="pr-8 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:opacity-0"
      />
      <button
        type="button"
        aria-label={`Choose ${name === "due_on" ? "due" : "created"} date`}
        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
        onClick={() => {
          const input = ref.current
          if (!input) return
          try {
            input.showPicker()
          } catch {
            input.focus()
          }
        }}
      >
        <Calendar className="size-3.5" />
      </button>
    </div>
  )
}

const attachmentLimit = 8

type StagedFile = { id: string; file: File }

function AttachmentDrop() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [files, setFiles] = useState<StagedFile[]>([])

  function sync(next: StagedFile[]) {
    const input = inputRef.current
    if (!input) return
    const transfer = new DataTransfer()
    for (const item of next) transfer.items.add(item.file)
    input.files = transfer.files
    setFiles(next)
  }

  function add(incoming: File[]) {
    const seen = new Set(files.map((item) => fileKey(item.file)))
    const next = [...files]
    for (const file of incoming) {
      const key = fileKey(file)
      if (seen.has(key)) continue
      if (next.length >= attachmentLimit) break
      seen.add(key)
      next.push({ id: crypto.randomUUID(), file })
    }
    sync(next)
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor="entry-files">Attachments</Label>
      <label
        htmlFor="entry-files"
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          add([...event.dataTransfer.files])
        }}
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#D5D8DE] bg-[#F7F8FA] px-4 py-5 text-center dark:border-border dark:bg-muted/30",
          over && "border-[#B7BCC4] bg-[#F1F2F4] dark:bg-muted/50",
          files.length > 0 && "min-h-20 py-4"
        )}
      >
        <Upload className="size-4 text-muted-foreground" />
        <span className="text-sm text-foreground/80">
          Drop files here, or click to choose
        </span>
        <span className="text-xs text-muted-foreground">
          PDF, JPEG, or PNG. Up to 8 files.
        </span>
        <input
          ref={inputRef}
          id="entry-files"
          name="files"
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
          className="sr-only"
          onChange={(event) => {
            const picked = [...(event.target.files ?? [])]
            event.target.value = ""
            add(picked)
          }}
        />
      </label>
      {files.length > 0 ? (
        <ul className="grid min-w-0 gap-1.5">
          {files.map((item) => (
            <li key={item.id} className="min-w-0">
              <Attachment size="sm" className="w-full min-w-0 flex-nowrap">
                <AttachmentMedia>
                  <FileText />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle title={item.file.name}>{item.file.name}</AttachmentTitle>
                  <AttachmentDescription>{fileMeta(item.file)}</AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    type="button"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => sync(files.filter((file) => file.id !== item.id))}
                  >
                    <X />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function fileMeta(file: File) {
  return `${fileKind(file)} · ${formatBytes(file.size)}`
}

function fileKind(file: File) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "PDF"
  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) return "PNG"
  if (
    file.type === "image/jpeg" ||
    file.name.toLowerCase().endsWith(".jpg") ||
    file.name.toLowerCase().endsWith(".jpeg")
  ) {
    return "JPEG"
  }
  return "File"
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  const megabytes = size / (1024 * 1024)
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`
}
