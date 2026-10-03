import { redirect } from "next/navigation"

export default function ComplaintsPage() {
  redirect("/logs?log=complaint")
}
