"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  EyeOff,
  LayoutGrid,
  ListFilter,
  Plus,
  Search,
  SlidersHorizontal,
  Table,
  X,
} from "lucide-react"

import { Chip, type ChipTone } from "@/components/chip"
import { DocumentViewButton } from "@/components/document-view-button"
import { EditReminderRuleButton } from "@/components/reminder-rule-actions"
import { CourseSettingsButton } from "@/components/course-settings-actions"
import { ReviewActions } from "@/components/review-actions"
import { ItemStatusBadge, OverallBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "cn"
import { overallLabels, type ComplianceItemStatus, type WorkerCompliance } from "@/modules/documents/compliance"
import type { StaffRole } from "@/modules/workforce/roles"
import type { ReminderCategory } from "@/modules/reminders/categories"

export type RecordCell =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "badge"; text: string; tone: "ok" | "warn" | "danger" | "neutral" }
  | { kind: "chip"; text: string; tone: ChipTone }
  | { kind: "overall"; overall: WorkerCompliance["overall"] }
  | { kind: "item"; status: ComplianceItemStatus; text: string }
  | { kind: "document"; text: string; documentId: string }
  | { kind: "review"; text: string; documentId: string }
  | { kind: "score"; met: number; total: number; percent: number }
  | { kind: "progress"; percent: number }
    | {
      kind: "rule"
      text: string
      ruleId: string
      category: ReminderCategory
      days: number
      subject: string
      body: string
    }
  | {
      kind: "courseSettings"
      text: string
      courseId: string
      title: string
      passMark: number
      renewalMonths: number | null
      roles: StaffRole[]
    }

export type RecordColumn = {
  id: string
  label: string
  /** Utility columns stay visible and skip sort, filter, and the header menu. */
  locked?: boolean
}

export type RecordRow = {
  id: string
  cells: Record<string, RecordCell>
}

type SortDirection = "asc" | "desc"
type FilterOperator = "contains" | "not_contains" | "is" | "is_not" | "empty" | "not_empty"

type SortRule = { id: string; columnId: string; direction: SortDirection }
type FilterRule = { id: string; columnId: string; operator: FilterOperator; value: string }

const operators: { id: FilterOperator; label: string; needsValue: boolean }[] = [
  { id: "contains", label: "contains", needsValue: true },
  { id: "not_contains", label: "does not contain", needsValue: true },
  { id: "is", label: "is", needsValue: true },
  { id: "is_not", label: "is not", needsValue: true },
  { id: "empty", label: "is empty", needsValue: false },
  { id: "not_empty", label: "is not empty", needsValue: false },
]

function cellText(cell: RecordCell | undefined) {
  if (!cell) return ""
  if (cell.kind === "score") return `${cell.met}/${cell.total} (${cell.percent}%)`
  if (cell.kind === "progress") return `${cell.percent}%`
  if (cell.kind === "overall") {
    return overallLabels[cell.overall]
  }
  return cell.text
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
}

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
      return value.length === 0 || value === "—"
    case "not_empty":
      return value.length > 0 && value !== "—"
    default: {
      const unreachable: never = rule.operator
      return unreachable
    }
  }
}

