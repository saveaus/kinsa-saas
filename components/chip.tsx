import { cn } from "cn"

const tones = {
  green: "bg-[#E7F6D9] text-[#3C7A28] dark:bg-[#1C3320] dark:text-[#A8D99A]",
  yellow: "bg-[#FBF3C4] text-[#8A6D12] dark:bg-[#3A3114] dark:text-[#E4C56A]",
  orange: "bg-[#F1EEEB] text-[#5E5A56] dark:bg-[#32302E] dark:text-[#D4CFC9]",
  red: "bg-[#FDE2E1] text-[#B42318] dark:bg-[#3A1C1A] dark:text-[#F0A39C]",
  blue: "bg-primary/10 text-primary dark:bg-primary/15",
  gray: "bg-[#F1F2F4] text-[#5E6570] dark:bg-[#32363C] dark:text-[#C8CDD4]",
  purple: "bg-[#F3E8FF] text-[#7A3EAF] dark:bg-[#2E2040] dark:text-[#D4B4F5]",
  mint: "bg-[#DDF6F0] text-[#1F7A68] dark:bg-[#16332E] dark:text-[#8ED9C8]",
} as const

export type ChipTone = keyof typeof tones

export function Chip({
  children,
  tone,
  className,
}: {
  children: React.ReactNode
  tone: ChipTone
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-1.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
