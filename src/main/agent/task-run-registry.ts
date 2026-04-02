/**
 * In-process registry for sub-agent / task runs (Phase D — minimal viable).
 */

import type { SubAgentTask, TaskRunId } from './sub-agent.types'

const tasks = new Map<TaskRunId, SubAgentTask>()

export function registerTaskRun(task: SubAgentTask): void {
  tasks.set(task.id, task)
}

export function updateTaskRun(id: TaskRunId, patch: Partial<SubAgentTask>): void {
  const t = tasks.get(id)
  if (!t) return
  tasks.set(id, { ...t, ...patch })
}

export function getTaskRun(id: TaskRunId): SubAgentTask | undefined {
  return tasks.get(id)
}

export function listTaskRunsForSession(parentSessionId: string): SubAgentTask[] {
  return [...tasks.values()].filter((t) => t.parentSessionId === parentSessionId)
}

export function removeTaskRun(id: TaskRunId): void {
  tasks.delete(id)
}
