import { PublicCenter } from "@/components/public-center"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PrivacyPage() {
  return (
    <PublicCenter>
    <Card>
      <CardHeader>
        <CardTitle>Privacy</CardTitle>
        <CardDescription>How Kinsa handles staff compliance information.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-muted-foreground">
        <p>
          Worker profiles, identity documents, licences and training records are stored in Australia
          (AWS Sydney) using Supabase for authentication, database and private file storage.
        </p>
        <p>
          Expiry reminders and invites are sent by email through Resend. Message content and delivery
          logs are stored by Resend in the United States. Reminder emails never include document
          files or images.
        </p>
        <p>
          Organisation administrators can delete a worker record. Files are removed and personal
          details are anonymised. Audit and access logs are kept in anonymised form so the
          organisation can still see that an action occurred.
        </p>
        <p>Document views and downloads are logged against the signed-in user.</p>
      </CardContent>
    </Card>
    </PublicCenter>
  )
}
