import { AuthBackdrop } from "@/components/auth-backdrop"

export function PublicCenter({ children }: { children: React.ReactNode }) {
  return (
    <AuthBackdrop>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        {children}
      </div>
    </AuthBackdrop>
  )
}
