import { readFile } from "node:fs/promises"
import path from "node:path"

const files: Record<string, string> = {
  "pdf.mjs": "pdf.mjs",
  "pdf.worker.min.mjs": "pdf.worker.min.mjs",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params
  const name = files[file]
  if (!name) return new Response(null, { status: 404 })

  const bytes = await readFile(
    path.join(process.cwd(), "node_modules/pdfjs-dist/build", name)
  )
  return new Response(bytes, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
