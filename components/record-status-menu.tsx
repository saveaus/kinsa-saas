"use client"

import { useEffect, useState, useTransition } from "react"

import { Chip, type ChipTone } from "@/components/chip"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  acceptIncidentAction,
  deleteIncidentDraftAction,
} from "@/modules/incidents/actions"
import {
  acceptLogEntryAction,
  deleteLogEntryDraftAction,
} from "@/modules/logs/actions"
import {
  acceptParticipantRecordAction,
  deleteParticipantRecordDraftAction,
} from "@/modules/participants/actions"
import {
  acceptPolicyAction,
  deletePolicyDraftAction,
} from "@/modules/policies/actions"
import {
  acceptSupportPlanCheckAction,
  deleteSupportPlanCheckDraftAction,
} from "@/modules/support-plan-checks/actions"

export type RecordStatusTarget =
  | { kind: "policy"; id: string }
  | { kind: "incident"; id: string }
  | { kind: "log"; id: string }
  | { kind: "supportPlanCheck"; id: string }
  | { kind: "participantRecord"; id: string }

type Choice = "accept" | "remove"

export function RecordStatusMenu({
  draft,
  label,
  tone,
  acceptedLabel,
  acceptedTone,
  target,
}: {
  draft: boolean
  label: string
  tone: ChipTone
  acceptedLabel: string
  acceptedTone: ChipTone
  target: RecordStatusTarget
}) {
  const [accepted, setAccepted] = useState(!draft)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setAccepted(!draft)
  }, [draft])

  function choose(choice: Choice) {
    if (pending || accepted) return
    if (choice === "accept") setAccepted(true)
    setError(null)
    startTransition(async () => {
      const result = await applyStatus(target, choice)
      if (result.error) {
        setAccepted(false)
        setError(result.error)
      }
    })
  }

  const shownLabel = accepted ? acceptedLabel : label
  const shownTone = accepted ? acceptedTone : tone

  if (accepted) {
    return <Chip tone={shownTone}>{shownLabel}</Chip>
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          aria-label="Record status"
          className="flex max-w-full flex-wrap gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <Chip tone={shownTone}>{shownLabel}</Chip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuCheckboxItem checked closeOnClick={false}>
            Draft
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={false}
            closeOnClick={false}
            onCheckedChange={(checked) => {
              if (checked) choose("accept")
            }}
          >
            {acceptedLabel}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => choose("remove")}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  )
}

function applyStatus(target: RecordStatusTarget, choice: Choice) {
  const previous = {}
  const formData = new FormData()
  switch (target.kind) {
    case "policy":
      return choice === "accept"
        ? acceptPolicyAction(target.id, previous, formData)
        : deletePolicyDraftAction(target.id, previous, formData)
    case "incident":
      return choice === "accept"
        ? acceptIncidentAction(target.id, previous, formData)
        : deleteIncidentDraftAction(target.id, previous, formData)
    case "log":
      return choice === "accept"
        ? acceptLogEntryAction(target.id, previous, formData)
        : deleteLogEntryDraftAction(target.id, previous, formData)
    case "supportPlanCheck":
      return choice === "accept"
        ? acceptSupportPlanCheckAction(target.id, previous, formData)
        : deleteSupportPlanCheckDraftAction(target.id, previous, formData)
    case "participantRecord":
      return choice === "accept"
        ? acceptParticipantRecordAction(target.id, previous, formData)
        : deleteParticipantRecordDraftAction(target.id, previous, formData)
    default: {
      const unreachable: never = target
      return unreachable
    }
  }
}
