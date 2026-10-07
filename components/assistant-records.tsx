"use client"

import { ArrowUpRight, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Chip, type ChipTone } from "@/components/chip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { AssistantRecordCard, AssistantRecordItem } from "@/modules/assistant/records"
import { packStatusLabel, type PackStatus } from "@/modules/audit-pack/score"

const minimisedFrom = 4

function recordTone(status: PackStatus): ChipTone {
  switch (status) {
    case "met":
      return "green"
    case "lapsing":
      return "yellow"
    case "missing":
      return "red"
    case "overdue":
      return "red"
    case "unaccepted":
      return "gray"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

function RecordRows({
  items,
  onAsk,
}: {
  items: AssistantRecordItem[]
  onAsk: (text: string) => void
}) {
  return (
    <ul className="px-1.5 pt-1 pb-1.5">
      {items.map((item) => (
        <li
          key={`${item.href}-${item.label}`}
          className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-muted/60"
        >
          <Link href={item.href} className="min-w-0 flex-1">
            <span className="block truncate text-sm">{item.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
          </Link>
          <Chip tone={recordTone(item.status)}>{packStatusLabel(item.status)}</Chip>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => onAsk(`What should I do about ${item.label}?`)}
          >
            Ask
          </button>
        </li>
      ))}
    </ul>
  )
}

export function AssistantRecordsCard({
  card,
  onAsk,
}: {
  card: AssistantRecordCard
  onAsk: (text: string) => void
}) {
  const more = card.matched - card.items.length
  const minimise = card.items.length >= minimisedFrom
  const [open, setOpen] = useState(!minimise)
  const count = card.matched === 1 ? "1 record" : `${card.matched} records`

  return (
    <div className="my-3 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in duration-300">
      {minimise ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <CollapsibleTrigger className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-aria-expanded:rotate-90" />
              <span className="truncate text-[13px] font-medium">{card.title}</span>
              <span className="shrink-0 text-[13px] text-muted-foreground">{count}</span>
            </CollapsibleTrigger>
            <Link
              href="/reports"
              className="inline-flex shrink-0 items-center gap-0.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              Evidence
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden border-t transition-[height] duration-150 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
            <RecordRows items={card.items} onAsk={onAsk} />
            {more > 0 ? (
              <Link
                href="/reports"
                className="flex border-t px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                {more === 1 ? "1 more in Evidence" : `${more} more in Evidence`}
              </Link>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
            <p className="text-[13px] font-medium text-muted-foreground">{card.title}</p>
            <Link
              href="/reports"
              className="inline-flex items-center gap-0.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              Evidence
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {card.items.length > 0 ? (
            <RecordRows items={card.items} onAsk={onAsk} />
          ) : (
            <p className="px-4 pt-2 pb-3 text-sm text-muted-foreground">
              Nothing on the evidence pack matches.
            </p>
          )}
          {more > 0 ? (
            <Link
              href="/reports"
              className="flex border-t px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              {more === 1 ? "1 more in Evidence" : `${more} more in Evidence`}
            </Link>
          ) : null}
        </>
      )}
    </div>
  )
}
