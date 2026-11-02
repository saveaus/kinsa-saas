import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { OnboardingPanel } from "@/components/onboarding-panel"
import { getTenantContext, requireAuthUser } from "@/lib/tenant"

export default async function OnboardingPage() {
  await requireAuthUser()
  const context = await getTenantContext()
  if (context) {
    const welcome = (await cookies()).get("kinsa-welcome")?.value === "1"
    redirect(context.role === "admin" ? (welcome ? "/dashboard?welcome=1" : "/dashboard") : "/me")
  }

  return <OnboardingPanel />
}
