"use client"

import { Cell, Pie, PieChart } from "recharts"

import { Chip, type ChipTone } from "@/components/chip"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const series = [
  { key: "compliant", label: "Compliant", tone: "green", fill: "#7BC96F" },
  { key: "lapsing", label: "Lapsing", tone: "yellow", fill: "#F5C451" },
  { key: "pending", label: "Pending review", tone: "orange", fill: "#F0A15A" },
  { key: "noncompliant", label: "Not compliant", tone: "red", fill: "#E57A72" },
] as const

type StatusKey = (typeof series)[number]["key"]

export function WorkforceChart({
  counts,
  active,
  onSelect,
}: {
  counts: Record<StatusKey, number>
  active?: string | null
  onSelect?: (key: StatusKey) => void
}) {
  const slices = series
    .map((item) => ({ ...item, count: counts[item.key] }))
    .filter((item) => item.count > 0)
  const config = Object.fromEntries(
    series.map((item) => [item.key, { label: item.label, color: item.fill }])
  )

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <h3 className="text-[15px] font-medium">Workforce status</h3>
        <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
          <span className="size-3.5 rounded-[4px] bg-[#3B6FD8]" aria-hidden />
          Workers
        </span>
      </div>
      <p className="px-4 pt-1 text-sm text-muted-foreground">
        Select a status to filter the lists below.
      </p>
      {slices.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
          No workers yet.
        </p>
      ) : (
        <ChartContainer
          config={config}
          className="mx-auto aspect-square w-full max-w-44"
          style={{ height: 168 }}
          initialDimension={{ width: 176, height: 168 }}
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel nameKey="key" />}
            />
            <Pie
              data={slices}
              dataKey="count"
              nameKey="label"
              innerRadius={0}
              outerRadius={68}
              stroke="transparent"
              paddingAngle={slices.length > 1 ? 2 : 0}
              onClick={(_slice, index) => {
                const item = slices[index]
                if (item) onSelect?.(item.key)
              }}
            >
              {slices.map((item) => (
                <Cell
                  key={item.key}
                  fill={item.fill}
                  opacity={active && active !== item.key ? 0.35 : 1}
                  className="cursor-pointer"
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      )}
      <div className="flex flex-wrap justify-center gap-1.5 px-3 pt-2 pb-3">
        {series.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect?.(item.key)}
            className="cursor-pointer"
          >
            <Chip
              tone={item.tone as ChipTone}
              className={
                active === item.key ? "ring-1 ring-foreground/30" : undefined
              }
            >
              {item.label} {counts[item.key]}
            </Chip>
          </button>
        ))}
      </div>
    </section>
  )
}
