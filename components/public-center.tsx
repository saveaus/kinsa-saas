export function PublicCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center bg-muted/30 px-4 py-10">
      {children}
    </div>
  )
}
