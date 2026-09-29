import Link from "next/link"

import { ActionForm } from "@/components/action-form"
import { PublicCenter } from "@/components/public-center"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updatePasswordAction } from "@/modules/identity/actions"

export default function ResetPasswordPage() {
  return (
    <PublicCenter>
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Use at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ActionForm action={updatePasswordAction} submitLabel="Update password" pendingLabel="Saving...">
            <div className="grid gap-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </ActionForm>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </PublicCenter>
  )
}
