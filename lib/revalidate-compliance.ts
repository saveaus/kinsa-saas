import { revalidatePath } from "next/cache"

export function revalidateCompliance() {
  revalidatePath("/dashboard")
  revalidatePath("/courses/outstanding")
  revalidatePath("/workers/documents")
}
