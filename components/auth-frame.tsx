import { ChevronLeft } from "lucide-react"
import Link from "next/link"

import { AuthBackdrop } from "@/components/auth-backdrop"

export function AuthFrame({
  step,
  title,
  description,
  children,
  preview,
  aside,
  onBack,
}: {
  step?: string
  title: string
  description?: string
  children: React.ReactNode
  preview?: React.ReactNode
  aside?: React.ReactNode
  onBack?: () => void
}) {
  const showPanel = Boolean(preview)

  return (
    <AuthBackdrop>
      <header className="relative z-10 flex justify-center px-6 pt-8">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Kinsa
        </Link>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-8 sm:px-6">
        <div
          className={`grid w-full overflow-hidden border bg-card shadow-none ${
            showPanel ? "md:min-h-[640px] md:grid-cols-[minmax(0,26rem)_1fr]" : "mx-auto max-w-[26rem]"
          }`}
        >
          <div className="flex flex-col justify-center px-8 py-10 sm:px-10">
            {step || onBack ? (
              <div className="mb-2 flex items-center gap-1">
                {onBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    aria-label="Back"
                    className="-ml-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                ) : null}
                {step ? <p className="text-xs text-muted-foreground">{step}</p> : null}
              </div>
            ) : null}
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-balance">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
            <div className="mt-7">{children}</div>
            {aside ? <div className="mt-6 text-sm text-muted-foreground">{aside}</div> : null}
          </div>
          {showPanel ? <div className="relative hidden min-h-[420px] border-l bg-card md:block">{preview}</div> : null}
        </div>
      </main>
      <footer className="relative z-10 flex justify-center gap-5 py-6 text-xs text-muted-foreground">
        <Link href="/privacy" className="transition-colors hover:text-foreground">
          Privacy
        </Link>
        <Link href="/signup" className="transition-colors hover:text-foreground">
          Create organisation
        </Link>
      </footer>
    </AuthBackdrop>
  )
}
