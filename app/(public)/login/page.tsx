import Link from "next/link"

import { ActionForm } from "@/components/action-form"
import { PublicCenter } from "@/components/public-center"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signInAction } from "@/modules/identity/actions"

export default function LoginPage() {
  return (
    <PublicCenter>
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Workers and admins use the same sign-in.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ActionForm action={signInAction} submitLabel="Sign in" pendingLabel="Signing in...">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
        </ActionForm>
        <p className="text-sm text-muted-foreground">
          New provider? <Link href="/signup" className="underline">Create an organisation</Link>
        </p>
      </CardContent>
    </Card>
    </PublicCenter>
  )
}
