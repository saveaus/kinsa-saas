import type { AuditModule } from "@/lib/audit-catalogue"

export function AuditScope({ modules }: { modules: AuditModule[] }) {
  const count = modules.reduce(
    (total, auditModule) =>
      total +
      auditModule.categories.reduce(
        (categoryTotal, category) => categoryTotal + category.criteria.length,
        0
      ),
    0
  )
  if (count === 0) return null
  const verification = modules.every(
    (auditModule) => auditModule.name === "Verification module"
  )

  return (
    <section className="grid gap-2">
      <div>
        <h2 className="text-sm font-medium">
          {count} {count === 1 ? "criterion" : "criteria"} for these registration groups
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {verification
            ? "A verification audit checks that each document exists and is current."
            : "A certification audit checks the documents, then whether day-to-day practice matches them."}
        </p>
      </div>
      <ul className="divide-y overflow-hidden rounded-lg border bg-card">
        {modules.map((auditModule) => {
          const criteria = auditModule.categories.reduce(
            (total, category) => total + category.criteria.length,
            0
          )
          return (
            <li
              key={auditModule.name}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate">{auditModule.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {criteria} {criteria === 1 ? "criterion" : "criteria"}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
