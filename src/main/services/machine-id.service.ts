import { networkInterfaces } from 'os'
import { createHash } from 'crypto'
import { app } from 'electron'

/**
 * 机器标识服务
 * 生成基于机器的唯一标识符
 */
export class MachineIdService {
  private static instance: MachineIdService
  private cachedMachineId: string | null = null

  private constructor() {}

  static getInstance(): MachineIdService {
    if (!MachineIdService.instance) {
      MachineIdService.instance = new MachineIdService()
    }
    return MachineIdService.instance
  }

  /**
   * 获取机器唯一标识符
   * 基于 MAC 地址 + 主机名生成
   */
  getMachineId(): string {
    if (this.cachedMachineId) {
      return this.cachedMachineId
    }

    const identifiers: string[] = []

    // 1. 获取 MAC 地址
    const interfaces = networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name]
      if (nets) {
        for (const net of nets) {
          // 排除内部和虚拟网卡
          if (!net.internal && net.mac !== '00:00:00:00:00:00') {
            identifiers.push(net.mac)
          }
        }
      }
    }

    // 2. 添加其他标识符
    identifiers.push(require('os').hostname())
    identifiers.push(process.platform)
    identifiers.push(app.getPath('userData')) // Electron userData 路径

    // 3. 生成哈希
    const combined = identifiers.sort().join('|')
    this.cachedMachineId = createHash('sha256').update(combined).digest('hex').substring(0, 32) // 取前 32 位

    console.log('[MachineIdService] Generated machine ID:', this.cachedMachineId)
    return this.cachedMachineId
  }

  /**
   * 生成用户名
   * 格式：user-{前8位机器ID}
   */
  generateUsername(): string {
    const machineId = this.getMachineId()
    return `user-${machineId.substring(0, 8)}`
  }

  /**
   * 生成显示名称
   * 格式：User on {主机名}
   */
  generateDisplayName(): string {
    const hostname = require('os').hostname()
    return `User on ${hostname}`
  }
}
