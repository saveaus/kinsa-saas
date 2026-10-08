"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AppPermission } from "@/lib/database.types"
import { updateTeamPermissionsAction } from "@/modules/teams/actions"
import { permissionGroups } from "@/modules/teams/permissions"
import type { TeamRecord } from "@/modules/teams/queries"

export function TeamPermissions({
  teams,
  selectedCode,
  canGrant,
}: {
  teams: TeamRecord[]
  selectedCode: string | null
  canGrant: AppPermission[]
}) {
  const router = useRouter()
  const [teamCode, setTeamCode] = useState(
    teams.some((team) => team.code === selectedCode)
      ? (selectedCode ?? teams[0]?.code ?? "")
      : (teams[0]?.code ?? "")
  )
  const selected = teams.find((team) => team.code === teamCode) ?? teams[0]

  useEffect(() => {
    if (!selectedCode) return
    if (!teams.some((team) => team.code === selectedCode)) return
    setTeamCode(selectedCode)
  }, [selectedCode, teams])

  function chooseTeam(code: string) {
    setTeamCode(code)
    router.replace(`/settings/permissions?team=${code}`, { scroll: false })
  }

  if (!selected) return null

  return (
    <div className="grid gap-6">
      <Tabs value={selected.code} onValueChange={chooseTeam}>
        <TabsList
          variant="line"
          className="h-9 w-full max-w-full justify-start overflow-x-auto border-b px-0"
        >
          {teams.map((team) => (
            <TabsTrigger
              key={team.id}
              value={team.code}
              className="flex-none px-2.5 text-[13px] font-normal"
            >
              {team.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <PermissionForm key={selected.id} team={selected} canGrant={canGrant} />
    </div>
  )
}

function PermissionForm({
  team,
  canGrant,
}: {
  team: TeamRecord
  canGrant: AppPermission[]
}) {
  const [pending, setPending] = useState(false)
  const grantable = new Set(canGrant)

  return (
    <div className="grid gap-4">
      <ActionForm
        id={`permissions-${team.id}`}
        action={updateTeamPermissionsAction.bind(null, team.id)}
        submitLabel="Save"
        hideSubmit
        onPendingChange={setPending}
        className="gap-0"
      >
        {permissionGroups.map((group) => (
          <section key={group.label} className="mt-6 first:mt-0">
            <h2 className="text-sm font-medium">{group.label}</h2>
            <div className="mt-1">
              {group.items.map((item) => (
                <PermissionSwitch
                  key={item.permission}
                  permission={item.permission}
                  label={item.label}
                  description={item.description}
                  checked={team.permissions.includes(item.permission)}
                  disabled={!grantable.has(item.permission)}
                />
              ))}
            </div>
          </section>
        ))}
      </ActionForm>
      <Button
        type="submit"
        form={`permissions-${team.id}`}
        size="sm"
        disabled={pending}
        className="w-fit"
      >
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  )
}

function PermissionSwitch({
  permission,
  label,
  description,
  checked,
  disabled,
}: {
  permission: AppPermission
  label: string
  description: string
  checked: boolean
  disabled: boolean
}) {
  const [on, setOn] = useState(checked)
  return (
    <div className="flex items-center justify-between gap-6 border-b py-3">
      <div className="grid gap-0.5">
        <p className="text-sm">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={on}
        onCheckedChange={setOn}
        disabled={disabled}
        aria-label={label}
      />
      {on ? <input type="hidden" name="permissions" value={permission} /> : null}
    </div>
  )
}
