"use client"

import { useEffect, useState } from "react"

export function RotatingSuggestions({
  prompts,
  onPick,
}: {
  prompts: string[]
  onPick: (text: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [reduced, setReduced] = useState(false)
  const count = Math.min(3, prompts.length)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduced(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    if (prompts.length < 2) return
    const timer = window.setInterval(() => {
      if (reduced) {
        setIndex((current) => (current + 1) % prompts.length)
        return
      }
      setVisible(false)
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % prompts.length)
        setVisible(true)
      }, 280)
    }, 3800)
    return () => window.clearInterval(timer)
  }, [prompts.length, reduced])

  if (count === 0) return null
  const shown = Array.from({ length: count }, (_, offset) => prompts[(index + offset) % prompts.length]).filter(
    (prompt): prompt is string => Boolean(prompt)
  )

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {shown.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className={`rounded-full border bg-background px-3 py-1.5 text-sm hover:bg-muted motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out ${
            visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
          onClick={() => onPick(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
