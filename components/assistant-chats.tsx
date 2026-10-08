"use client"

import { ChevronRight, MoreHorizontal, SquarePen } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { cn } from "cn"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  archiveAssistantChat,
  deleteAssistantChat,
  renameAssistantChat,
} from "@/modules/assistant/actions"
import type { AssistantChatLink } from "@/modules/assistant/chats"

const storageKey = "kinsa-assistant-chat-groups"
const groupOrder = ["Today", "Yesterday", "Previous 7 days", "Older"] as const
type ChatGroup = (typeof groupOrder)[number]

function chatHref(chat: AssistantChatLink) {
  return chat.purpose === "internal_audit"
    ? `/audits/reviews/${chat.id}`
    : `/assistant/${chat.id}`
}

function startOfDay(now: Date, daysAgo: number) {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return date
}

function chatGroup(updatedAt: string, now: Date): ChatGroup {
  const updated = new Date(updatedAt)
  if (updated >= startOfDay(now, 0)) return "Today"
  if (updated >= startOfDay(now, 1)) return "Yesterday"
  if (updated >= startOfDay(now, 7)) return "Previous 7 days"
  return "Older"
}

function groupChats(chats: AssistantChatLink[], now: Date) {
  const grouped = new Map<ChatGroup, AssistantChatLink[]>()
  for (const chat of chats) {
    const label = chatGroup(chat.updatedAt, now)
    const list = grouped.get(label) ?? []
    list.push(chat)
    grouped.set(label, list)
  }
  return groupOrder
    .filter((label) => grouped.has(label))
    .map((label) => ({ label, chats: grouped.get(label) ?? [] }))
}

function readGroupOpen(group: string) {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === "object" && group in parsed) {
      return Boolean((parsed as Record<string, unknown>)[group])
    }
  } catch {
    return true
  }
  return true
}

function writeGroupOpen(group: string, open: boolean) {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    const stored =
      parsed && typeof parsed === "object"
        ? { ...(parsed as Record<string, boolean>) }
        : {}
    stored[group] = open
    localStorage.setItem(storageKey, JSON.stringify(stored))
  } catch {
    return
  }
}

export function AssistantChats({ chats }: { chats: AssistantChatLink[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sections, setSections] = useState<{ label: string; chats: AssistantChatLink[] }[]>(
    () => [{ label: "Your chats", chats }]
  )

  useEffect(() => {
    const grouped = groupChats(chats, new Date())
    setSections(grouped.length > 0 ? grouped : [{ label: "Your chats", chats: [] }])
  }, [chats])

  async function rename(id: string, title: string) {
    setEditingId(null)
    const result = await renameAssistantChat(id, title)
    if (!result.error) router.refresh()
  }

  async function remove(
    chat: AssistantChatLink,
    action: (chatId: string) => Promise<{ error?: string }>
  ) {
    const result = await action(chat.id)
    if (result.error) return
    if (pathname === chatHref(chat)) {
      router.push(chat.purpose === "internal_audit" ? "/audits" : "/assistant")
    }
    router.refresh()
  }

  return (
    <nav
      aria-label="Assistant"
      className="grid min-w-0 max-h-52 content-start gap-3 overflow-x-hidden overflow-y-auto border-b px-3 py-4 md:max-h-none md:border-r md:border-b-0"
    >
      <p className="px-2 text-sm font-medium">Assistant</p>
      <Link
        href="/assistant"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted",
          pathname === "/assistant" && "bg-muted font-medium text-foreground"
        )}
        aria-current={pathname === "/assistant" ? "page" : undefined}
      >
        <SquarePen className="size-4 shrink-0 text-muted-foreground" />
        New chat
      </Link>
      {sections.map((section) => (
        <ChatGroup
          key={section.label}
          label={section.label}
          chats={section.chats}
          pathname={pathname}
          editingId={editingId}
          onEdit={setEditingId}
          onRename={(id, title) => rename(id, title)}
          onCancel={() => setEditingId(null)}
          onArchive={(chat) => void remove(chat, archiveAssistantChat)}
          onDelete={(chat) => void remove(chat, deleteAssistantChat)}
        />
      ))}
    </nav>
  )
}

function ChatGroup({
  label,
  chats,
  pathname,
  editingId,
  onEdit,
  onRename,
  onCancel,
  onArchive,
  onDelete,
}: {
  label: string
  chats: AssistantChatLink[]
  pathname: string
  editingId: string | null
  onEdit: (id: string) => void
  onRename: (id: string, title: string) => void
  onCancel: () => void
  onArchive: (chat: AssistantChatLink) => void
  onDelete: (chat: AssistantChatLink) => void
}) {
  const containsActive = chats.some((chat) => pathname === chatHref(chat))
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(containsActive || readGroupOpen(label))
  }, [containsActive, label])

  function toggle() {
    const next = !open
    setOpen(next)
    writeGroupOpen(label, next)
  }

  return (
    <div className="grid min-w-0 gap-0.5">
      <button
        type="button"
        className="flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        onClick={toggle}
      >
        <ChevronRight
          className={cn("size-3 shrink-0 transition-transform", open && "rotate-90")}
        />
        {label}
      </button>
      {open && chats.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">No saved chats</p>
      ) : null}
      {open
        ? chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              active={pathname === chatHref(chat)}
              editing={editingId === chat.id}
              onEdit={() => onEdit(chat.id)}
              onRename={(title) => onRename(chat.id, title)}
              onCancel={onCancel}
              onArchive={() => onArchive(chat)}
              onDelete={() => onDelete(chat)}
            />
          ))
        : null}
    </div>
  )
}

function ChatRow({
  chat,
  active,
  editing,
  onEdit,
  onRename,
  onCancel,
  onArchive,
  onDelete,
}: {
  chat: AssistantChatLink
  active: boolean
  editing: boolean
  onEdit: () => void
  onRename: (title: string) => void
  onCancel: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const [value, setValue] = useState(chat.title)
  const skipRename = useRef(false)

  useEffect(() => {
    setValue(chat.title)
  }, [chat.title])

  if (editing) {
    return (
      <form
        className="px-2 py-0.5"
        onSubmit={(event) => {
          event.preventDefault()
          onRename(value)
        }}
      >
        <input
          value={value}
          autoFocus
          aria-label="Chat name"
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            if (skipRename.current) {
              skipRename.current = false
              return
            }
            onRename(value)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              skipRename.current = true
              onCancel()
            }
          }}
          className="h-7 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>
    )
  }

  return (
    <div
      className={cn(
        "group relative flex min-w-0 items-center overflow-hidden rounded-md hover:bg-muted",
        active && "bg-muted"
      )}
    >
      <Link
        href={chatHref(chat)}
        title={chat.title}
        className={cn(
          "block w-full min-w-0 truncate py-1.5 pr-7 pl-2 text-sm text-foreground/80",
          active && "font-medium text-foreground"
        )}
        aria-current={active ? "page" : undefined}
      >
        {chat.title}
      </Link>
      {chat.locked ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${chat.title}`}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-1 text-muted-foreground opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem onClick={onEdit}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>Archive</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
