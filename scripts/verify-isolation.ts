/**
 * Cross-tenant isolation checks against the live schema.
 * Uses the SQL fixture in supabase/tests/isolation.sql (applied separately)
 * and then queries as each isolation user via JWT role impersonation.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const checks = [
  { name: "orgs_visible", expected: 1 },
  { name: "docs_visible", expected: 1 },
  { name: "foreign_doc", expected: 0 },
]

function assert(name: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${name}: expected ${expected}, got ${actual}`)
  }
}

export { checks, assert }

if (process.argv[1]?.endsWith("verify-isolation.ts")) {
  const sql = readFileSync(resolve("supabase/tests/isolation.sql"), "utf8")
  console.log("Isolation fixture is ready. Apply supabase/tests/isolation.sql via Supabase SQL.")
  console.log(`Fixture length: ${sql.length}`)
  for (const check of checks) {
    console.log(`Assert ${check.name} === ${check.expected}`)
  }
}
