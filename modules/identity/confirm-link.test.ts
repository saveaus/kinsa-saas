import assert from "node:assert/strict"
import { test } from "node:test"

import { authConfirmUrl, isAuthEmailType, safeNext } from "@/modules/identity/confirm-link"

test("a confirmation link stays on this app", () => {
  const url = new URL(authConfirmUrl("token-1", "signup", "/onboarding"))
  assert.equal(url.pathname, "/auth/confirm")
  assert.equal(url.searchParams.get("token_hash"), "token-1")
  assert.equal(url.searchParams.get("type"), "signup")
  assert.equal(url.searchParams.get("next"), "/onboarding")
  assert.equal(url.hostname === "localhost" || url.hostname.endsWith("kinsa.com.au"), true)
})

test("the next page has to be a path on this site", () => {
  assert.equal(safeNext("/invite/abc"), "/invite/abc")
  assert.equal(safeNext("https://example.com"), "/onboarding")
  assert.equal(safeNext("//example.com"), "/onboarding")
  assert.equal(safeNext(null), "/onboarding")
})

test("only the auth email types are accepted", () => {
  assert.equal(isAuthEmailType("signup"), true)
  assert.equal(isAuthEmailType("recovery"), true)
  assert.equal(isAuthEmailType("signup "), false)
  assert.equal(isAuthEmailType(null), false)
})

test("safeNext stays on this site", () => {
  assert.equal(safeNext("/dashboard?tab=a"), "/dashboard?tab=a")
  for (const value of ["/\t/evil.com", "/\n/evil.com", "//evil.com", "/\\evil.com", "https://evil.com", null]) {
    assert.equal(safeNext(value), "/onboarding")
  }
})
