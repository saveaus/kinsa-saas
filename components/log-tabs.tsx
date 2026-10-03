"use client"

import Link from "next/link"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { logPageHref } from "@/modules/logs/standing"

export function LogTabs({
  tabs,
  selected,
}: {
  tabs: { id: string; label: string }[]
  selected: string
}) {
  return (
    <Tabs value={selected}>
      <TabsList
        variant="line"
        className="h-9 w-full max-w-full justify-start overflow-x-auto border-b px-0"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex-none px-2.5 text-[13px] font-normal"
            render={<Link href={logPageHref(tab.id)} />}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
