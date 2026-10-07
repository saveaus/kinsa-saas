import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { ALL_PERMISSIONS } from "@/lib/permissions"
import { teamCodeFromName } from "@/modules/teams/code"
import { listedPermissions } from "@/modules/teams/permissions"
import { asStaffRoles } from "@/modules/workforce/roles"

describe("team codes", () => {
  it("slugs a name and avoids reserved or taken codes", () => {
    assert.equal(teamCodeFromName("Allied health", []), "allied_health")
    assert.equal(teamCodeFromName("Support", []), "support_2")
    assert.equal(
      teamCodeFromName("Allied health", ["allied_health"]),
      "allied_health_2"
    )
    assert.equal(teamCodeFromName("123", []), "team")
  })
})

describe("staff role codes", () => {
  it("keeps custom team codes and drops malformed ones", () => {
    assert.deepEqual(
      asStaffRoles(["office", "allied_health", "support", "Bad Code"]),
      ["support", "office", "allied_health"]
    )
  })
})

describe("permission catalogue", () => {
  it("lists every application permission once", () => {
    const listed = listedPermissions()
    assert.deepEqual([...listed].sort(), [...ALL_PERMISSIONS].sort())
    assert.equal(new Set(listed).size, listed.length)
  })
})
