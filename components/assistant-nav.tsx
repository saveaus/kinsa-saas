"use client"

import { ChevronRight, MoreHorizontal, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  archiveAssistantChat,
  deleteAssistantChat,
  renameAssistantChat,
} from "@/modules/assistant/actions"
import type { AssistantChatLink } from "@/modules/assistant/chats"

const recentKey = "kinsa-assistant-recent"

export function AssistantNav({
  chats,
  pathname,
}: {
  chats: AssistantChatLink[]
  pathname: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    setOpen(window.localStorage.getItem(recentKey) === "1")
  }, [])

  function setRecentOpen(next: boolean) {
    setOpen(next)
    window.localStorage.setItem(recentKey, next ? "1" : "0")
  }

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
    const href =
      chat.purpose === "internal_audit" ? `/audits/reviews/${chat.id}` : `/assistant/${chat.id}`
    if (pathname === href) {
      router.push(chat.purpose === "internal_audit" ? "/audits" : "/assistant")
    }
    router.refresh()
  }

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={pathname === "/assistant"}
          render={<Link href="/assistant" />}
        >
          <Sparkles />
          <span>Assistant</span>
        </SidebarMenuButton>
        <SidebarMenuAction
          aria-label={open ? "Hide chats" : "Show chats"}
          aria-expanded={open}
          className="group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 focus-visible:opacity-100 md:opacity-0 group-data-[collapsible=icon]:hidden"
          onClick={() => setRecentOpen(!open)}
        >
          <ChevronRight
            className={open ? "rotate-90 transition-transform" : "transition-transform"}
          />
        </SidebarMenuAction>
      </SidebarMenuItem>
      {open && chats.length === 0 ? (
        <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
          <p className="px-8 py-1 text-xs text-muted-foreground">No saved chats</p>
        </SidebarMenuItem>
      ) : null}
      {open
        ? chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              active={
                pathname ===
                (chat.purpose === "internal_audit"
                  ? `/audits/reviews/${chat.id}`
                  : `/assistant/${chat.id}`)
              }
              editing={editingId === chat.id}
              onEdit={() => setEditingId(chat.id)}
              onRename={(title) => rename(chat.id, title)}
              onCancel={() => setEditingId(null)}
              onArchive={() => void remove(chat, archiveAssistantChat)}
              onDelete={() => void remove(chat, deleteAssistantChat)}
            />
          ))
        : null}
    </>
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
      <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
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
            className="h-7 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          />
        </form>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
      <SidebarMenuButton
        className="h-7 pl-8 font-normal text-muted-foreground"
        isActive={active}
        tooltip={chat.title}
        render={
          <Link
            href={
              chat.purpose === "internal_audit"
                ? `/audits/reviews/${chat.id}`
                : `/assistant/${chat.id}`
            }
          />
        }
      >
        <span>{chat.title}</span>
      </SidebarMenuButton>
      {chat.locked ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${chat.title}`}
            render={<SidebarMenuAction />}
          >
            <MoreHorizontal />
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
    </SidebarMenuItem>
  )
}