function CellView({
  cell,
  onFilter,
}: {
  cell: RecordCell | undefined
  onFilter?: (text: string) => void
}) {
  if (!cell) return "—"
  const pick = onFilter
    ? () => onFilter(cellText(cell))
    : undefined
  switch (cell.kind) {
    case "text":
      return cell.text || "—"
    case "link":
      return (
        <Link href={cell.href} className="font-medium text-foreground hover:underline">
          {cell.text}
        </Link>
      )
    case "badge":
      return (
        <Badge
          variant={
            cell.tone === "danger" ? "destructive" : cell.tone === "ok" ? "secondary" : "outline"
          }
        >
          {cell.text}
        </Badge>
      )
    case "chip":
      return (
        <button type="button" onClick={pick} className={pick ? "cursor-pointer" : undefined}>
          <Chip tone={cell.tone}>{cell.text}</Chip>
        </button>
      )
    case "score":
      return (
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#F1F2F4]">
            <span className="block h-full rounded-full bg-[#7BC96F]" style={{ width: `${cell.percent}%` }} />
          </span>
          <span>
            {cell.met}/{cell.total} ({cell.percent}%)
          </span>
        </span>
      )
    case "progress":
      return (
        <span className="flex min-w-28 items-center gap-2">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#F1F2F4]">
            <span className="block h-full rounded-full bg-[#7BC96F]" style={{ width: `${cell.percent}%` }} />
          </span>
          <span className="tabular-nums">{cell.percent}%</span>
        </span>
      )
    case "rule":
      return (
        <EditReminderRuleButton
          rule={{
            id: cell.ruleId,
            category: cell.category,
            days: cell.days,
            subject: cell.subject,
            body: cell.body,
          }}
        />
      )
    case "overall":
      return (
        <button type="button" onClick={pick} className={pick ? "cursor-pointer" : undefined}>
          <OverallBadge overall={cell.overall} />
        </button>
      )
    case "item":
      return (
        <button type="button" onClick={pick} className={pick ? "cursor-pointer" : undefined}>
          <ItemStatusBadge status={cell.status} />
        </button>
      )
    case "document":
      return <DocumentViewButton documentId={cell.documentId} />
    case "review":
      return <ReviewActions documentId={cell.documentId} />
    case "courseSettings":
      return (
        <CourseSettingsButton
          courseId={cell.courseId}
          title={cell.title}
          passMark={cell.passMark}
          renewalMonths={cell.renewalMonths}
          roles={cell.roles}
        />
      )
    default: {
      const unreachable: never = cell
      return unreachable
    }
  }
}

