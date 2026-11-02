"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import type { BillingNotice } from "@/modules/billing/access"

const storageKey = "kinsa-minimised-billing-notice"

export function BillingNoticeBar({ notice }: { notice: BillingNotice }) {
  const [minimised, setMinimised] = useState<boolean | null>(null)

  useEffect(() => {
    setMinimised(localStorage.getItem(storageKey) === "1")
  }, [])

  function minimise() {
    localStorage.setItem(storageKey, "1")
    setMinimised(true)
  }

  function expand() {
    localStorage.removeItem(storageKey)
    setMinimised(false)
  }

  if (minimised !== false) {
    if (minimised === null) return null
    return (
      <button
        type="button"
        onClick={expand}
        aria-label="Expand"
        className={
          notice.action
            ? "flex h-5 w-full shrink-0 items-center justify-end bg-[#f1eeeb] pr-2 text-[#2a2724]"
            : "flex h-5 w-full shrink-0 items-center justify-end border-b pr-2"
        }
      >
        <ChevronUp className="size-3" />
      </button>
    )
  }

  return (
    <div
      className={
        notice.action
          ? "flex shrink-0 items-center gap-3 bg-[#f1eeeb] px-4 py-2 text-sm text-[#2a2724]"
          : "flex shrink-0 items-center gap-3 border-b px-4 py-2 text-sm"
      }
    >
      {notice.action ? (
        <p className="min-w-0 flex-1">{notice.message}</p>
      ) : (
        <Link
          href="/settings/billing"
          className="min-w-0 flex-1 underline-offset-2 hover:underline"
        >
          {notice.message}
        </Link>
      )}
      {notice.action ? (
        <Link
          href={notice.action.href}
          className="font-medium underline underline-offset-2"
        >
          {notice.action.label}
        </Link>
      ) : null}
      <button
        type="button"
        onClick={minimise}
        aria-label="Minimise"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-black/10"
      >
        <ChevronDown className="size-4" />
      </button>
    </div>
  )
}
