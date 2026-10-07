import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { PackItem } from "@/modules/audit-pack/score"
import {
  parseSnapshot,
  selectReportSnapshot,
  selectWorkerSnapshot,
  snapshotsFromParts,
  type SnapshotWorker,
} from "@/modules/assistant/snapshots"

function worker(overrides: Partial<SnapshotWorker> & Pick<SnapshotWorker, "id" | "name">): SnapshotWorker {
  return {
    team: "Support worker",
    percent: 50,
    met: 1,
    total: 2,
    points: [{ label: "NDIS screening", status: "missing" }],
    ...overrides,
  }
}

function item(overrides: Partial<PackItem>): PackItem {
  return {
    key: "policy:core.complaints",
    label: "Complaints management",
    area: "policy",
    status: "missing",
    detail: "No policy",
    href: "/policies",
    ...overrides,
  }
}

describe("selectWorkerSnapshot", () => {
  const people = [
    worker({ id: "sam", name: "Sam Patel", percent: 25, met: 1, total: 4 }),
    worker({ id: "samantha", name: "Samantha Lee", percent: 100, met: 2, total: 2 }),
    worker({ id: "izak", name: "Izak Reeves", percent: 0, met: 0, total: 3 }),
  ]

  it("shows the profile graph for an exact name", () => {
    const result = selectWorkerSnapshot(people, "Izak Reeves")
    assert.equal(result.shown, true)
    if (!result.shown) return
    assert.equal(result.snapshots.length, 1)
    const snapshot = result.snapshots[0]
    assert.equal(snapshot?.kind, "worker")
    if (snapshot?.kind !== "worker") return
    assert.equal(snapshot.href, "/workers/izak")
    assert.equal(snapshot.percent, 0)
    assert.equal(snapshot.score, "0/3")
    assert.equal(snapshot.points[0]?.status, "missing")
  })

  it("matches a first name without pulling in a longer name", () => {
    const result = selectWorkerSnapshot(people, "Sam")
    assert.equal(result.shown, true)
    if (!result.shown) return
    assert.deepEqual(
      result.snapshots.map((snapshot) => (snapshot.kind === "worker" ? snapshot.name : "")),
      ["Sam Patel"]
    )
  })

  it("asks which person when two workers share a name", () => {
    const result = selectWorkerSnapshot(
      [
        worker({ id: "a", name: "Izak Reeves", team: "Office", percent: 10 }),
        worker({ id: "b", name: "Izak Reeves", team: "Support worker", percent: 80 }),
      ],
      "Izak Reeves"
    )
    assert.equal(result.shown, true)
    if (!result.shown) return
    const snapshot = result.snapshots[0]
    assert.equal(snapshot?.kind, "choices")
    if (snapshot?.kind !== "choices") return
    assert.deepEqual(
      snapshot.people.map((person) => person.percent),
      [10, 80]
    )
  })

  it("asks which worker when several share the name", () => {
    const result = selectWorkerSnapshot(
      [
        worker({ id: "a", name: "Sam Patel" }),
        worker({ id: "b", name: "Sam Nguyen" }),
        worker({ id: "c", name: "Sam Brooks" }),
        worker({ id: "d", name: "Sam Chen" }),
      ],
      "Sam"
    )
    assert.equal(result.shown, false)
    if (result.shown) return
    assert.match(result.reason, /Sam Patel/)
  })
})

describe("selectReportSnapshot", () => {
  it("uses the dashboard readiness gauge", () => {
    const snapshot = selectReportSnapshot(
      [item({ status: "met", key: "a" }), item({ status: "missing", key: "b" })],
      "readiness"
    )
    assert.equal(snapshot.href, "/dashboard")
    assert.equal(snapshot.report.id, "readiness")
    assert.equal(snapshot.report.chart, "gauge")
    assert.equal(snapshot.report.figure, "50%")
  })

  it("uses the open-items chart and the area breakdown", () => {
    const items = [item({ status: "overdue", area: "incident", key: "c" })]
    assert.equal(selectReportSnapshot(items, "open_items").report.id, "open-items")
    assert.equal(selectReportSnapshot(items, "areas").report.chart, "breakdown")
  })
})

describe("snapshotsFromParts", () => {
  it("reads a finished tool result and ignores a snapshot that is still streaming", () => {
    const ready = selectWorkerSnapshot(
      [worker({ id: "izak", name: "Izak Reeves" })],
      "Izak Reeves"
    )
    const snapshots = snapshotsFromParts([
      { type: "tool-show_snapshot", state: "output-available", output: ready },
      { type: "tool-show_snapshot", state: "input-available", output: ready },
    ])
    assert.equal(snapshots.length, 1)
    assert.equal(parseSnapshot(snapshots[0])?.kind, "worker")
  })
})
