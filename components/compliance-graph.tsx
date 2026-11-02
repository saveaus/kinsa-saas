"use client"

import { Cell, Pie, PieChart } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

const complianceChartConfig = {
  met: { label: "Current", color: "var(--primary)" },
  rest: { label: "Remaining", theme: { light: "#F1F2F4", dark: "#32363C" } },
} satisfies ChartConfig

export function ComplianceGraph({ percent, score }: { percent: number; score: string }) {
  const current = Math.max(0, Math.min(100, percent))
  const data =
    current <= 0
      ? [{ key: "rest", value: 100 }]
      : current >= 100
        ? [{ key: "met", value: 100 }]
        : [
            { key: "met", value: current },
            { key: "rest", value: 100 - current },
          ]

  return (
    <div className="overflow-hidden px-3 pb-4">
      <div className="relative mx-auto size-40">
        <ChartContainer config={complianceChartConfig} className="aspect-square size-40">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius={54}
              outerRadius={72}
              startAngle={90}
              endAngle={-269.9}
              isAnimationActive={false}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[22px] font-medium">
          {current}%
        </p>
      </div>
      <p className="text-center text-xs text-muted-foreground">{score} requirements current</p>
    </div>
  )
}
