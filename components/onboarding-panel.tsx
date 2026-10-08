"use client"

import { useEffect, useRef, useState } from "react"

import { ActionForm } from "@/components/action-form"
import { AuthFrame } from "@/components/auth-frame"
import { OrganisationPreview } from "@/components/auth-preview"
import { OrgMark } from "@/components/org-mark"
import { RegistrationGroupCheckboxes } from "@/components/registration-group-checkboxes"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isValidAbn, parseAbn } from "@/lib/abn"
import type { NdisRegistrationGroupCode } from "@/lib/ndis-registration-groups"
import { createOrganisationAction } from "@/modules/identity/actions"

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"])
const MAX_LOGO_BYTES = 2 * 1024 * 1024

type Step = "details" | "groups"

export function OnboardingPanel() {
  const [step, setStep] = useState<Step>("details")
  const [name, setName] = useState("")
  const [abn, setAbn] = useState("")
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [groups, setGroups] = useState<NdisRegistrationGroupCode[]>([])
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const logoUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current)
    }
  }, [])

  function replaceLogo(file: File | null) {
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current)
    const next = file ? URL.createObjectURL(file) : null
    logoUrlRef.current = next
    setLogoUrl(next)
  }

  function onLogoChange(file: File | undefined) {
    if (!file) return
    if (!LOGO_TYPES.has(file.type)) {
      setNotice("Use a PNG, JPG, GIF, or WebP image.")
      if (logoRef.current) logoRef.current.value = ""
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setNotice("Logo must be under 2 MB.")
      if (logoRef.current) logoRef.current.value = ""
      return
    }
    setNotice(null)
    replaceLogo(file)
  }

  function removeLogo() {
    if (logoRef.current) logoRef.current.value = ""
    replaceLogo(null)
  }

  function continueToGroups() {
    if (!name.trim() || name.trim().length > 200) {
      setNotice("Enter the organisation name.")
      return
    }
    if (abn.trim()) {
      const parsed = parseAbn(abn)
      if (!parsed || !isValidAbn(parsed)) {
        setNotice("Enter a valid 11-digit Australian Business Number, or leave it blank.")
        return
      }
    }
    const registration = registrationNumber.trim()
    if (registration && (registration.length < 4 || registration.length > 40)) {
      setNotice("Enter the NDIS registration number, or leave it blank.")
      return
    }
    setNotice(null)
    setStep("groups")
  }

  return (
    <AuthFrame
      step={step === "details" ? "2/3" : "3/3"}
      title={step === "details" ? "Create your organisation" : "Which services do you deliver?"}
      description={
        step === "details"
          ? "The name and logo appear in the workspace and on training certificates."
          : "Workers and evidence stay scoped to the registration groups you hold. You can change these later in Settings."
      }
      onBack={step === "groups" ? () => setStep("details") : undefined}
      preview={
        <OrganisationPreview
          name={name}
          logoUrl={logoUrl}
          registrationGroups={groups}
          abn={abn}
          registrationNumber={registrationNumber}
          focus={step === "details" ? "workspace" : "groups"}
        />
      }
    >
      <ActionForm
        action={createOrganisationAction}
        submitLabel="Continue"
        pendingLabel="Creating organisation..."
        hideSubmit
        className="gap-4"
        onPendingChange={setPending}
      >
        <div className={step === "details" ? "grid gap-4" : "hidden"}>
          <div className="flex items-center gap-3">
            <OrgMark name={name || "Organisation"} logoUrl={logoUrl} className="size-12 rounded-lg text-sm" />
            <div className="grid gap-1">
              <p className="text-sm">Organisation logo</p>
              <div className="flex items-center gap-3 text-sm">
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => logoRef.current?.click()}
                >
                  {logoUrl ? "Replace image" : "Upload image"}
                </button>
                {logoUrl ? (
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    onClick={removeLogo}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG, GIF, or WebP under 2 MB.</p>
            </div>
          </div>
          <Field label="Organisation name" htmlFor="name">
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your organisation name"
              autoComplete="organization"
              className="h-10"
            />
          </Field>
          <Field label="ABN" htmlFor="abn" hint="Optional. Printed on certificates.">
            <Input
              id="abn"
              name="abn"
              inputMode="numeric"
              value={abn}
              onChange={(event) => setAbn(formatAbnInput(event.target.value))}
              placeholder="12 345 678 901"
              autoComplete="off"
              className="h-10"
            />
          </Field>
          <Field label="NDIS registration number" htmlFor="registration_number" hint="Optional.">
            <Input
              id="registration_number"
              name="registration_number"
              value={registrationNumber}
              onChange={(event) => setRegistrationNumber(event.target.value)}
              placeholder="4-XXXXXXXX"
              autoComplete="off"
              className="h-10"
            />
          </Field>
        </div>
        <input
          ref={logoRef}
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="sr-only"
          onChange={(event) => onLogoChange(event.currentTarget.files?.[0])}
        />
        <div className={step === "groups" ? "grid gap-4" : "hidden"}>
          <RegistrationGroupCheckboxes
            selected={groups}
            onChange={setGroups}
            legend="NDIS registration groups"
          />
        </div>
        {notice ? (
          <Alert variant="destructive">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}
        {step === "details" ? (
          <Button type="button" className="h-10 w-full" onClick={continueToGroups}>
            Continue
          </Button>
        ) : (
          <Button type="submit" className="h-10 w-full" disabled={pending}>
            {pending ? "Creating organisation..." : "Continue"}
          </Button>
        )}
      </ActionForm>
    </AuthFrame>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function formatAbnInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
}
