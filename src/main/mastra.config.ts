import { Mastra } from '@mastra/core/mastra'
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'
import { DefaultExporter } from '@mastra/core/ai-tracing'
import * as path from 'path'

let _sharedMemory: InstanceType<typeof Memory> | null = null
let _mastra: InstanceType<typeof Mastra> | null = null

export function initMastraMemory(userDataPath: string): void {
  if (_sharedMemory) return
  const dbPath = path.join(userDataPath, 'circle-memory.db')
  _sharedMemory = new Memory({
    storage: new LibSQLStore({ url: `file:${dbPath}` }),
    options: {
      lastMessages: 20,
      semanticRecall: false,
      workingMemory: { enabled: true }
    }
  })
}

export function getSharedMemory(): InstanceType<typeof Memory> {
  if (!_sharedMemory) {
    throw new Error('Mastra Memory not initialized. Call initMastraMemory(userDataPath) first.')
  }
  return _sharedMemory
}

/**
 * 初始化 Mastra 实例（含 tracing 存储）。须在 app 启动时传入 userDataPath。
 */
export function initMastraTraces(userDataPath: string): void {
  if (_mastra) return
  const tracesPath = path.join(userDataPath, 'circle-traces.db')
  _mastra = new Mastra({
    storage: new LibSQLStore({ url: `file:${tracesPath}` }),
    observability: {
      configs: {
        default: {
          serviceName: 'circle',
          exporters: [new DefaultExporter()]
        }
      }
    }
  })
}

export function getMastra(): InstanceType<typeof Mastra> {
  if (!_mastra) {
    throw new Error('Mastra not initialized. Call initMastraTraces(userDataPath) first.')
  }
  return _mastra
}