export function RecordTable({
  title,
  columns,
  rows,
  actions,
  empty = "No records",
  selectable = false,
  selectedIds,
  onSelectedChange,
  renderCard,
  pageSize = 50,
  initialFilters = [],
}: {
  title: string
  columns: RecordColumn[]
  rows: RecordRow[]
  actions?: React.ReactNode
  empty?: string
  selectable?: boolean
  selectedIds?: string[]
  onSelectedChange?: (ids: string[]) => void
  renderCard?: (row: RecordRow) => React.ReactNode
  pageSize?: number
  initialFilters?: Array<Pick<FilterRule, "columnId" | "operator" | "value">>
}) {
  const [order, setOrder] = useState(() => columns.map((column) => column.id))
  const [hidden, setHidden] = useState<string[]>([])
  const [sorts, setSorts] = useState<SortRule[]>([])
  const [filters, setFilters] = useState<FilterRule[]>(() =>
    initialFilters.map((rule) => ({
      id: `initial-${rule.columnId}-${rule.operator}`,
      columnId: rule.columnId,
      operator: rule.operator,
      value: rule.value,
    }))
  )
  const [internalSelected, setInternalSelected] = useState<string[]>([])
  const [filterQuery, setFilterQuery] = useState("")
  const [search, setSearch] = useState("")
  const [layout, setLayout] = useState<"table" | "cards">("table")
  const [page, setPage] = useState(0)
  const selected = selectedIds ?? internalSelected

  function setSelected(next: string[] | ((current: string[]) => string[])) {
    const resolved = typeof next === "function" ? next(selected) : next
    onSelectedChange?.(resolved)
    if (selectedIds === undefined) setInternalSelected(resolved)
  }

  const columnById = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns])
  const visibleIds = order.filter((id) => columnById.has(id) && !hidden.includes(id))
  const attributeColumns = columns.filter((column) => !column.locked)

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      if (needle) {
        const haystack = columns
          .map((column) => cellText(row.cells[column.id]))
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return filters.every((rule) => matchesFilter(cellText(row.cells[rule.columnId]), rule))
    })
    if (sorts.length === 0) return filtered
    return [...filtered].sort((left, right) => {
      for (const sort of sorts) {
        const result = compareText(cellText(left.cells[sort.columnId]), cellText(right.cells[sort.columnId]))
        if (result !== 0) return sort.direction === "asc" ? result : -result
      }
      return 0
    })
  }, [columns, filters, rows, search, sorts])

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = visibleRows.slice(safePage * pageSize, safePage * pageSize + pageSize)

  useEffect(() => {
    setPage(0)
  }, [search, filters, sorts])

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selected.includes(row.id))

  function filterColumn(columnId: string, text: string) {
    setFilters((current) => [
      ...current.filter((filter) => !(filter.columnId === columnId && filter.operator === "is")),
      { id: crypto.randomUUID(), columnId, operator: "is", value: text },
    ])
  }

  function toggleSort(columnId: string, direction: SortDirection) {
    setSorts((current) => {
      const existing = current.find((sort) => sort.columnId === columnId)
      if (existing) {
        return current.map((sort) => (sort.columnId === columnId ? { ...sort, direction } : sort))
      }
      return [...current, { id: crypto.randomUUID(), columnId, direction }]
    })
  }

  function moveRight(columnId: string) {
    setOrder((current) => {
      const visible = current.filter((id) => !hidden.includes(id))
      const index = visible.indexOf(columnId)
      const next = visible[index + 1]
      if (!next || columnById.get(next)?.locked) return current
      const from = current.indexOf(columnId)
      const to = current.indexOf(next)
      const copy = [...current]
      const [moved] = copy.splice(from, 1)
      copy.splice(to, 0, moved)
      return copy
    })
  }

  function hideColumn(columnId: string) {
    setHidden((current) => (current.includes(columnId) ? current : [...current, columnId]))
    setSorts((current) => current.filter((sort) => sort.columnId !== columnId))
    setFilters((current) => current.filter((filter) => filter.columnId !== columnId))
  }

  function toggleColumn(columnId: string, show: boolean) {
    setHidden((current) =>
      show ? current.filter((id) => id !== columnId) : current.includes(columnId) ? current : [...current, columnId]
    )
  }

  const sortLabel =
    sorts.length === 0
      ? "Sort"
      : `Sorted by ${columnById.get(sorts[0].columnId)?.label ?? "column"}${sorts.length > 1 ? ` +${sorts.length - 1}` : ""}`

  const attributeMatches = attributeColumns.filter((column) =>
    column.label.toLowerCase().includes(filterQuery.trim().toLowerCase())
  )

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2.5 rounded-[3px] bg-emerald-500" aria-hidden />
          {title}
        </p>
        <div className="flex items-center gap-1">
          {renderCard ? (
            <div className="flex items-center rounded-md border p-0.5">
              <Button
                type="button"
                variant={layout === "table" ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Table view"
                aria-pressed={layout === "table"}
                onClick={() => setLayout("table")}
              >
                <Table />
              </Button>
              <Button
                type="button"
                variant={layout === "cards" ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Card view"
                aria-pressed={layout === "cards"}
                onClick={() => setLayout("cards")}
              >
                <LayoutGrid />
              </Button>
            </div>
          ) : null}
          {actions}
          <Popover>
            <PopoverTrigger
              render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}
            >
              <SlidersHorizontal />
              View settings
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 gap-1 p-2">
              <p className="px-1.5 py-1 text-xs text-muted-foreground">Attributes</p>
              {attributeColumns.map((column) => {
                const shown = !hidden.includes(column.id)
                return (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted"
                  >
                    <Checkbox checked={shown} onCheckedChange={(checked) => toggleColumn(column.id, checked === true)} />
                    {column.label}
                  </label>
                )
              })}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            aria-label={`Search ${title}`}
            className="h-7 w-44 pl-7"
          />
        </div>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className={cn("text-muted-foreground", sorts.length > 0 && "text-foreground")}
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
                        item.id === sort.id ? { ...item, columnId: event.target.value } : item
                      )
                    )
                  }
                >
                  {attributeColumns.map((column) => (
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
                          ? { ...item, direction: event.target.value === "desc" ? "desc" : "asc" }
                          : item
                      )
                    )
                  }
                >
                  <NativeSelectOption value="asc">Ascending</NativeSelectOption>
                  <NativeSelectOption value="desc">Descending</NativeSelectOption>
                </NativeSelect>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove sort"
                  onClick={() => setSorts((current) => current.filter((item) => item.id !== sort.id))}
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
                const columnId = attributeColumns.find((column) => !sorts.some((sort) => sort.columnId === column.id))
                  ?.id
                if (!columnId) return
                setSorts((current) => [...current, { id: crypto.randomUUID(), columnId, direction: "asc" }])
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
                className={cn("text-muted-foreground", filters.length > 0 && "text-foreground")}
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
                      { id: crypto.randomUUID(), columnId: column.id, operator: "contains", value: "" },
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
            const operator = operators.find((item) => item.id === filter.operator)
            return (
              <div key={filter.id} className="flex flex-wrap items-center gap-1">
                <span className="px-1.5 text-sm">{columnById.get(filter.columnId)?.label}</span>
                <NativeSelect
                  size="sm"
                  value={filter.operator}
                  onChange={(event) =>
                    setFilters((current) =>
                      current.map((item) =>
                        item.id === filter.id
                          ? { ...item, operator: event.target.value as FilterOperator }
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
                          item.id === filter.id ? { ...item, value: event.target.value } : item
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
                  onClick={() => setFilters((current) => current.filter((item) => item.id !== filter.id))}
                >
                  <X />
                </Button>
              </div>
            )
          })}
        </div>
      ) : null}

      {layout === "cards" && renderCard ? (
        <div className="p-3">
          {selectable ? (
            <label className="mb-3 flex w-fit items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allVisibleSelected}
                aria-label="Select all"
                onCheckedChange={(checked) =>
                  setSelected(checked === true ? visibleRows.map((row) => row.id) : [])
                }
              />
              Select shown
            </label>
          ) : null}
          {visibleRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search.trim() || filters.length > 0 ? "No records match." : empty}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {pageRows.map((row) => (
                <div key={row.id}>{renderCard(row)}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b text-left text-xs font-normal text-muted-foreground">
              {selectable ? (
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allVisibleSelected}
                    aria-label="Select all"
                    onCheckedChange={(checked) =>
                      setSelected(checked === true ? visibleRows.map((row) => row.id) : [])
                    }
                  />
                </th>
              ) : null}
              {visibleIds.map((columnId) => {
                const column = columnById.get(columnId)
                if (!column) return null
                if (column.locked) {
                  return (
                    <th key={column.id} className="px-3 py-2 font-normal whitespace-nowrap">
                      {column.label}
                    </th>
                  )
                }
                return (
                  <th key={column.id} className="px-1 py-1 font-normal whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 font-normal text-muted-foreground"
                          />
                        }
                      >
                        {column.label}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-44">
                        <DropdownMenuItem onClick={() => toggleSort(column.id, "asc")}>
                          <ArrowUp />
                          Sort ascending
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleSort(column.id, "desc")}>
                          <ArrowDown />
                          Sort descending
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => moveRight(column.id)}>
                          <ArrowRight />
                          Move right
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => hideColumn(column.id)}>
                          <EyeOff />
                          Hide from view
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={visibleIds.length + (selectable ? 1 : 0)} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {search.trim() || filters.length > 0 ? "No records match." : empty}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                  {selectable ? (
                    <td className="px-3 py-1.5">
                      <Checkbox
                        checked={selected.includes(row.id)}
                        aria-label="Select row"
                        onCheckedChange={(checked) =>
                          setSelected((current) =>
                            checked === true ? [...current, row.id] : current.filter((id) => id !== row.id)
                          )
                        }
                      />
                    </td>
                  ) : null}
                  {visibleIds.map((columnId) => (
                    <td key={columnId} className="px-3 py-1.5 whitespace-nowrap">
                      <CellView cell={row.cells[columnId]} onFilter={(text) => filterColumn(columnId, text)} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      <div className="flex items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
        {selectable && selected.length > 0 ? <span>{selected.length} selected</span> : null}
        <span>
          {visibleRows.length === 0
            ? "0 count"
            : visibleRows.length <= pageSize
              ? `${visibleRows.length} count`
              : `${safePage * pageSize + 1}–${Math.min(visibleRows.length, (safePage + 1) * pageSize)} of ${visibleRows.length}`}
        </span>
        {pageCount > 1 ? (
          <span className="ml-auto flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </span>
        ) : null}
      </div>
    </div>
  )
}
