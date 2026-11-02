import assert from "node:assert/strict"
import test from "node:test"

import { csvCell } from "@/lib/csv"

test("spreadsheet formulas are neutralised", () => {
  assert.equal(csvCell("=1+1"), "'=1+1")
  assert.equal(csvCell('=HYPERLINK("https://evil","Open").pdf'), `"'=HYPERLINK(""https://evil"",""Open"").pdf"`)
  assert.equal(csvCell("@cmd"), "'@cmd")
})

test("plain text and quoting stay as they were", () => {
  assert.equal(csvCell("Abbacare"), "Abbacare")
  assert.equal(csvCell("-"), "-")
  assert.equal(csvCell("a,b"), '"a,b"')
  assert.equal(csvCell("a\rb"), '"a\rb"')
})
