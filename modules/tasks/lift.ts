import {
  packGaps,
  packReadiness,
  packStatusLabel,
  type PackItem,
} from "@/modules/audit-pack/score"

export type ComplianceTask = {
  key: string
  title: string
  detail: string
}

export type ComplianceLift =
  | {
      ok: true
      current: number
      target: number
      reached: number
      tasks: ComplianceTask[]
    }
  | { ok: false; reason: string }

const taskCap = 24

export function complianceLift(items: readonly PackItem[], liftPoints: number): ComplianceLift {
  const readiness = packReadiness([...items])
  if (readiness.total === 0) {
    return { ok: false, reason: "There is no compliance score in this snapshot." }
  }
  const points = Math.min(100, Math.max(1, Math.round(liftPoints)))
  const target = Math.min(100, readiness.percent + points)
  if (readiness.percent >= target) {
    return { ok: false, reason: `Compliance is already ${readiness.percent}%.` }
  }

  const closable = closableGaps(items)
  let need = closable.length
  for (let extra = 1; extra <= closable.length; extra += 1) {
    const percent = Math.round(((readiness.met + extra) / readiness.total) * 100)
    if (percent >= target) {
      need = extra
      break
    }
  }
  const chosen = closable.slice(0, Math.min(need, taskCap))
  if (chosen.length === 0) {
    return { ok: false, reason: "Nothing open would raise the score." }
  }
  const reached = Math.round(((readiness.met + chosen.length) / readiness.total) * 100)
  return {
    ok: true,
    current: readiness.percent,
    target,
    reached,
    tasks: chosen.map(toTask),
  }
}

/** The first open items that move the score, limited to the number asked for. */
export function complianceTop(items: readonly PackItem[], count: number): ComplianceLift {
  const readiness = packReadiness([...items])
  if (readiness.total === 0) {
    return { ok: false, reason: "There is no compliance score in this snapshot." }
  }
  const wanted = Math.min(taskCap, Math.max(1, Math.round(count)))
  const chosen = closableGaps(items).slice(0, wanted)
  if (chosen.length === 0) {
    return { ok: false, reason: "Nothing open would raise the score." }
  }
  const reached = Math.round(((readiness.met + chosen.length) / readiness.total) * 100)
  let points = 1
  for (; points < 100; points += 1) {
    const plan = complianceLift(items, points)
    if (!plan.ok) break
    if (plan.tasks.length >= chosen.length && samePrefix(plan.tasks, chosen)) break
  }
  return {
    ok: true,
    current: readiness.percent,
    target: Math.min(100, readiness.percent + points),
    reached,
    tasks: chosen.map(toTask),
  }
}

function closableGaps(items: readonly PackItem[]) {
  return packGaps([...items]).filter((item) => item.status !== "lapsing" && item.status !== "met")
}

function toTask(item: PackItem): ComplianceTask {
  return {
    key: item.key.slice(0, 200),
    title: clean(item.label, 160),
    detail: clean(`${packStatusLabel(item.status)}. ${item.detail}`, 400),
  }
}

function samePrefix(tasks: readonly ComplianceTask[], items: readonly PackItem[]) {
  return items.every((item, index) => tasks[index]?.key === item.key.slice(0, 200))
}

export function complianceCountHeading(count: number) {
  return count === 1 ? "1 thing to do first" : `${count} things to do first`
}

export function complianceCountNote(plan: Extract<ComplianceLift, { ok: true }>, asked: number) {
  const shown = plan.tasks.length
  const lead =
    shown === asked
      ? shown === 1
        ? "This is the open item that moves the score the most."
        : `These ${shown} move the score the most.`
      : `There are only ${shown} open items that move the score.`
  return `Compliance is ${plan.current}%. ${lead} They reach ${plan.reached}%. Assign each one, or all of them.`
}

export function complianceHeading(plan: Extract<ComplianceLift, { ok: true }>) {
  return `Raise compliance to ${plan.reached}%`
}

export function complianceNote(plan: Extract<ComplianceLift, { ok: true }>) {
  const count = plan.tasks.length === 1 ? "1 item" : `${plan.tasks.length} items`
  const reach =
    plan.reached >= plan.target
      ? `These ${count} reach ${plan.reached}%.`
      : `These ${count} reach ${plan.reached}%. That is as far as the open items go.`
  return `Compliance is ${plan.current}%. ${reach} Assign each one, or all of them.`
}

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}
