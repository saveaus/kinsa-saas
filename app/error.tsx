"use client"

import { Button } from "@/components/ui/button"

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="grid min-h-svh place-items-center p-6">
      <div className="grid max-w-md gap-3 rounded-lg border bg-background p-6">
        <h2 className="font-heading text-lg">This page didn’t load</h2>
        <p className="text-sm text-muted-foreground">Try again. Your records are unchanged.</p>
        <div>
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
