"use client"

import Link from "next/link"
import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import { AccountPreview } from "@/components/auth-preview"
import { AuthFrame } from "@/components/auth-frame"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUpAction } from "@/modules/identity/actions"

export function SignupPanel() {
  const [name, setName] = useState("")

  return (
    <AuthFrame
      step="1/2"
      title="Create your account"
      description="You’ll set up the organisation next and become its administrator."
      preview={<AccountPreview name={name} />}
      aside={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline underline-offset-2">
            Sign in
          </Link>
        </p>
      }
    >
      <ActionForm
        action={signUpAction}
        submitLabel="Continue"
        pendingLabel="Creating account..."
        fullWidth
        className="gap-4"
      >
        <Field label="Your name" htmlFor="full_name">
          <Input
            id="full_name"
            name="full_name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Work email" htmlFor="email">
          <Input id="email" name="email" type="email" placeholder="Enter your work email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
      </ActionForm>
    </AuthFrame>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
