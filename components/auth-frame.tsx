import Link from "next/link"

export function AuthFrame({
  step,
  title,
  description,
  children,
  preview,
  aside,
}: {
  step?: string
  title: string
  description?: string
  children: React.ReactNode
  preview: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex justify-center pt-8 pb-4">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Kinsa
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-start px-4 pb-6">
        <div className="grid w-full overflow-hidden rounded-2xl border bg-background md:min-h-[560px] md:grid-cols-[minmax(0,26rem)_1fr]">
          <div className="flex flex-col justify-center px-8 py-10 sm:px-12">
            {step ? <p className="text-xs text-muted-foreground">{step}</p> : null}
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight">{title}</h1>
            {description ? <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
            <div className="mt-6">{children}</div>
            {aside ? <div className="mt-6 text-sm text-muted-foreground">{aside}</div> : null}
          </div>
          <div className="relative hidden overflow-hidden bg-[#f7f8f9] md:block dark:bg-muted/40">
            <div className="absolute top-16 left-8 w-[640px]">{preview}</div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#f7f8f9] via-transparent to-[#f7f8f9]/80 dark:from-background dark:to-background/70" />
          </div>
        </div>
      </main>
      <footer className="flex justify-center gap-4 py-6 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link href="/login" className="hover:text-foreground">
          Sign in
        </Link>
      </footer>
    </div>
  )
}
