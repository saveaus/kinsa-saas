import { ArrowRight } from "lucide-react"
import Link from "next/link"

function firstName(name: string) {
  const part = name.trim().split(/\s+/)[0]
  return part || "there"
}

export function WelcomeWidget({
  name,
  needsGroups,
}: {
  name: string
  needsGroups: boolean
}) {
  const featured = needsGroups
    ? {
        href: "/settings/registration-groups",
        title: "Set registration groups",
        description: "The checklist follows the NDIS groups this organisation holds.",
      }
    : {
        href: "/workers",
        title: "Add workers",
        description: "Drop a staff list in the assistant, or add people one by one.",
      }

  return (
    <section className="grid gap-8">
      <div>
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight">
          Welcome {firstName(name)}!
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Get started with Kinsa</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FeatureCard {...featured} featured />
        <FeatureCard
          href="/policies"
          title="Start the policies"
          description="A draft from the library for each standard that applies."
        />
      </div>
      <div className="grid gap-3">
        <h3 className="text-base font-medium">Quickstart</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <FeatureCard
            href="/participants"
            title="Add participants"
            description="Support plans and service agreements with a review date."
          />
          <FeatureCard
            href="/assistant"
            title="Ask the assistant"
            description="Ask what is due, or file a staff list from a spreadsheet."
          />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CompactLink href="/dashboard" title="Today's check" />
        <CompactLink href="/reports" title="Evidence pack" />
      </div>
    </section>
  )
}

function FeatureCard({
  href,
  title,
  description,
  featured = false,
}: {
  href: string
  title: string
  description: string
  featured?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        featured
          ? "flex min-h-40 flex-col rounded-xl bg-primary p-5 text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary),black_8%)]"
          : "flex min-h-40 flex-col rounded-xl border bg-card p-5 transition-colors hover:bg-muted"
      }
    >
      <p className="text-base font-medium">{title}</p>
      <p className={`mt-1 max-w-sm text-sm ${featured ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {description}
      </p>
      <ArrowRight className={`mt-auto size-4 self-end ${featured ? "" : "text-muted-foreground"}`} />
    </Link>
  )
}

function CompactLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
    >
      {title}
      <ArrowRight className="size-4 text-muted-foreground" />
    </Link>
  )
}
