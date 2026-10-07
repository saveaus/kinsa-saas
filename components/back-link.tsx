"use client"

import { cn } from "cn"
import { ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"

export function BackLink({
  href,
  children = "Back",
}: {
  href: string
  children?: React.ReactNode
}) {
  const router = useRouter()

  function goBack() {
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push(href)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "-ml-2 w-fit"
      )}
    >
      <ChevronLeft />
      {children}
    </button>
  )
}
