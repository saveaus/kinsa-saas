"use client"

import { ArrowUpRight, ChevronRight, Shield } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { AttioReport } from "@/components/attio-report"
import { Chip, type ChipTone } from "@/components/chip"
import { ComplianceGraph } from "@/components/compliance-graph"
import { ItemStatusBadge } from "@/components/status-badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { AssistantSnapshot, AssistantWorkerSnapshot } from "@/modules/assistant/snapshots"

const minimisedFrom = 4

function StepButtons({
  actions,
  onAsk,
}: {
  actions: { label: string; ask: string }[]
  onAsk?: (text: string) => void
}) {
  if (!onAsk || actions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 border-t px-4 py-2.5">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="rounded-full border border-border bg-background px-3 py-1 text-[13px] text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.04)] hover:bg-muted"
          onClick={() => onAsk(action.ask)}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

function WorkerComplianceSnapshot({
  snapshot,
  onAsk,
}: {
  snapshot: AssistantWorkerSnapshot
  onAsk?: (text: string) => void
}) {
  const minimise = snapshot.points.length >= minimisedFrom
  const [open, setOpen] = useState(!minimise)
  const more = snapshot.totalPoints - snapshot.points.length
  const count =
    snapshot.totalPoints === 1 ? "1 requirement" : `${snapshot.totalPoints} requirements`

  const rows = (
    <ul>
      {snapshot.points.map((point) => (
        <li key={`${point.label}-${point.status}`}>
          <Link
            href={snapshot.href}
            className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
          >
            <Shield className="size-3.5 text-muted-foreground" />
            <span className="truncate">{point.label}</span>
            <ItemStatusBadge status={point.status} />
          </Link>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="my-3 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{snapshot.name}</p>
          <p className="text-xs text-muted-foreground">Compliance</p>
        </div>
        <Link
          href={snapshot.href}
          className="inline-flex shrink-0 items-center gap-0.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          Profile
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      <ComplianceGraph percent={snapshot.percent} score={snapshot.score} />
      {snapshot.points.length === 0 ? (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">
          Nothing is required for these roles.
        </p>
      ) : minimise ? (
        <Collapsible open={open} onOpenChange={setOpen} className="border-t">
          <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-aria-expanded:rotate-90" />
            <span className="text-[13px] font-medium">Requirements</span>
            <span className="text-[13px] text-muted-foreground">{count}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-150 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
            <div className="px-2 pb-2">{rows}</div>
            {more > 0 ? (
              <Link
                href={snapshot.href}
                className="flex border-t px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                {more === 1 ? "1 more on the profile" : `${more} more on the profile`}
              </Link>
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="border-t px-2 py-1">{rows}</div>
      )}
      <StepButtons
        onAsk={onAsk}
        actions={[
          { label: "What's missing?", ask: `What is still missing for ${snapshot.name}?` },
          {
            label: "Draft a policy",
            ask: `Draft a policy for the biggest gap in ${snapshot.name}'s compliance.`,
          },
        ]}
      />
    </div>
  )
}

function reportActions(title: string) {
  switch (title) {
    case "Audit readiness":
      return [{ label: "What should I do first?", ask: "What should I do first?" }]
    case "Open items":
      return [{ label: "Biggest gap", ask: "What should I do about the biggest gap?" }]
    case "By area":
      return [{ label: "Draft a policy", ask: "Draft a policy for the biggest gap." }]
    default:
      return [{ label: "What should I do first?", ask: "What should I do first?" }]
  }
}

function ChoiceList({
  snapshot,
  onAsk,
}: {
  snapshot: Extract<AssistantSnapshot, { kind: "choices" }>
  onAsk?: (text: string) => void
}) {
  return (
    <div className="my-3 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in duration-300">
      <p className="px-4 pt-3 text-[13px] font-medium">{snapshot.title}</p>
      <ul className="px-2 py-2">
        {snapshot.people.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/60"
              onClick={() => onAsk?.(`Show me the compliance health for worker ${person.id}`)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{person.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{person.team}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums">{person.percent}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecordSnapshot({
  title,
  meta,
  href,
  hrefLabel,
  standing,
  tone,
  body,
  note,
  actions,
  onAsk,
}: {
  title: string
  meta?: string
  href: string
  hrefLabel: string
  standing?: string
  tone?: ChipTone
  body: string
  note?: string
  actions: { label: string; ask: string }[]
  onAsk?: (text: string) => void
}) {
  return (
    <div className="my-3 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{title}</p>
          {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {standing && tone ? <Chip tone={tone}>{standing}</Chip> : null}
          <Link
            href={href}
            className="inline-flex items-center gap-0.5 text-[13px] text-muted-foreground hover:text-foreground"
          >
            {hrefLabel}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
      <p className="px-4 pt-3 text-sm leading-6">{body}</p>
      {note ? <p className="px-4 pt-1 pb-3 text-sm leading-6 text-muted-foreground">{note}</p> : <div className="pb-3" />}
      <StepButtons actions={actions} onAsk={onAsk} />
    </div>
  )
}

export function AssistantSnapshotSkeleton() {
  return (
    <div className="my-3 animate-pulse overflow-hidden rounded-2xl border bg-card shadow-sm" aria-hidden>
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="grid gap-2">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="h-2 w-20 rounded bg-muted" />
        </div>
        <div className="h-3 w-14 rounded bg-muted" />
      </div>
      <div className="mx-auto my-4 size-40 rounded-full border-8 border-muted" />
      <div className="mx-auto mb-4 h-2 w-40 rounded bg-muted" />
    </div>
  )
}

export function AssistantSnapshotCard({
  snapshot,
  onAsk,
}: {
  snapshot: AssistantSnapshot
  onAsk?: (text: string) => void
}) {
  switch (snapshot.kind) {
    case "worker":
      return <WorkerComplianceSnapshot snapshot={snapshot} onAsk={onAsk} />
    case "report":
      return (
        <div className="my-3 max-w-md animate-in fade-in duration-300">
          <AttioReport report={snapshot.report} href={snapshot.href} flow />
          <StepButtons actions={reportActions(snapshot.report.title)} onAsk={onAsk} />
        </div>
      )
    case "choices":
      return <ChoiceList snapshot={snapshot} onAsk={onAsk} />
    case "participant":
      return (
        <div className="my-3 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start justify-between gap-3 px-4 pt-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{snapshot.name}</p>
              <p className="text-xs text-muted-foreground">NDIS {snapshot.ndis}</p>
            </div>
            <Link
              href={snapshot.href}
              className="inline-flex shrink-0 items-center gap-0.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              Profile
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <ul className="px-2 py-2">
            {snapshot.rows.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm"
              >
                <span>{row.label}</span>
                <Chip tone={row.tone}>{row.standing}</Chip>
              </li>
            ))}
          </ul>
          <StepButtons
            onAsk={onAsk}
            actions={[
              { label: "What's missing?", ask: `What is still missing for ${snapshot.name}?` },
            ]}
          />
        </div>
      )
    case "policy":
      return (
        <RecordSnapshot
          title={snapshot.name}
          href={snapshot.href}
          hrefLabel="Policy"
          standing={snapshot.standing}
          tone={snapshot.tone}
          body={snapshot.excerpt}
          onAsk={onAsk}
          actions={[{ label: "What should I do?", ask: `What should I do about ${snapshot.name}?` }]}
        />
      )
    case "register":
      return (
        <RecordSnapshot
          title={snapshot.title}
          href={snapshot.href}
          hrefLabel="Open"
          standing={snapshot.standing}
          tone={snapshot.tone}
          body={snapshot.summary}
          note={snapshot.action}
          onAsk={onAsk}
          actions={[{ label: "What happens next?", ask: `What should I do about this ${snapshot.title.toLowerCase()}?` }]}
        />
      )
    default: {
      const unreachable: never = snapshot
      return unreachable
    }
  }
}
