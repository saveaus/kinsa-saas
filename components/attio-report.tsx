"use client"

import Link from "next/link"
import { useId, useState, type MouseEvent } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ReportModel } from "@/modules/analytics/reports"

function pieSlices(report: ReportModel) {
  const key = report.series[0]?.key ?? "count"
  const fallback = report.series[0]?.color ?? "var(--primary)"
  return report.data.map((row, index) => ({
    label: String(row.label),
    value: Number(row[key] ?? 0),
    color: report.sliceColors?.[index] ?? fallback,
  }))
}

function chartConfig(report: ReportModel): ChartConfig {
  return Object.fromEntries(
    report.series.map((item) => [
      item.key,
      { label: item.label, color: item.color },
    ])
  )
}

export function AttioReport({
  report,
  height = 168,
  href,
  flow = false,
}: {
  report: ReportModel
  height?: number
  href?: string
  flow?: boolean
}) {
  const title = href ? (
    <Link href={href} className="hover:underline">
      {report.title}
    </Link>
  ) : (
    report.title
  )

  const contained = report.chart === "breakdown" && !flow
  const section = (
    <section
      id={report.id}
      className={
        contained
          ? "flex scroll-mt-6 flex-col overflow-hidden rounded-xl border bg-card lg:absolute lg:inset-0"
          : "flex scroll-mt-6 flex-col overflow-hidden rounded-xl border bg-card"
      }
    >
      {report.figure ? (
        <div className="px-4 pt-4">
          <h3 className="text-[13px] font-medium text-muted-foreground">
            {title}
          </h3>
          <p className="mt-1 font-heading text-[28px] leading-none font-medium tracking-tight tabular-nums">
            {report.figure}
          </p>
          {report.caption ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {report.caption}
            </p>
          ) : null}
        </div>
      ) : (
        <h3 className="px-4 pt-4 text-[15px] font-medium">{title}</h3>
      )}
      {contained ? (
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <ReportFigure report={report} height={height} />
        </div>
      ) : (
        <div className="flex min-h-48 flex-col">
          <ReportFigure report={report} height={height} />
        </div>
      )}
    </section>
  )

  if (!contained) return section
  return <div className="relative lg:min-h-0">{section}</div>
}

function ReportFigure({
  report,
  height,
}: {
  report: ReportModel
  height: number
}) {
  switch (report.chart) {
    case "pie":
      return <PieFigure report={report} height={height} />
    case "line":
      return <LineFigure report={report} height={height} />
    case "gauge":
      return <GaugeFigure report={report} />
    case "breakdown":
      return <BreakdownFigure report={report} />
    default: {
      const unreachable: never = report.chart
      return unreachable
    }
  }
}

function GaugeFigure({ report }: { report: ReportModel }) {
  const percent = Math.min(
    100,
    Math.max(0, Number(report.data[0]?.percent ?? 0))
  )
  const color = report.series[0]?.color ?? "var(--primary)"
  const radius = 52
  const stroke = 8
  const circumference = 2 * Math.PI * radius
  const filled = (percent / 100) * circumference

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-3">
      <svg viewBox="0 0 128 128" className="size-36" aria-hidden>
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {percent > 0 ? (
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${filled} ${circumference - filled}`}
            strokeLinecap="round"
            transform="rotate(-90 64 64)"
          />
        ) : null}
      </svg>
    </div>
  )
}

function BreakdownFigure({ report }: { report: ReportModel }) {
  const series = report.series[0]
  if (!series || report.data.length === 0) return <Empty />
  const rows = report.data.map((row) => ({
    label: String(row.label),
    count: Number(row[series.key] ?? 0),
  }))
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  if (total <= 0) return <Empty />

  return (
    <ul className="border-t">
      {rows.map((row) => {
        const share = total === 0 ? 0 : (row.count / total) * 100
        return (
          <li
            key={row.label}
            className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.5rem] items-center gap-3 border-b px-4 py-1.5 text-sm last:border-b-0"
          >
            <span className="truncate">{row.label}</span>
            <span className="h-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${share}%`,
                  backgroundColor: series.color,
                }}
              />
            </span>
            <span className="text-right tabular-nums">{row.count}</span>
          </li>
        )
      })}
    </ul>
  )
}

