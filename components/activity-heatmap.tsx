import Link from "next/link"

import { cn } from "cn"
import {
  activityLevel,
  buildActivityWeeks,
  formatActivityDay,
  monthLabelsForWeeks,
} from "@/modules/audit/activity-calendar"

const LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/20",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
] as const

const ACTOR_FILTERS = [
  { value: "", label: "All" },
  { value: "admin", label: "Admin" },
  { value: "worker", label: "Worker" },
] as const

function activityHref(opts: { actor?: string; day?: string | null; all?: boolean }) {
  const query = new URLSearchParams()
  if (opts.actor) query.set("actor", opts.actor)
  if (opts.day) query.set("day", opts.day)
  if (opts.all) query.set("all", "1")
  const text = query.toString()
  return text ? `/activity?${text}` : "/activity"
}

export function ActivityHeatmap({
  counts,
  actor,
  selectedDay,
  showAll,
}: {
  counts: Record<string, number>
  actor?: string
  selectedDay?: string | null
  showAll?: boolean
}) {
  const { weeks, weekdayLabels } = buildActivityWeeks(counts)
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const max = Math.max(0, ...Object.values(counts))
  const months = monthLabelsForWeeks(weeks)
  const actorValue = actor ?? ""

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div>
          <p className="text-sm text-muted-foreground">Activity</p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">
            {total.toLocaleString("en-AU")}
          </p>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
          {ACTOR_FILTERS.map((item) => {
            const active = actorValue === item.value
            return (
              <Link
                key={item.label}
                href={activityHref({
                  actor: item.value || undefined,
                  day: selectedDay,
                  all: showAll,
                })}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="overflow-x-auto px-4 pb-2 pt-4 sm:px-5">
        <div className="inline-block min-w-full">
          <div
            className="mb-1 grid gap-[3px]"
            style={{ gridTemplateColumns: `1.25rem repeat(${weeks.length}, minmax(0, 1fr))` }}
          >
            <span />
            {weeks.map((_, index) => {
              const label = months.find((month) => month.index === index)
              return (
                <span key={index} className="text-[10px] leading-none text-muted-foreground">
                  {label?.label ?? ""}
                </span>
              )
            })}
          </div>

          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `1.25rem repeat(${weeks.length}, minmax(0, 1fr))` }}
          >
            {weekdayLabels.map((label, row) => (
              <div key={label} className="contents">
                <span className="flex h-[11px] items-center text-[10px] leading-none text-muted-foreground">
                  {row === 0 || row === 2 || row === 4 ? label[0] : ""}
                </span>
                {weeks.map((week) => {
                  const cell = week[row]
                  if (!cell || cell.future) {
                    return <span key={`${row}-${week[0]?.date ?? row}`} className="aspect-square" />
                  }
                  const level = activityLevel(cell.count, max)
                  const selected = selectedDay === cell.date
                  const href = activityHref({
                    actor: actorValue || undefined,
                    day: selected ? null : cell.date,
                    all: showAll,
                  })
                  return (
                    <Link
                      key={cell.date}
                      href={href}
                      title={`${formatActivityDay(cell.date)} · ${cell.count} event${cell.count === 1 ? "" : "s"}`}
                      aria-label={`${formatActivityDay(cell.date)}, ${cell.count} events${selected ? ", selected" : ""}`}
                      aria-pressed={selected}
                      className={cn(
                        "aspect-square rounded-[3px] transition-[box-shadow,transform] hover:ring-1 hover:ring-foreground/40",
                        LEVEL_CLASS[level],
                        selected && "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Fewer</span>
          {LEVEL_CLASS.map((tone, index) => (
            <span key={tone} className={cn("size-2.5 rounded-[3px]", tone)} title={`Level ${index}`} />
          ))}
          <span>More</span>
        </div>
        {selectedDay ? (
          <Link
            href={activityHref({ actor: actorValue || undefined, all: showAll })}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Show all activity
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">Select a day to filter activity</p>
        )}
      </div>
    </section>
  )
}
