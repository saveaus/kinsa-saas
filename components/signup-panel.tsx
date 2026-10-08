"use client"

import Link from "next/link"
import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import { AccountPreview } from "@/components/auth-preview"
import { AuthFrame } from "@/components/auth-frame"
import { organisationInitials } from "@/components/org-mark"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUpAction } from "@/modules/identity/actions"

export function SignupPanel() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const name = [firstName, lastName].filter(Boolean).join(" ")

  return (
    <AuthFrame
      step="1/3"
      title="Let’s get to know you"
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
        submitClassName="h-10"
        className="gap-4"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {name ? organisationInitials(name) : null}
          </span>
          <div>
            <p className="text-sm">Your profile</p>
            <p className="text-xs text-muted-foreground">Shown beside your name in the workspace.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="first_name">
            <Input
              id="first_name"
              name="first_name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Enter your first name"
              autoComplete="given-name"
              required
              className="h-10"
            />
          </Field>
          <Field label="Last name" htmlFor="last_name">
            <Input
              id="last_name"
              name="last_name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Enter your last name"
              autoComplete="family-name"
              className="h-10"
            />
          </Field>
        </div>
        <Field label="Work email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@provider.com.au"
            autoComplete="email"
            required
            className="h-10"
          />
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
            className="h-10"
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
