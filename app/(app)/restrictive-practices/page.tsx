import { redirect } from "next/navigation"

export default function RestrictivePracticesPage() {
  redirect("/logs?log=restrictive_practice")
}
