"use client"

import { useActionState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

type State = { error?: string; message?: string; inviteUrl?: string }

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving...",
  submitVariant = "default",
  submitSize = "default",
  className,
  hideSubmit = false,
  fullWidth = false,
  submitClassName,
}: {
  action: (state: State, formData: FormData) => Promise<State>
  children?: React.ReactNode
  submitLabel: string
  pendingLabel?: string
  submitVariant?: "default" | "outline" | "ghost" | "destructive"
  submitSize?: "default" | "sm" | "xs"
  className?: string
  hideSubmit?: boolean
  fullWidth?: boolean
  submitClassName?: string
}) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className={cn("grid gap-3", className)}>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {state.error}
            {state.inviteUrl ? <span className="mt-1 block break-all text-xs">{state.inviteUrl}</span> : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {state.message ? (
        <Alert>
          <AlertDescription>
            {state.message}
            {state.inviteUrl ? (
              <span className="mt-1 block break-all text-xs">{state.inviteUrl}</span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {children}
      {hideSubmit ? null : (
        <Button
          type="submit"
          variant={submitVariant}
          size={submitSize}
          disabled={pending}
          className={cn(fullWidth ? "w-full" : "w-fit", submitClassName)}
        >
          {pending ? pendingLabel : submitLabel}
        </Button>
      )}
    </form>
  )
}
