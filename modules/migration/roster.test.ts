import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseRoster, type RosterTeam } from "@/modules/migration/roster"

const teams: RosterTeam[] = [
  { code: "support", name: "Support worker" },
  { code: "complex_care", name: "Complex care" },
  { code: "leader", name: "Leader" },
  { code: "office", name: "Office" },
]

describe("parseRoster", () => {
  it("reads a staff export without asking which column is which", () => {
    const parsed = parseRoster(
      "First Name,Last Name,Email,Position\nJordan,Hale,jordan@example.com,Support worker\nSam,Okonkwo,sam@example.com,Team leader\n",
      teams
    )
    assert.deepEqual(parsed.rows, [
      {
        firstName: "Jordan",
        lastName: "Hale",
        email: "jordan@example.com",
        roles: ["support"],
      },
      {
        firstName: "Sam",
        lastName: "Okonkwo",
        email: "sam@example.com",
        roles: ["leader"],
      },
    ])
    assert.equal(parsed.skipped, 0)
  })

  it("reads a name column and skips a row with no email", () => {
    const parsed = parseRoster(
      "Name,Email\n\"Hale, Jordan\",jordan@example.com\nAlex Nguyen,\n",
      teams
    )
    assert.equal(parsed.rows.length, 1)
    assert.equal(parsed.rows[0]?.firstName, "Jordan")
    assert.equal(parsed.rows[0]?.lastName, "Hale")
    assert.deepEqual(parsed.rows[0]?.roles, ["support"])
    assert.equal(parsed.skipped, 1)
  })

  it("reads a headerless list and puts them on the support team", () => {
    const parsed = parseRoster("Ava Chen\tava@example.com\n", teams)
    assert.equal(parsed.rows[0]?.firstName, "Ava")
    assert.equal(parsed.rows[0]?.email, "ava@example.com")
    assert.deepEqual(parsed.rows[0]?.roles, ["support"])
  })

  it("uses the column that is mostly email addresses", () => {
    const parsed = parseRoster(
      "Ava Chen,notes,ava@example.com\nBob Lee,one address bob@old.test,bob@example.com\n",
      teams
    )
    assert.equal(parsed.rows[0]?.email, "ava@example.com")
    assert.equal(parsed.rows[1]?.email, "bob@example.com")
    assert.equal(parsed.rows[0]?.firstName, "Ava")
  })

  it("leaves a repeated email out", () => {
    const parsed = parseRoster(
      "Name,Email\nAva Chen,ava@example.com\nAva Chen,ava@example.com\n",
      teams
    )
    assert.equal(parsed.rows.length, 1)
    assert.equal(parsed.skipped, 1)
  })
})