function Empty() {
  return (
    <p className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
      Nothing to show yet.
    </p>
  )
}

function PieFigure({ report }: { report: ReportModel; height: number }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const slices = pieSlices(report).filter((slice) => slice.value > 0)
  if (slices.length === 0) return <Empty />
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const radius = 46
  const stroke = 16
  const circumference = 2 * Math.PI * radius
  const gap = slices.length > 1 ? 3 : 0
  let covered = 0
  const arcs = slices.map((slice) => {
    const share = (slice.value / total) * circumference
    const length = Math.max(share - gap, 1)
    const arc = { ...slice, share, length, offset: covered }
    covered += share
    return arc
  })
  const active = arcs.find((arc) => arc.label === activeLabel) ?? null

  function hoverSlice(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 128 - 64
    const y = ((event.clientY - rect.top) / rect.height) * 128 - 64
    if (Math.hypot(x, y) > 64) {
      setActiveLabel(null)
      return
    }
    const angle = ((Math.atan2(y, x) * 180) / Math.PI + 450) % 360
    const match = arcs.find((arc) => {
      const start = (arc.offset / circumference) * 360
      const end = ((arc.offset + arc.share) / circumference) * 360
      return angle >= start && angle < end
    })
    setActiveLabel(match?.label ?? null)
  }

  return (
    <div onMouseLeave={() => setActiveLabel(null)}>
      <div className="relative flex items-center justify-center px-4 py-3">
        <svg
          viewBox="0 0 128 128"
          className="size-36"
          role="img"
          aria-label="Open items by status"
          onMouseMove={hoverSlice}
        >
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
              transform="rotate(-90 64 64)"
              opacity={active && active.label !== arc.label ? 0.35 : 1}
            />
          ))}
        </svg>
        {active ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <p className="text-base leading-none font-medium tabular-nums">
              {active.value}
            </p>
            <p className="mt-1 max-w-16 text-[10px] leading-tight text-muted-foreground">
              {active.label}
            </p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-3 pb-3">
        {slices.map((slice) => (
          <span
            key={slice.label}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            onMouseEnter={() => setActiveLabel(slice.label)}
          >
            <span
              className="size-2 rounded-[2px]"
              style={{ backgroundColor: slice.color }}
              aria-hidden
            />
            {slice.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function LineFigure({
  report,
  height,
}: {
  report: ReportModel
  height: number
}) {
  const series = report.series[0]
  const gradientId = `line-fill-${useId().replace(/:/g, "")}`
  if (!series) return <Empty />
  const peak = Math.max(
    0,
    ...report.data.map((row) => Number(row[series.key] ?? 0))
  )
  if (report.data.length === 0) return <Empty />

  return (
    <ChartContainer
      config={chartConfig(report)}
      className="aspect-auto! h-full min-h-36 w-full flex-1 px-1 pt-2 pb-3"
      style={{ aspectRatio: "auto" }}
      initialDimension={{ width: 320, height }}
    >
      <AreaChart
        data={report.data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series.color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={series.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeOpacity={0.8}
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval={report.data.length > 6 ? "preserveStartEnd" : 0}
          minTickGap={28}
          tick={{ fontSize: 11 }}
          tickMargin={8}
        />
        <YAxis hide domain={peak === 0 ? [0, 4] : [0, "auto"]} />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
          content={<ChartTooltipContent />}
        />
        <Area
          type="linear"
          dataKey={series.key}
          stroke={series.color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{
            r: 3.5,
            fill: series.color,
            stroke: "var(--card)",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
