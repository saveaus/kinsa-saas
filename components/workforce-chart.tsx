import { Chip, type ChipTone } from "@/components/chip"

const series = [
  { key: "compliant", label: "Compliant", tone: "green", fill: "#7BC96F" },
  { key: "lapsing", label: "Lapsing", tone: "yellow", fill: "#F5C451" },
  { key: "pending", label: "Pending review", tone: "orange", fill: "#F0A15A" },
  { key: "noncompliant", label: "Not compliant", tone: "red", fill: "#E57A72" },
] as const

export function WorkforceChart({
  counts,
  active,
  onSelect,
}: {
  counts: Record<(typeof series)[number]["key"], number>
  active?: string | null
  onSelect?: (key: (typeof series)[number]["key"]) => void
}) {
  const max = Math.max(1, ...series.map((item) => counts[item.key]))

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="size-2.5 rounded-[3px] bg-emerald-500" aria-hidden />
        <p className="text-sm font-medium">Workforce status</p>
      </div>
      <div className="grid gap-4 px-4 py-4">
        <div className="flex flex-wrap gap-1.5">
          {series.map((item) => (
            <button key={item.key} type="button" onClick={() => onSelect?.(item.key)} className="cursor-pointer">
              <Chip tone={item.tone as ChipTone} className={active === item.key ? "ring-1 ring-foreground/30" : undefined}>
                {item.label} {counts[item.key]}
              </Chip>
            </button>
          ))}
        </div>
        <div className="flex h-36 items-end gap-3 border-b border-border">
          {series.map((item) => {
            const count = counts[item.key]
            const height = count === 0 ? 0 : Math.max(12, (count / max) * 100)
            return (
              <div key={item.key} className="flex h-full flex-1 items-end justify-center">
                <div
                  className="w-10 rounded-t-md"
                  style={{ height: `${height}%`, backgroundColor: item.fill }}
                  title={`${item.label}: ${count}`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-3 text-center text-xs text-muted-foreground">
          {series.map((item) => (
            <span key={item.key} className="flex-1">
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
