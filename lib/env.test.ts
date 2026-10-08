import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import { resolveAppUrl } from "@/lib/env"

const previous = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = previous
})

describe("resolveAppUrl", () => {
  it("keeps a request whose host is the configured app", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test"
    assert.equal(resolveAppUrl("https://app.example.test"), "https://app.example.test")
  })

  it("ignores a forwarded host that is not the configured app", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test"
    assert.equal(resolveAppUrl("https://attacker.example"), "https://app.example.test")
    assert.equal(resolveAppUrl("https://app.example.test.evil.test"), "https://app.example.test")
  })

  it("uses the configured app when the request origin is missing", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test"
    assert.equal(resolveAppUrl(null), "https://app.example.test")
  })
})
