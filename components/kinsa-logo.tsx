import Link from "next/link"

import { cn } from "cn"

const lockup = { src: "/brand/lockup.png", width: 1024, height: 356 }
const mark = { src: "/brand/mark.png", width: 356, height: 356 }

export function KinsaLogo({
  variant = "lockup",
  className,
}: {
  variant?: "lockup" | "mark"
  className?: string
}) {
  const asset = variant === "mark" ? mark : lockup
  return (
    <img
      src={asset.src}
      alt={variant === "lockup" ? "Kinsa" : ""}
      width={asset.width}
      height={asset.height}
      className={cn(variant === "mark" ? "h-6 w-auto" : "h-7 w-auto", className)}
    />
  )
}

export function KinsaWordmarkLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <KinsaLogo />
    </Link>
  )
}
