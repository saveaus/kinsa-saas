import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  parseRecordCard,
  recordCardLimit,
  recordCardsFromParts,
  selectRecords,
} from "@/modules/assistant/records"
import type { PackItem } from "@/modules/audit-pack/score"

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

describe("selectRecords", () => {
  it("shows open items first, worst first", () => {
    const card = selectRecords(
      [
        item({ key: "a", label: "Complaints", status: "met", detail: "Accepted" }),
        item({ key: "b", label: "Incidents", status: "lapsing", detail: "Review due soon" }),
        item({ key: "c", label: "Risk", status: "overdue", detail: "Review overdue" }),
      ],
      {}
    )
    assert.equal(card.matched, 2)
    assert.deepEqual(
      card.items.map((row) => row.label),
      ["Risk", "Incidents"]
    )
  })

  it("filters by area", () => {
    const card = selectRecords(
      [
        item({ key: "a", label: "Complaints" }),
        item({ key: "b", label: "Jo Chen · First aid", area: "clearance", status: "missing" }),
      ],
      { area: "clearance" }
    )
    assert.equal(card.title, "Open credential items")
    assert.deepEqual(card.items.map((row) => row.label), ["Jo Chen · First aid"])
  })

  it("falls back to current records when a search misses the gaps", () => {
    const card = selectRecords(
      [
        item({ key: "a", label: "Complaints management", status: "met", detail: "Accepted" }),
        item({ key: "b", label: "Risk", status: "missing" }),
      ],
      { query: "complaints" }
    )
    assert.equal(card.matched, 1)
    assert.equal(card.items[0]?.status, "met")
  })

  it("matches a status word like missing", () => {
    const card = selectRecords(
      [
        item({ key: "a", label: "Complaints", status: "missing", detail: "No policy" }),
        item({ key: "b", label: "Risk", status: "overdue", detail: "Review overdue" }),
      ],
      { query: "missing" }
    )
    assert.deepEqual(card.items.map((row) => row.label), ["Complaints"])
  })

  it("caps the rows and reports the full match count", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      item({ key: `k${index}`, label: `Item ${String.fromCharCode(65 + index)}` })
    )
    const card = selectRecords(many, {})
    assert.equal(card.items.length, recordCardLimit)
    assert.equal(card.matched, 12)
  })
})

describe("record card parsing", () => {
  it("keeps a stored card", () => {
    const card = parseRecordCard({
      title: "Open items",
      matched: 3,
      items: [
        { label: "Risk", status: "overdue", detail: "Review overdue", href: "/policies/1" },
      ],
    })
    assert.equal(card?.title, "Open items")
    assert.equal(card?.matched, 3)
    assert.equal(card?.items.length, 1)
  })

  it("drops rows with an outside link or unknown status", () => {
    const card = parseRecordCard({
      title: "Open items",
      items: [
        { label: "Risk", status: "overdue", detail: "", href: "https://example.com" },
        { label: "Risk", status: "terrible", detail: "", href: "/policies/1" },
      ],
    })
    assert.equal(card?.items.length, 0)
  })

  it("reads cards from finished tool parts only", () => {
    const output = {
      title: "Open items",
      matched: 1,
      items: [{ label: "Risk", status: "missing", detail: "No policy", href: "/policies" }],
    }
    const cards = recordCardsFromParts([
      { type: "tool-show_records", state: "output-available", output },
      { type: "tool-show_records", state: "input-available", output },
      { type: "text", text: "Start with risk." },
    ])
    assert.equal(cards.length, 1)
  })
})
