import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Kinsa</CardTitle>
          <CardDescription>
            Staff compliance tracker for Australian NDIS providers. Keep support worker documents,
            expiries and in-app training in one place. This product helps you organise evidence — it
            does not guarantee an audit outcome.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/signup" className={buttonVariants()}>
            Create an organisation
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Sign in
          </Link>
          <Link href="/privacy" className={buttonVariants({ variant: "ghost" })}>
            Privacy
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
