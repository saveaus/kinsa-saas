import Link from "next/link"
import { File as FileIcon, Folder } from "lucide-react"

export function PolicyFolders({
  folders,
  icon = "folder",
}: {
  folders: { href: string; label: string; detail: string }[]
  icon?: "folder" | "file"
}) {
  const Mark = icon === "file" ? FileIcon : Folder
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {folders.map((folder) => (
        <Link
          key={folder.href}
          href={folder.href}
          className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/40"
        >
          <Mark className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm">
            {folder.label}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {folder.detail}
          </span>
        </Link>
      ))}
    </div>
  )
}

export function countPhrase(count: number, singular: string, plural: string) {
  if (count === 0) return `No ${plural} yet`
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`
}
