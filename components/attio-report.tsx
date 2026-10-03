"use client"

import Link from "next/link"
import { useId } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ReportModel } from "@/modules/analytics/reports"

function pieSlices(report: ReportModel) {
  const key = report.series[0]?.key ?? "count"
  const fallback = report.series[0]?.color ?? "#3B6FD8"
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
}: {
  report: ReportModel
  height?: number
  href?: string
}) {
  const title = href ? (
    <Link href={href} className="hover:underline">
      {report.title}
    </Link>
  ) : (
    report.title
  )

  return (
    <section
      id={report.id}
      className="flex h-full scroll-mt-6 flex-col overflow-hidden rounded-xl border bg-card"
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
      <div className="flex min-h-0 flex-1 flex-col">
        <ReportFigure report={report} height={height} />
      </div>
    </section>
  )
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
  const color = report.series[0]?.color ?? "#7BC96F"
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

function Empty() {
  return (
    <p className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
      Nothing to show yet.
    </p>
  )
}

function PieFigure({
  report,
  height,
}: {
  report: ReportModel
  height: number
}) {
  const slices = pieSlices(report).filter((slice) => slice.value > 0)
  if (slices.length === 0) return <Empty />

  return (
    <>
      <ChartContainer
        config={{}}
        className="mx-auto aspect-auto! h-full min-h-36 w-full max-w-40 flex-1"
        style={{ aspectRatio: "auto" }}
        initialDimension={{ width: 160, height }}
      >
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent hideLabel nameKey="label" indicator="dot" />
            }
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            outerRadius={64}
            stroke="transparent"
            paddingAngle={slices.length > 1 ? 2 : 0}
          >
            {slices.map((slice) => (
              <Cell key={slice.label} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-3 pb-3">
        {slices.map((slice) => (
          <span
            key={slice.label}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
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
    </>
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
