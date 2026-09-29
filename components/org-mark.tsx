import { cn } from "cn"

export function organisationInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase()
  }
  const compact = name.replace(/[^a-zA-Z0-9]/g, "")
  return (compact.slice(0, 2) || "K").toUpperCase()
}

export function OrgMark({
  name,
  logoUrl,
  className,
}: {
  name: string
  logoUrl: string | null
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-muted text-[9px] font-medium tracking-tight text-muted-foreground",
        className
      )}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="size-full object-cover" /> : organisationInitials(name)}
    </span>
  )
}
