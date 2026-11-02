import { cn } from "cn"

export function AuthBackdrop({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("auth-backdrop flex min-h-svh w-full flex-col", className)}>
      {children}
    </div>
  )
}
