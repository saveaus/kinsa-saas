import { ActionForm } from "@/components/action-form"
import { PublicCenter } from "@/components/public-center"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createServerSupabase } from "@/lib/supabase/server"
import { acceptInviteAction } from "@/modules/identity/actions"
import { peekInvite } from "@/modules/identity/queries"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await peekInvite(token)

  if (!invite) {
    return (
      <PublicCenter>
        <Card>
          <CardHeader>
            <CardTitle>Invite unavailable</CardTitle>
            <CardDescription>
              This invite is invalid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </PublicCenter>
    )
  }

  const supabase = await createServerSupabase()
  const { data } = await supabase.auth.getUser()
  const signedInEmail = data.user?.email?.toLowerCase() ?? null
  const invitedEmail = String(invite.email).toLowerCase()
  const action = acceptInviteAction.bind(null, token)

  return (
    <PublicCenter>
      <Card>
        <CardHeader>
          <CardTitle>Accept your invite</CardTitle>
          <CardDescription>
            {signedInEmail === invitedEmail
              ? `Join with ${invite.email}.`
              : `Create an account for ${invite.email}. You will confirm that email, then come back here to join.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {signedInEmail && signedInEmail !== invitedEmail ? (
            <p className="text-sm text-muted-foreground">
              You are signed in as {signedInEmail}. Sign out, then open this
              invite again.
            </p>
          ) : (
            <ActionForm
              action={action}
              submitLabel={
                signedInEmail ? "Join organisation" : "Create account"
              }
            >
              <input type="hidden" name="email" value={invitedEmail} />
              {signedInEmail ? null : (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="full_name">Your name</Label>
                    <Input id="full_name" name="full_name" required />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={invite.email} readOnly />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      minLength={8}
                      required
                    />
                  </div>
                </>
              )}
            </ActionForm>
          )}
        </CardContent>
      </Card>
    </PublicCenter>
  )
}
