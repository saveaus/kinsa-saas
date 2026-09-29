import Link from "next/link"

import { ActionForm } from "@/components/action-form"
import { PublicCenter } from "@/components/public-center"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordResetAction } from "@/modules/identity/actions"

export default function ForgotPasswordPage() {
  return (
    <PublicCenter>
      <Card>
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>We’ll email a link to choose a new password.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ActionForm
            action={requestPasswordResetAction}
            submitLabel="Send reset link"
            pendingLabel="Sending..."
          >
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
          </ActionForm>
          <p className="text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </PublicCenter>
  )
}
