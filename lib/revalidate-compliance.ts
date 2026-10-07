import { revalidatePath } from "next/cache"

export function revalidateCompliance() {
  revalidatePath("/dashboard")
  revalidatePath("/workers/documents")
}
