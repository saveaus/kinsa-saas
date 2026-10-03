"use client"

import { useEffect, useRef, useState } from "react"

type PdfjsApi = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (source: { data: Uint8Array }) => {
    promise: Promise<PdfDocument>
    destroy: () => Promise<void>
  }
}

type PdfDocument = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfPage>
}

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number }
  render: (params: {
    canvas: HTMLCanvasElement
    viewport: { width: number; height: number }
    intent: string
  }) => { promise: Promise<void> }
}

const pdfjsUrl = "/pdfjs/pdf.mjs"

export function PolicyPdf({
  url,
  pageLimit,
  canvasClassName = "w-full rounded-lg border bg-white",
}: {
  url: string
  pageLimit?: number
  canvasClassName?: string
}) {
  const frame = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState("Opening the file…")

  useEffect(() => {
    const current = frame.current
    if (!current) return
    const host: HTMLDivElement = current
    let cancelled = false
    let loading: ReturnType<PdfjsApi["getDocument"]> | null = null

    async function open() {
      const pdfjs = (await import(
        /* webpackIgnore: true */
        /* @vite-ignore */
        pdfjsUrl
      )) as PdfjsApi
      if (cancelled) return
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"
      const response = await fetch(url)
      if (!response.ok) throw new Error("Could not open this file.")
      const data = new Uint8Array(await response.arrayBuffer())
      if (cancelled) return
      loading = pdfjs.getDocument({ data })
      const pdf = await loading.promise
      if (cancelled) return
      host.replaceChildren()
      const lastPage = pageLimit
        ? Math.min(pageLimit, pdf.numPages)
        : pdf.numPages
      const scale = pageLimit === 1 ? 1.15 : 1.4
      for (let number = 1; number <= lastPage; number += 1) {
        const page = await pdf.getPage(number)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement("canvas")
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.className = canvasClassName
        host.append(canvas)
        // Display rendering waits on animation frames and stays blank when
        // those frames never run. Print draws the page immediately.
        await page.render({ canvas, viewport, intent: "print" }).promise
        if (cancelled) return
      }
      setMessage("")
    }

    open().catch((reason: unknown) => {
      if (!cancelled) {
        setMessage(
          reason instanceof Error ? reason.message : "Could not open this file."
        )
      }
    })

    return () => {
      cancelled = true
      void loading?.destroy()
    }
  }, [canvasClassName, pageLimit, url])

  return (
    <div className="grid gap-3">
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
      <div ref={frame} className="grid gap-3" />
    </div>
  )
}
