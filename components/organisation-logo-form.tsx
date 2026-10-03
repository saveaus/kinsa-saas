"use client"

import { useActionState, useRef } from "react"

import { OrgMark } from "@/components/org-mark"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  removeOrganisationLogoAction,
  uploadOrganisationLogoAction,
  type OrganisationActionState,
} from "@/modules/organisations/actions"

export function OrganisationLogoForm({
  name,
  logoUrl,
}: {
  name: string
  logoUrl: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadState, uploadAction, uploading] = useActionState(
    uploadOrganisationLogoAction,
    {}
  )
  const [removeState, removeAction, removing] = useActionState(
    removeOrganisationLogoAction,
    {}
  )
  const state: OrganisationActionState =
    uploadState.error || uploadState.message ? uploadState : removeState

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-4">
        <OrgMark
          name={name}
          logoUrl={logoUrl}
          className="size-12 rounded-lg text-sm"
        />
        <div className="flex items-center gap-2">
          <form action={uploadAction}>
            <input
              ref={inputRef}
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="sr-only"
              onChange={(event) => {
                if (event.currentTarget.files?.[0])
                  event.currentTarget.form?.requestSubmit()
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Uploading..." : "Upload logo"}
            </Button>
          </form>
          {logoUrl ? (
            <form action={removeAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={removing}
              >
                {removing ? "Removing..." : "Remove"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        PNG, JPG, GIF, or WebP under 2 MB.
      </p>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.message ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
