"use client"

import { ArrowUp, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { stashAssistantDraft } from "@/modules/assistant/messages"

const suggestions = ["Generate me a new policy"]

export function AssistantPrompt() {
  const router = useRouter()
  const [input, setInput] = useState("")

  function start(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    stashAssistantDraft(trimmed)
    router.push("/assistant")
  }

  return (
    <section className="grid gap-2">
      <form
        className="flex items-center gap-2 overflow-hidden rounded-xl border bg-background px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault()
          start(input)
        }}
      >
        <Sparkles className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            start(input)
          }}
          placeholder="Ask a question"
          aria-label="Message"
          className="h-8 border-0 px-0 shadow-none focus-visible:ring-0 md:text-sm"
        />
        <Button
          type="submit"
          size="icon-sm"
          className="rounded-full"
          aria-label="Send"
          disabled={!input.trim()}
        >
          <ArrowUp />
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="inline-flex items-center rounded-md border-0 bg-[#F1F2F4] px-2 py-1 text-xs font-medium text-[#5E6570] shadow-none hover:bg-[#E6E8EB] dark:bg-[#32363C] dark:text-[#C8CDD4] dark:hover:bg-[#3A3F46]"
            onClick={() => start(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  )
}
