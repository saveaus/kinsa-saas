"use client"

import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Team = { code: string; name: string }
type Person = { id: string; firstName: string; lastName: string }
type DocType = { id: string; name: string }

export type StaffDraft = {
  firstName: string
  lastName: string
  email: string
  roles: string[]
}

export type CertificateDraft = {
  file: File
  workerId: string
  typeId: string
}

export function AssistantImport({
  staff,
  certificates,
  teams,
  workers,
  types,
  busy,
  onStaffRole,
  onCertificate,
  onApprove,
  onDismiss,
}: {
  staff?: { people: StaffDraft[]; skipped: number } | null
  certificates?: CertificateDraft[] | null
  teams: Team[]
  workers: Person[]
  types: DocType[]
  busy: boolean
  onStaffRole: (index: number, role: string) => void
  onCertificate: (index: number, patch: { workerId?: string; typeId?: string }) => void
  onApprove: () => void
  onDismiss: () => void
}) {
  const certificateList = certificates ?? []
  if (certificateList.length === 0 && !staff?.people.length) return null
  const certificatesReady = certificateList.every((item) => item.workerId && item.typeId)
  const ready = staff ? staff.people.length > 0 : certificatesReady
  return (
    <div className="mb-3 rounded-2xl border bg-card p-3 shadow-sm">
      {staff ? (
        <div className="grid gap-2">
          <p className="text-sm">
            {staff.people.length === 1 ? "1 person is ready to add." : `${staff.people.length} people are ready to add.`}
            {staff.skipped === 1 ? " 1 row was left out." : ""}
            {staff.skipped > 1 ? ` ${staff.skipped} rows were left out.` : ""}
          </p>
          <div className="grid max-h-52 gap-2 overflow-y-auto">
            {staff.people.map((person, index) => (
              <div key={person.email} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <p className="truncate text-sm">
                  {person.firstName} {person.lastName}
                  <span className="text-muted-foreground"> · {person.email}</span>
                </p>
                <NativeSelect
                  className="w-full"
                  size="sm"
                  aria-label={`Team for ${person.firstName} ${person.lastName}`}
                  value={person.roles[0] ?? ""}
                  onChange={(event) => onStaffRole(index, event.target.value)}
                >
                  {teams.map((team) => (
                    <NativeSelectOption key={team.code} value={team.code}>
                      {team.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {certificates ? (
        <div className="grid gap-2">
          <p className="text-sm">
            {certificates.length === 1
              ? "1 certificate is ready to file."
              : `${certificates.length} certificates are ready to file.`}
          </p>
          <div className="grid max-h-52 gap-2 overflow-y-auto">
            {certificates.map((item, index) => (
              <div key={`${item.file.name}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
                <p className="truncate text-sm">{item.file.name}</p>
                <NativeSelect
                  className="w-full"
                  size="sm"
                  aria-label={`Worker for ${item.file.name}`}
                  value={item.workerId}
                  onChange={(event) => onCertificate(index, { workerId: event.target.value })}
                >
                  <NativeSelectOption value="">Worker</NativeSelectOption>
                  {workers.map((worker) => (
                    <NativeSelectOption key={worker.id} value={worker.id}>
                      {worker.firstName} {worker.lastName}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <NativeSelect
                  className="w-full"
                  size="sm"
                  aria-label={`Type for ${item.file.name}`}
                  value={item.typeId}
                  onChange={(event) => onCertificate(index, { typeId: event.target.value })}
                >
                  <NativeSelectOption value="">Type</NativeSelectOption>
                  {types.map((type) => (
                    <NativeSelectOption key={type.id} value={type.id}>
                      {type.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" disabled={busy || !ready} onClick={onApprove}>
          {busy ? (staff ? "Adding…" : "Filing…") : staff ? "Add them" : "File them"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>
          Not these
        </Button>
      </div>
    </div>
  )
}
