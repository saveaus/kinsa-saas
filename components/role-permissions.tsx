"use client"

import { Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "cn"
import type { AppPermission } from "@/lib/database.types"
import {
  createTeamAction,
  deleteTeamAction,
  updateTeamAction,
} from "@/modules/teams/actions"
import { permissionGroups } from "@/modules/teams/permissions"
import type { TeamRecord } from "@/modules/teams/queries"

export function RolePermissions({
  teams,
  selectedCode,
  canGrant,
}: {
  teams: TeamRecord[]
  selectedCode: string | null
  canGrant: AppPermission[]
}) {
  const selected = teams.find((team) => team.code === selectedCode) ?? teams[0]

  return (
    <div className="grid items-start gap-8 md:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="grid content-start gap-3">
        <CreateTeamDialog />
        <nav aria-label="Teams" className="grid gap-0.5">
          {teams.map((team) => {
            const active = team.code === selected?.code
            return (
              <Link
                key={team.id}
                href={`/settings/roles?team=${team.code}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2 py-1.5 hover:bg-muted",
                  active && "bg-muted"
                )}
              >
                <span className="block truncate text-sm">{team.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {team.builtIn ? "Standard" : "Custom"}
                  <span className="px-1" aria-hidden="true">
                    ·
                  </span>
                  {team.permissions.length}{" "}
                  {team.permissions.length === 1 ? "permission" : "permissions"}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
      {selected ? (
        <TeamEditor key={selected.id} team={selected} canGrant={canGrant} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Create a team to choose what that worker type can do.
        </p>
      )}
    </div>
  )
}

function CreateTeamDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="w-full" />}>
        <Plus />
        Create team
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>
            A team is a worker type. You can require credentials for it and
            choose what people on it can do.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={createTeamAction}
          submitLabel="Create team"
          onSuccess={() => setOpen(false)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              name="name"
              required
              maxLength={80}
              placeholder="Allied health"
            />
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

function TeamEditor({
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
        id="team-form"
        action={updateTeamAction.bind(null, team.id)}
        submitLabel="Save"
        hideSubmit
        onPendingChange={setPending}
        className="gap-0"
      >
        <div className="grid max-w-sm gap-1.5">
          <Label htmlFor={`name-${team.id}`}>Name</Label>
          <Input
            id={`name-${team.id}`}
            name="name"
            required
            maxLength={80}
            defaultValue={team.name}
          />
        </div>
        {permissionGroups.map((group) => (
          <section key={group.label} className="mt-6">
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
      <div className="flex items-center justify-between gap-3">
        {team.builtIn ? (
          <p className="text-sm text-muted-foreground">
            Standard teams can be renamed.
          </p>
        ) : (
          <ActionForm
            action={deleteTeamAction.bind(null, team.id)}
            submitLabel="Delete"
            submitVariant="destructive"
            submitSize="sm"
            className="gap-0"
          />
        )}
        <Button type="submit" form="team-form" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
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
      {on ? (
        <input type="hidden" name="permissions" value={permission} />
      ) : null}
    </div>
  )
}
