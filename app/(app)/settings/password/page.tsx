import { ActionForm } from "@/components/action-form"
import { SettingsFrame, SettingsSection } from "@/components/settings-frame"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requireTenant } from "@/lib/tenant"
import { updatePasswordAction } from "@/modules/identity/actions"

export default async function PasswordSettingsPage() {
  await requireTenant()

  return (
    <SettingsFrame href="/settings/password">
      <SettingsSection
        title="Sign-in"
        description="Use at least 8 characters. You stay signed in on this device."
      >
        <ActionForm
          action={updatePasswordAction}
          submitLabel="Update password"
          pendingLabel="Saving..."
        >
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
      </SettingsSection>
    </SettingsFrame>
  )
}
