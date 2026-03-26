import { machineIdSync } from 'node-machine-id'
import { createHash } from 'crypto'
import { hostname } from 'os'

/**
 * 机器标识服务
 * 使用真正的硬件级别机器码（主板序列号、CPU ID、硬盘序列号等）
 * 确保：
 * 1. 跨网络环境稳定（不受 WiFi/有线/VPN 影响）
 * 2. 重装应用后保持不变（基于硬件，不依赖文件）
 * 3. 用于设备识别和防盗刷
 *
 * 实现原理：
 * - macOS: 使用 IOPlatformUUID（硬件 UUID）
 * - Windows: 使用主板序列号 (wmic)
 * - Linux: 使用 /var/lib/dbus/machine-id 或 /etc/machine-id
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
   * 获取机器唯一标识符（硬件级别）
   * 此 ID 基于硬件特征，重装系统/应用后保持不变
   */
  getMachineId(): string {
    if (this.cachedMachineId) {
      return this.cachedMachineId
    }

    try {
      // 使用 node-machine-id 获取真正的硬件 ID
      const hardwareId = machineIdSync()

      // 为了保持一致性，对硬件 ID 进行哈希处理并截取前 32 位
      this.cachedMachineId = createHash('sha256').update(hardwareId).digest('hex').substring(0, 32)

      console.log('[MachineIdService] Generated machine ID:', this.cachedMachineId)
      return this.cachedMachineId
    } catch (error) {
      console.error('[MachineIdService] Failed to get hardware ID:', error)
      throw new Error('Failed to generate machine ID')
    }
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
    return `User on ${hostname()}`
  }
}
