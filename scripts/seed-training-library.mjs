import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

function loadEnv(path) {
  const text = readFileSync(path, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv(new URL("../.env.local", import.meta.url))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !secret) throw new Error("Missing Supabase URL or secret key")

const supabase = createClient(url, secret, { auth: { persistSession: false } })
const catalogue = JSON.parse(readFileSync(new URL("../modules/training/library/catalogue.json", import.meta.url), "utf8"))

const { data: orgs, error: orgError } = await supabase.from("organisations").select("id, name")
if (orgError) throw orgError

for (const org of orgs) {
  const { data: existing, error: existingError } = await supabase
    .from("courses")
    .select("id, title, code")
    .eq("organisation_id", org.id)
  if (existingError) throw existingError

  const illustrated = (existing ?? []).find(
    (course) => course.title === "Infection prevention and control" && !course.code
  )
  if (illustrated) {
    const spec = catalogue.find((item) => item.code === "SE-05")
    const { error } = await supabase
      .from("courses")
      .update({
        code: "SE-05",
        audience: spec?.audience ?? "Support workers",
        standards: spec?.standards ?? null,
        requirement_status: spec?.requirement_status ?? null,
        kind: "course",
        renewal_months: 12,
        required: true,
      })
      .eq("id", illustrated.id)
    if (error) throw error
  }

  const taken = new Set((existing ?? []).map((course) => course.code).filter(Boolean))
  if (illustrated) taken.add("SE-05")

  let inserted = 0
  for (const item of catalogue) {
    if (taken.has(item.code)) continue
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({
        organisation_id: org.id,
        code: item.code,
        title: item.title,
        description: item.description,
        status: "published",
        pass_mark: item.pass_mark,
        required: item.required,
        cover_image: item.cover_image,
        renewal_months: item.renewal_months,
        audience: item.audience,
        standards: item.standards,
        requirement_status: item.requirement_status,
        kind: item.kind,
      })
      .select("id")
      .single()
    if (courseError) throw courseError
    const { error: moduleError } = await supabase.from("course_modules").insert({
      organisation_id: org.id,
      course_id: course.id,
      title: item.title,
      body_markdown: "",
      sort_order: 0,
      content: item.lesson,
    })
    if (moduleError) throw moduleError
    inserted += 1
  }
  console.log(`${org.name}: inserted ${inserted}`)
}
