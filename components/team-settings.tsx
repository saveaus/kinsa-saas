"use client"

import { Plus } from "lucide-react"
import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import { EmptyState } from "@/components/empty-state"
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
import {
  createTeamAction,
  deleteTeamAction,
  updateTeamAction,
} from "@/modules/teams/actions"
import type { TeamRecord } from "@/modules/teams/queries"

export function TeamSettings({ teams }: { teams: TeamRecord[] }) {
  return (
    <div className="grid gap-3">
      {teams.length === 0 ? (
        <EmptyState
          compact
          title="No teams yet"
          description="Create a team, then choose what people on it can do."
          action={<CreateTeamDialog />}
        />
      ) : (
        <>
          <div className="flex justify-end">
            <CreateTeamDialog />
          </div>
          <ul className="divide-y overflow-hidden rounded-lg border">
            {teams.map((team) => (
              <li
                key={team.id}
                className="flex items-center gap-2 px-3 py-2"
              >
                <p className="min-w-0 flex-1 truncate text-sm">{team.name}</p>
                <EditTeamDialog team={team} />
                <DeleteTeamDialog team={team} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function CreateTeamDialog() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
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

function EditTeamDialog({ team }: { team: TeamRecord }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
          <DialogDescription>
            This name is what people see when they pick a team.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={updateTeamAction.bind(null, team.id)}
          submitLabel="Save"
          onSuccess={() => setOpen(false)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`name-${team.id}`}>Name</Label>
            <Input
              id={`name-${team.id}`}
              name="name"
              required
              maxLength={80}
              defaultValue={team.name}
            />
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTeamDialog({ team }: { team: TeamRecord }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-destructive" />
        }
      >
        Delete
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {team.name}?</DialogTitle>
          <DialogDescription>
            Move people off this team first. Credentials and courses required
            for it are cleared. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={deleteTeamAction.bind(null, team.id)}
          submitLabel="Delete team"
          pendingLabel="Deleting..."
          submitVariant="destructive"
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
