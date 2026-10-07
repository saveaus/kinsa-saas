"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpDown, ListFilter, Plus, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import { cn } from "cn"
import { setCredentialTeamAction } from "@/modules/documents/actions"

type Credential = { id: string; name: string; roles: string[] }
type TeamChoice = { code: string; name: string }
type ColumnId = "name" | "required"
type FilterOperator =
  "contains" | "not_contains" | "is" | "is_not" | "empty" | "not_empty"
type SortDirection = "asc" | "desc"
type FilterRule = {
  id: string
  columnId: ColumnId
  operator: FilterOperator
  value: string
}
type SortRule = { id: string; columnId: ColumnId; direction: SortDirection }

const columns: { id: ColumnId; label: string }[] = [
  { id: "name", label: "Credential" },
  { id: "required", label: "Required" },
]

const operators: { id: FilterOperator; label: string; needsValue: boolean }[] =
  [
    { id: "contains", label: "contains", needsValue: true },
    { id: "not_contains", label: "does not contain", needsValue: true },
    { id: "is", label: "is", needsValue: true },
    { id: "is_not", label: "is not", needsValue: true },
    { id: "empty", label: "is empty", needsValue: false },
    { id: "not_empty", label: "is not empty", needsValue: false },
  ]

function matchesFilter(text: string, rule: FilterRule) {
  const value = text.trim().toLowerCase()
  const query = rule.value.trim().toLowerCase()
  switch (rule.operator) {
    case "contains":
      return query.length === 0 || value.includes(query)
    case "not_contains":
      return query.length === 0 || !value.includes(query)
    case "is":
      return query.length === 0 || value === query
    case "is_not":
      return query.length === 0 || value !== query
    case "empty":
      return value.length === 0
    case "not_empty":
      return value.length > 0
    default: {
      const unreachable: never = rule.operator
      return unreachable
    }
  }
}

