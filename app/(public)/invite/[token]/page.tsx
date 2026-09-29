import { ActionForm } from "@/components/action-form"
import { PublicCenter } from "@/components/public-center"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
          <CardDescription>This invite is invalid or has expired.</CardDescription>
        </CardHeader>
      </Card>
      </PublicCenter>
    )
  }

  const action = acceptInviteAction.bind(null, token)

  return (
    <PublicCenter>
    <Card>
      <CardHeader>
        <CardTitle>Accept your invite</CardTitle>
        <CardDescription>
          Create or sign in with {invite.email} to view your compliance record.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={action} submitLabel="Join organisation">
          <div className="grid gap-1.5">
            <Label htmlFor="full_name">Your name</Label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={invite.email} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
        </ActionForm>
      </CardContent>
    </Card>
    </PublicCenter>
  )
}
