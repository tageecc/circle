/**
 * In-process registry for sub-agent / task runs (Phase D — minimal viable).
 */

import type { SubAgentTask, TaskRunId } from './sub-agent.types'

const tasks = new Map<TaskRunId, SubAgentTask>()
const taskRuntime = new Map<
  TaskRunId,
  {
    abortController?: AbortController
    completionPromise?: Promise<void>
  }
>()

export function registerTaskRun(
  task: SubAgentTask,
  runtime?: {
    abortController?: AbortController
    completionPromise?: Promise<void>
  }
): void {
  tasks.set(task.id, task)
  if (runtime && (runtime.abortController || runtime.completionPromise)) {
    taskRuntime.set(task.id, runtime)
  }
}

export function updateTaskRun(id: TaskRunId, patch: Partial<SubAgentTask>): void {
  const t = tasks.get(id)
  if (!t) return
  tasks.set(id, { ...t, ...patch })
  if (patch.status && patch.status !== 'running' && patch.status !== 'pending') {
    taskRuntime.delete(id)
  }
}

export function getTaskRun(id: TaskRunId): SubAgentTask | undefined {
  return tasks.get(id)
}

export function getTaskRunForSession(
  id: TaskRunId,
  parentSessionId: string
): SubAgentTask | undefined {
  const task = tasks.get(id)
  if (!task || task.parentSessionId !== parentSessionId) {
    return undefined
  }
  return task
}

export function listTaskRunsForSession(parentSessionId: string): SubAgentTask[] {
  return [...tasks.values()].filter((t) => t.parentSessionId === parentSessionId)
}

export function attachTaskRunRuntime(
  id: TaskRunId,
  runtimePatch: {
    abortController?: AbortController
    completionPromise?: Promise<void>
  }
): void {
  const task = tasks.get(id)
  if (!task || (task.status !== 'running' && task.status !== 'pending')) {
    return
  }
  const current = taskRuntime.get(id) || {}
  taskRuntime.set(id, { ...current, ...runtimePatch })
}

export function abortTaskRun(id: TaskRunId): boolean {
  const runtime = taskRuntime.get(id)
  if (!runtime?.abortController || runtime.abortController.signal.aborted) {
    return false
  }
  runtime.abortController.abort()
  return true
}

export function getTaskRunCompletionPromise(id: TaskRunId): Promise<void> | undefined {
  return taskRuntime.get(id)?.completionPromise
}

export function removeTaskRun(id: TaskRunId): void {
  tasks.delete(id)
  taskRuntime.delete(id)
}
