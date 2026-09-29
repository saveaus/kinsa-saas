"use client"

import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import { AuthFrame } from "@/components/auth-frame"
import { OrganisationPreview } from "@/components/auth-preview"
import { RegistrationGroupCheckboxes } from "@/components/registration-group-checkboxes"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { NdisRegistrationGroupCode } from "@/lib/ndis-registration-groups"
import { createOrganisationAction } from "@/modules/identity/actions"

export function OnboardingPanel() {
  const [name, setName] = useState("")
  const [groups, setGroups] = useState<NdisRegistrationGroupCode[]>([])

  return (
    <AuthFrame
      step="2/2"
      title="Create your organisation"
      description="This is the NDIS provider. Tell us which registration groups you hold so workers and evidence stay scoped to the services you deliver."
      preview={<OrganisationPreview name={name} registrationGroups={groups} />}
    >
      <ActionForm
        action={createOrganisationAction}
        submitLabel="Continue"
        pendingLabel="Creating organisation..."
        fullWidth
        className="gap-4"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="name" className="text-xs font-normal text-muted-foreground">
            Organisation name
          </Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your organisation name"
            required
          />
        </div>
        <RegistrationGroupCheckboxes
          selected={groups}
          onChange={setGroups}
          legend="NDIS registration groups"
        />
      </ActionForm>
    </AuthFrame>
  )
}
