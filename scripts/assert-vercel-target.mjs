#!/usr/bin/env node
/**
 * Fails fast if this repo is linked to the wrong Vercel team.
 * Source of truth: vercel-target.json (committed).
 */
import { readFileSync, existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const targetPath = resolve(root, "vercel-target.json")
const linkPath = resolve(root, ".vercel/project.json")

const target = JSON.parse(readFileSync(targetPath, "utf8"))
const expectedSlug = target.teamSlug
const expectedProject = target.projectName
const expectedOrgId = target.orgId || null
const FORBIDDEN_ORG = "team_Tr6MBnYJHkM0PMsGobaTtZgH"

function fail(message) {
  console.error(`vercel-target: ${message}`)
  process.exit(1)
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8", cwd: root })
  const out = `${result.stdout || ""}${result.stderr || ""}`.trim()
  if (result.status !== 0) {
    fail(`command failed: ${cmd} ${args.join(" ")}\n${out}`)
  }
  return out
}

const whoami = run("vercel", ["whoami"])
console.log(`vercel-target: logged in as ${whoami}`)

const teamsText = run("vercel", ["teams", "ls"])
if (!teamsText.includes(expectedSlug)) {
  fail(
    `expected team "${expectedSlug}" is not available for this login.\n` +
      `Run: vercel logout && vercel login\n` +
      `Sign in as izak@openara.com.au (openara), not izakjosef@gmail.com.`
  )
}

if (!existsSync(linkPath)) {
  fail(
    `missing .vercel/project.json. Link with:\n` +
      `  vercel link --yes --scope ${expectedSlug} --project ${expectedProject}`
  )
}

const link = JSON.parse(readFileSync(linkPath, "utf8"))
if (link.projectName && link.projectName !== expectedProject) {
  fail(`linked project is "${link.projectName}", expected "${expectedProject}". Re-run vercel link.`)
}
if (link.orgId === FORBIDDEN_ORG) {
  fail(
    `.vercel/project.json still points at izakjosef-gmailcoms-projects (${FORBIDDEN_ORG}).\n` +
      `Remove .vercel and run: vercel link --yes --scope ${expectedSlug} --project ${expectedProject}`
  )
}
if (expectedOrgId && link.orgId !== expectedOrgId) {
  fail(
    `linked orgId is ${link.orgId}, expected ${expectedOrgId} (${expectedSlug}).\n` +
      `Remove .vercel and re-link.`
  )
}

const projects = run("vercel", ["project", "ls", "--scope", expectedSlug])
if (!projects.includes(expectedProject)) {
  fail(`project "${expectedProject}" not found under scope "${expectedSlug}".`)
}

console.log(`vercel-target: OK → team ${expectedSlug} / project ${expectedProject} (${whoami})`)
