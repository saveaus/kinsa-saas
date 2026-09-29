import { redirect } from "next/navigation"

import { OnboardingPanel } from "@/components/onboarding-panel"
import { getTenantContext, requireAuthUser } from "@/lib/tenant"

export default async function OnboardingPage() {
  await requireAuthUser()
  const context = await getTenantContext()
  if (context) {
    redirect(context.role === "admin" ? "/dashboard" : "/me")
  }

  return <OnboardingPanel />
}
