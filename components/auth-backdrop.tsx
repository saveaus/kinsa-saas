import { cn } from "cn"

const tiles = ["1", "2", "3", "4"] as const

export function AuthBackdrop({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("auth-backdrop flex min-h-svh w-full flex-col", className)}>
      {tiles.map((tile) => (
        <span key={tile} className="auth-tile" data-tile={tile} aria-hidden />
      ))}
      {children}
    </div>
  )
}
