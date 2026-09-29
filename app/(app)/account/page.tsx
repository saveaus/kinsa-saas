import { ActionForm } from "@/components/action-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requireTenant } from "@/lib/tenant"
import { updatePasswordAction } from "@/modules/identity/actions"

export default async function AccountPage() {
  await requireTenant()

  return (
    <div className="grid max-w-md gap-6">
      <div>
        <h2 className="font-heading text-lg">Password</h2>
        <p className="text-sm text-muted-foreground">Change the password for your sign-in.</p>
      </div>
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
    </div>
  )
}
