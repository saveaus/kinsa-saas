import { requireTenant } from "@/lib/tenant"

export default async function CourseLayout({ children }: { children: React.ReactNode }) {
  await requireTenant()
  return <div className="h-svh bg-background">{children}</div>
}