export function CredentialTeams({
  teams,
  credentials,
  initialTeam,
}: {
  teams: TeamChoice[]
  credentials: Credential[]
  initialTeam: string | null
}) {
  const router = useRouter()
  const [teamCode, setTeamCode] = useState(
    teams.some((team) => team.code === initialTeam)
      ? (initialTeam ?? teams[0]?.code ?? "")
      : (teams[0]?.code ?? "")
  )
  const [assigned, setAssigned] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      credentials.map((credential) => [credential.id, credential.roles])
    )
  )
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<FilterRule[]>([])
  const [sorts, setSorts] = useState<SortRule[]>([])
  const [filterQuery, setFilterQuery] = useState("")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const team = teams.find((item) => item.code === teamCode) ?? teams[0]
  const requiredCount = useMemo(() => {
    if (!team) return 0
    return credentials.filter((credential) =>
      (assigned[credential.id] ?? []).includes(team.code)
    ).length
  }, [assigned, credentials, team])

  const shown = useMemo(() => {
    if (!team) return []
    const needle = search.trim().toLowerCase()
    const rows = credentials.filter((credential) => {
      const values = valuesFor(credential, team.code, assigned)
      if (
        needle &&
        !`${values.name} ${values.required}`.toLowerCase().includes(needle)
      ) {
        return false
      }
      return filters.every((rule) => matchesFilter(values[rule.columnId], rule))
    })
    if (sorts.length === 0) return rows
    return [...rows].sort((left, right) => {
      const leftValues = valuesFor(left, team.code, assigned)
      const rightValues = valuesFor(right, team.code, assigned)
      for (const sort of sorts) {
        const result = leftValues[sort.columnId].localeCompare(
          rightValues[sort.columnId],
          undefined,
          { numeric: true, sensitivity: "base" }
        )
        if (result !== 0) return sort.direction === "asc" ? result : -result
      }
      return 0
    })
  }, [assigned, credentials, filters, search, sorts, team])

  const attributeMatches = columns.filter((column) =>
    column.label.toLowerCase().includes(filterQuery.trim().toLowerCase())
  )
  const sortLabel =
    sorts.length === 0
      ? "Sort"
      : `Sorted by ${columns.find((column) => column.id === sorts[0].columnId)?.label ?? "column"}${sorts.length > 1 ? ` +${sorts.length - 1}` : ""}`

  function chooseTeam(code: string) {
    setTeamCode(code)
    router.replace(`/settings/credentials?team=${code}`, { scroll: false })
  }

  function toggle(credential: Credential, next: boolean) {
    if (!team || pendingId) return
    const previous = assigned[credential.id] ?? []
    const optimistic = next
      ? [...new Set([...previous, team.code])]
      : previous.filter((code) => code !== team.code)
    setAssigned((current) => ({ ...current, [credential.id]: optimistic }))
    setPendingId(credential.id)
    startTransition(async () => {
      const result = await setCredentialTeamAction(
        credential.id,
        team.code,
        next
      )
      setPendingId(null)
      if (result.error) {
        setAssigned((current) => ({ ...current, [credential.id]: previous }))
        toast.add({ title: result.error, type: "error", timeout: 4000 })
        return
      }
      router.refresh()
    })
  }

  if (!team) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a team under Roles and permissions before choosing credentials.
      </p>
    )
  }

  return (
    <div className="grid gap-4">
      <Tabs value={team.code} onValueChange={chooseTeam}>
        <TabsList
          variant="line"
          className="h-9 w-full max-w-full justify-start overflow-x-auto border-b px-0"
        >
          {teams.map((item) => (
            <TabsTrigger
              key={item.code}
              value={item.code}
              className="flex-none px-2.5 text-[13px] font-normal"
            >
              {item.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search credentials"
              className="h-7 w-44 pl-7"
            />
          </div>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-muted-foreground",
                    sorts.length > 0 && "text-foreground"
                  )}
                />
              }
            >
              <ArrowUpDown />
              {sortLabel}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 gap-2 p-2">
              {sorts.map((sort) => (
                <div key={sort.id} className="flex items-center gap-1">
                  <NativeSelect
                    size="sm"
                    value={sort.columnId}
                    className="min-w-0 flex-1"
                    onChange={(event) =>
                      setSorts((current) =>
                        current.map((item) =>
                          item.id === sort.id
                            ? {
                                ...item,
                                columnId: asColumnId(event.target.value),
                              }
                            : item
                        )
                      )
                    }
                  >
                    {columns.map((column) => (
                      <NativeSelectOption key={column.id} value={column.id}>
                        {column.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    size="sm"
                    value={sort.direction}
                    onChange={(event) =>
                      setSorts((current) =>
                        current.map((item) =>
                          item.id === sort.id
                            ? {
                                ...item,
                                direction:
                                  event.target.value === "desc"
                                    ? "desc"
                                    : "asc",
                              }
                            : item
                        )
                      )
                    }
                  >
                    <NativeSelectOption value="asc">
                      Ascending
                    </NativeSelectOption>
                    <NativeSelectOption value="desc">
                      Descending
                    </NativeSelectOption>
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove sort"
                    onClick={() =>
                      setSorts((current) =>
                        current.filter((item) => item.id !== sort.id)
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground"
                onClick={() => {
                  const columnId = columns.find(
                    (column) =>
                      !sorts.some((sort) => sort.columnId === column.id)
                  )?.id
                  if (!columnId) return
                  setSorts((current) => [
                    ...current,
                    { id: crypto.randomUUID(), columnId, direction: "asc" },
                  ])
                }}
              >
                <Plus />
                Add sort
              </Button>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-muted-foreground",
                    filters.length > 0 && "text-foreground"
                  )}
                />
              }
            >
              <ListFilter />
              {filters.length > 0 ? `Filter · ${filters.length}` : "Filter"}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 gap-1 p-2">
              <Input
                value={filterQuery}
                onChange={(event) => setFilterQuery(event.target.value)}
                placeholder="Search attributes..."
                className="h-7"
              />
              <div className="max-h-56 overflow-y-auto">
                {attributeMatches.map((column) => (
                  <button
                    key={column.id}
                    type="button"
                    className="flex w-full rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setFilters((current) => [
                        ...current,
                        {
                          id: crypto.randomUUID(),
                          columnId: column.id,
                          operator: "contains",
                          value: "",
                        },
                      ])
                      setFilterQuery("")
                    }}
                  >
                    {column.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {filters.length > 0 ? (
          <div className="flex flex-col gap-1 border-b px-2 py-1.5">
            {filters.map((filter) => {
              const operator = operators.find(
                (item) => item.id === filter.operator
              )
              return (
                <div
                  key={filter.id}
                  className="flex flex-wrap items-center gap-1"
                >
                  <span className="px-1.5 text-sm">
                    {
                      columns.find((column) => column.id === filter.columnId)
                        ?.label
                    }
                  </span>
                  <NativeSelect
                    size="sm"
                    value={filter.operator}
                    onChange={(event) =>
                      setFilters((current) =>
                        current.map((item) =>
                          item.id === filter.id
                            ? {
                                ...item,
                                operator: asOperator(event.target.value),
                              }
                            : item
                        )
                      )
                    }
                  >
                    {operators.map((item) => (
                      <NativeSelectOption key={item.id} value={item.id}>
                        {item.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {operator?.needsValue ? (
                    <Input
                      value={filter.value}
                      onChange={(event) =>
                        setFilters((current) =>
                          current.map((item) =>
                            item.id === filter.id
                              ? { ...item, value: event.target.value }
                              : item
                          )
                        )
                      }
                      placeholder="Value"
                      className="h-7 w-40"
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove filter"
                    onClick={() =>
                      setFilters((current) =>
                        current.filter((item) => item.id !== filter.id)
                      )
                    }
                  >
                    <X />
                  </Button>
                </div>
              )
            })}
          </div>
        ) : null}
        <div>
          {shown.map((credential) => {
            const on = (assigned[credential.id] ?? []).includes(team.code)
            return (
              <div
                key={credential.id}
                className="flex items-center justify-between gap-4 border-b px-3 py-2 last:border-0"
              >
                <p className="text-[13px]">{credential.name}</p>
                <Switch
                  checked={on}
                  disabled={pendingId === credential.id}
                  onCheckedChange={(checked) => toggle(credential, checked)}
                  aria-label={`${credential.name} required for ${team.name}`}
                />
              </div>
            )
          })}
          {shown.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              No credentials match.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {shown.length === credentials.length
              ? `${credentials.length} count`
              : `${shown.length} of ${credentials.length}`}
          </span>
          <span>
            {requiredCount} of {credentials.length} required for {team.name}
          </span>
        </div>
      </div>
    </div>
  )
}

function valuesFor(
  credential: Credential,
  teamCode: string,
  assigned: Record<string, string[]>
) {
  const on = (assigned[credential.id] ?? []).includes(teamCode)
  return {
    name: credential.name,
    required: on ? "Required" : "Not required",
  }
}

function asColumnId(value: string): ColumnId {
  switch (value) {
    case "name":
    case "required":
      return value
    default:
      return "name"
  }
}

function asOperator(value: string): FilterOperator {
  switch (value) {
    case "contains":
    case "not_contains":
    case "is":
    case "is_not":
    case "empty":
    case "not_empty":
      return value
    default:
      return "contains"
  }
}
