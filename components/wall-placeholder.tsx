const rowWidths = ["w-2/5", "w-3/5", "w-1/2", "w-2/3", "w-2/5", "w-1/2", "w-3/5", "w-2/5"]

export function WallPlaceholder() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="h-5 w-40 rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full rounded-md bg-muted" />
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        {rowWidths.map((width, index) => (
          <div key={index} className="flex items-center justify-between gap-6 px-3 py-3">
            <div className={`h-4 rounded-md bg-muted ${width}`} />
            <div className="h-4 w-16 shrink-0 rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
