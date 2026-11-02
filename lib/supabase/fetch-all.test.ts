import assert from "node:assert/strict"
import test from "node:test"

import { fetchAll } from "@/lib/supabase/fetch-all"

test("reads every page past the row cap", async () => {
  const all = Array.from({ length: 2345 }, (_, index) => index)
  const result = await fetchAll(async (from, to) => ({
    data: all.slice(from, to + 1),
    error: null,
  }))
  assert.equal(result.data?.length, 2345)
})

test("a failed page is an error, not a short list", async () => {
  const result = await fetchAll(async (from) =>
    from === 0
      ? { data: Array.from({ length: 1000 }, () => 1), error: null }
      : { data: null, error: { message: "boom" } }
  )
  assert.equal(result.data, null)
  assert.equal(result.error?.message, "boom")
})
