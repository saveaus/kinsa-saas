"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useRef } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { cn } from "cn"

type State = { error?: string; message?: string; inviteUrl?: string; href?: string }

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
  onSuccess,
  id,
  bare = false,
  onPendingChange,
}: {
  action: (state: State, formData: FormData) => Promise<State>
  children?: React.ReactNode
  submitLabel: string
  pendingLabel?: string
  submitVariant?: "default" | "outline" | "ghost" | "destructive" | "link"
  submitSize?: "default" | "sm" | "xs"
  className?: string
  hideSubmit?: boolean
  fullWidth?: boolean
  submitClassName?: string
  onSuccess?: () => void
  id?: string
  bare?: boolean
  onPendingChange?: (pending: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(action, {})
  const submitted = useRef(false)

  useEffect(() => {
    onPendingChange?.(pending)
  }, [pending, onPendingChange])

  useEffect(() => {
    if (pending) {
      submitted.current = true
      return
    }
    if (submitted.current && state.message && !state.error) {
      submitted.current = false
      toast.add({ title: state.message, type: "success", timeout: 4000 })
      if (state.href) router.push(state.href)
      onSuccess?.()
    }
  }, [pending, state.message, state.error, state.href, onSuccess, router])

  return (
    <form
      id={id}
      action={formAction}
      className={bare ? className : cn("grid gap-3", className)}
    >
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {state.error}
            {state.inviteUrl ? (
              <span className="mt-1 block text-xs break-all">
                {state.inviteUrl}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {state.message ? (
        <Alert>
          <AlertDescription>
            {state.message}
            {state.inviteUrl ? (
              <span className="mt-1 block text-xs break-all">
                {state.inviteUrl}
              </span>
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
