import { CornerDownRight } from "lucide-react"

export function AssistantSuggestions({
  prompts,
  onPick,
}: {
  prompts: string[]
  onPick: (text: string) => void
}) {
  const shown = prompts.slice(0, 4)
  if (shown.length === 0) return null

  return (
    <div className="mt-5">
      <p className="px-2 text-xs text-muted-foreground">Suggestions</p>
      <ul className="mt-1">
        {shown.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
              onClick={() => onPick(suggestion)}
            >
              <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{suggestion}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
