import { AuthBackdrop } from "@/components/auth-backdrop"
import { KinsaWordmarkLink } from "@/components/kinsa-logo"

export function PublicCenter({ children }: { children: React.ReactNode }) {
  return (
    <AuthBackdrop>
      <header className="relative z-10 flex justify-center px-6 pt-8">
        <KinsaWordmarkLink />
      </header>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        {children}
      </div>
    </AuthBackdrop>
  )
}
