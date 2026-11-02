import { AttentionRegister } from "@/components/attention-register"
import { BackLink } from "@/components/back-link"

export default function WorkerDocumentsPage() {
  return (
    <div className="grid gap-3">
      <BackLink href="/workers" />
      <AttentionRegister />
    </div>
  )
}
