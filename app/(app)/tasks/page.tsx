import { todayOn } from "@/lib/today"

import { TasksBoard } from "@/components/tasks-board"
import { can, requireTenant } from "@/lib/tenant"
import { listStaffTasks, listTaskAssignees } from "@/modules/tasks/queries"

export default async function TasksPage() {
  const { context } = await requireTenant()
  const canAssign = can(context, "workers.manage")
  const [tasks, people] = await Promise.all([
    listStaffTasks(context),
    canAssign ? listTaskAssignees(context) : Promise.resolve([]),
  ])

  return (
    <TasksBoard
      tasks={tasks}
      people={people}
      canAssign={canAssign}
      youId={context.workerId}
      today={todayOn()}
    />
  )
}
