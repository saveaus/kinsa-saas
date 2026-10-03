import { redirect } from "next/navigation"

export default function RisksPage() {
  redirect("/logs?log=risk")
}
