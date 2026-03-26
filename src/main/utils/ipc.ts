/**
 * IPC 通用工具
 * 统一管理主进程向渲染进程发送消息的逻辑
 */

import { BrowserWindow } from 'electron'

/**
 * 获取主窗口（可能返回 null）
 */
export function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows[0] || null
}

/**
 * 向渲染进程发送 IPC 消息
 * @param channel IPC 频道名称
 * @param data 要发送的数据
 * @returns 是否发送成功
 */
export function sendToRenderer<T = any>(channel: string, data: T): boolean {
  const mainWindow = getMainWindow()

  if (!mainWindow) {
    console.warn(`[IPC] No main window found, cannot send: ${channel}`)
    return false
  }

  try {
    mainWindow.webContents.send(channel, data)
    return true
  } catch (error) {
    console.error(`[IPC] Failed to send ${channel}:`, error)
    return false
  }
}

/**
 * 向渲染进程发送 IPC 消息（如果失败则抛出错误）
 * @param channel IPC 频道名称
 * @param data 要发送的数据
 * @throws Error 如果没有窗口或发送失败
 */
export function sendToRendererOrThrow<T = any>(channel: string, data: T): void {
  const mainWindow = getMainWindow()

  if (!mainWindow) {
    throw new Error('No active window found')
  }

  try {
    mainWindow.webContents.send(channel, data)
  } catch (error) {
    throw new Error(`Failed to send IPC message to ${channel}: ${error}`)
  }
}

/**
 * 获取主窗口（如果不存在则抛出错误）
 * 用于需要直接访问窗口的场景
 */
export function getMainWindowOrThrow(): BrowserWindow {
  const mainWindow = getMainWindow()

  if (!mainWindow) {
    throw new Error('No active window found')
  }

  return mainWindow
}
