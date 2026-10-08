import Link from "next/link"

import { ActionForm } from "@/components/action-form"
import { AuthFrame } from "@/components/auth-frame"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signInAction } from "@/modules/identity/actions"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const expired = params.error === "confirm"
  return (
    <AuthFrame
      title="Welcome back"
      description={
        expired
          ? "That confirmation link has expired. Create the account again and open the new email from Kinsa."
          : undefined
      }
      aside={
        <p>
          New provider?{" "}
          <Link href="/signup" className="text-primary underline underline-offset-2">
            Create an organisation
          </Link>
        </p>
      }
    >
      <ActionForm
        action={signInAction}
        submitLabel="Sign in"
        pendingLabel="Signing in..."
        fullWidth
        submitClassName="h-10"
        className="gap-4"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="email" className="text-xs font-normal text-muted-foreground">
            Work email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@provider.com.au"
            autoComplete="email"
            required
            className="h-10"
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password" className="text-xs font-normal text-muted-foreground">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            className="h-10"
          />
        </div>
      </ActionForm>
    </AuthFrame>
  )
}
