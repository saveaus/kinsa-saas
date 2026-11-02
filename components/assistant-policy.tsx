"use client"

import { Download, FileText } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { policyDocxBlob } from "@/modules/assistant/policy-doc"
import type { AssistantPolicyDraft } from "@/modules/assistant/policy"

const draftNote = "Draft. This policy has not been filed."

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

export function AssistantPolicyCard({
  draft,
  standards = [],
  revision = null,
  filed,
  onFile,
}: {
  draft: AssistantPolicyDraft
  standards?: { code: string; name: string }[]
  revision?: { name: string } | null
  filed?: string
  onFile?: (standardCode: string | null) => Promise<{ error?: string }>
}) {
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [picking, setPicking] = useState(false)
  const [standardCode, setStandardCode] = useState("")
  const [filing, setFiling] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  async function fileDraft(code: string | null) {
    if (filing || !onFile) return
    setFiling(true)
    setFileError(null)
    try {
      const result = await onFile(code)
      if (result.error) setFileError(result.error)
    } catch (error) {
      console.error(error)
      setFileError("That policy could not be filed.")
    } finally {
      setFiling(false)
    }
  }

  async function download() {
    if (saving) return
    setSaving(true)
    setFailed(false)
    try {
      const blob = await policyDocxBlob(draft)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = draft.filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border bg-card shadow-sm animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{draft.filename}</p>
            <p className="text-xs text-muted-foreground">
              Word document · {filed ? "filed" : "not filed"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onFile && !filed && !picking ? (
            <Button
              type="button"
              size="sm"
              disabled={filing}
              onClick={() =>
                revision ? void fileDraft(null) : setPicking(true)
              }
            >
              {filing ? "Filing…" : "File this"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => void download()}
          >
            <Download />
            {saving ? "Preparing…" : "Download"}
          </Button>
        </div>
      </div>
      {revision && onFile && !filed ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Filing this replaces {revision.name}.
        </p>
      ) : null}
      {picking && !filed ? (
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2.5">
          <NativeSelect
            size="sm"
            className="w-full sm:w-72"
            aria-label="Practice standard"
            value={standardCode}
            onChange={(event) => setStandardCode(event.target.value)}
          >
            <NativeSelectOption value="">Choose a practice standard</NativeSelectOption>
            {standards.map((standard) => (
              <NativeSelectOption key={standard.code} value={standard.code}>
                {standard.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            type="button"
            size="sm"
            disabled={filing || !standardCode}
            onClick={() => void fileDraft(standardCode)}
          >
            {filing ? "Filing…" : "File"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={filing}
            onClick={() => setPicking(false)}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {filed ? (
        <p className="border-t px-3 py-2 text-sm text-muted-foreground">{filed}</p>
      ) : null}
      {fileError ? (
        <p className="border-t px-3 py-2 text-sm text-destructive">{fileError}</p>
      ) : null}
      <div className="max-h-96 overflow-y-auto border-t bg-background px-6 py-5">
        <article className="mx-auto grid max-w-prose gap-4 text-sm leading-6">
          <header className="grid gap-1">
            <h2 className="font-heading text-xl font-medium tracking-tight">{draft.title}</h2>
            <p className="text-muted-foreground italic">{draft.organisation}</p>
            <p className="text-xs text-muted-foreground italic">{draftNote}</p>
          </header>
          <Section title="Purpose">
            <p>{draft.purpose}</p>
          </Section>
          <Section title="Scope">
            <p>{draft.scope}</p>
          </Section>
          <Section title="Policy">
            <p>{draft.statement}</p>
          </Section>
          <Section title="Responsibilities">
            <ul className="list-disc pl-5">
              {draft.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>
          <Section title="Procedure">
            <ol className="list-decimal pl-5">
              {draft.procedure.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </Section>
        </article>
      </div>
      {failed ? (
        <p className="border-t px-3 py-2 text-xs text-destructive">The Word file could not be prepared.</p>
      ) : null}
    </div>
  )
}
