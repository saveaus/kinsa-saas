import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

import { formatDate } from "@/lib/format-date"
import {
  ndisUpdateKindLabel,
  ndisUpdates,
} from "@/lib/ndis-updates"

export function NdisUpdates() {
  return (
    <section className="grid gap-2">
      <div className="grid gap-1">
        <h2 className="text-sm font-medium">Updates</h2>
        <p className="text-sm text-muted-foreground">
          Policy and general updates from the NDIS. Open the article, or ask
          the assistant how it affects this organisation.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        {ndisUpdates.map((update) => (
          <div
            key={update.id}
            className="grid gap-1 border-b px-3 py-2.5 last:border-b-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <a
                href={update.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 text-sm hover:underline"
              >
                <span className="truncate">{update.title}</span>
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">
                {ndisUpdateKindLabel(update.kind)} · {formatDate(update.publishedOn)}
              </span>
            </div>
            <Link
              href={`/assistant?update=${update.id}`}
              className="w-fit text-xs text-primary hover:underline"
            >
              Ask the assistant
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
