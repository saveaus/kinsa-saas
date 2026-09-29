import Link from "next/link"

export function AuthFrame({
  step,
  title,
  description,
  children,
  preview,
  aside,
  panelEyebrow,
  panelCopy,
}: {
  step?: string
  title: string
  description?: string
  children: React.ReactNode
  preview?: React.ReactNode
  aside?: React.ReactNode
  panelEyebrow?: string
  panelCopy?: string
}) {
  const showPanel = Boolean(preview)
  const showPanelCopy = Boolean(panelEyebrow || panelCopy)

  return (
    <div className="relative flex min-h-svh flex-col bg-[radial-gradient(1200px_600px_at_10%_-10%,#eef2f6_0%,transparent_55%),radial-gradient(900px_500px_at_90%_0%,#f3f1ec_0%,transparent_50%),#fafafa] dark:bg-background">
      <header className="relative z-10 flex items-center justify-between px-6 pt-7 pb-4 sm:px-10">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Kinsa
        </Link>
        <p className="hidden text-xs text-muted-foreground sm:block">Staff compliance for NDIS providers</p>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-4 pb-8 sm:px-6">
        <div
          className={`grid w-full animate-in overflow-hidden rounded-2xl border border-black/5 bg-background shadow-[0_30px_80px_-48px_rgba(15,23,42,0.45)] fade-in duration-500 ${
            showPanel ? "md:min-h-[600px] md:grid-cols-[minmax(0,24rem)_1fr]" : "mx-auto max-w-md"
          }`}
        >
          <div className="flex flex-col justify-center px-8 py-10 sm:px-11">
            {step ? <p className="text-xs tracking-wide text-muted-foreground uppercase">{step}</p> : null}
            <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight text-balance">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
            <div className="mt-7 animate-in fade-in slide-in-from-bottom-1 duration-500">{children}</div>
            {aside ? <div className="mt-6 text-sm text-muted-foreground">{aside}</div> : null}
          </div>
          {showPanel ? (
            <div className="relative hidden overflow-hidden md:block">
              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(160deg,#1f2933_0%,#334155_42%,#3f4f46_100%)]"
              />
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.14),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(125,211,168,0.18),transparent_35%)]" />
              <div className="relative flex h-full items-center justify-center p-8 lg:p-10">
                {showPanelCopy ? (
                  <div className="absolute top-8 left-8 max-w-sm text-white lg:top-10 lg:left-10">
                    {panelEyebrow ? (
                      <p className="text-[11px] tracking-[0.14em] text-white/55 uppercase">{panelEyebrow}</p>
                    ) : null}
                    {panelCopy ? (
                      <p className="mt-2 text-[22px] leading-snug font-medium tracking-tight text-balance">{panelCopy}</p>
                    ) : null}
                  </div>
                ) : null}
                <div className="relative w-full max-w-[560px] animate-in fade-in slide-in-from-bottom-3 duration-700">
                  {preview}
                </div>
              </div>
            </div>
          ) : null}
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
    </div>
  )
}
