/**
 * IPC 通用工具
 * 统一管理主进程向渲染进程发送消息的逻辑
 */

import { BrowserWindow, type WebContents, webContents } from 'electron'

export interface RendererTarget {
  webContentsId?: number
  windowId?: number
}

function resolveWebContents(target?: BrowserWindow | WebContents | RendererTarget): WebContents | null {
  if (!target) {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow && !focusedWindow.isDestroyed()) {
      return focusedWindow.webContents
    }

    const windows = BrowserWindow.getAllWindows()
    return windows[0]?.webContents ?? null
  }

  if (target instanceof BrowserWindow) {
    return target.isDestroyed() ? null : target.webContents
  }

  if ('send' in target) {
    return target.isDestroyed() ? null : target
  }

  if (typeof target.webContentsId === 'number') {
    return webContents.fromId(target.webContentsId) ?? null
  }

  if (typeof target.windowId === 'number') {
    return BrowserWindow.fromId(target.windowId)?.webContents ?? null
  }

  return null
}

/**
 * 获取主窗口（可能返回 null）
 */
export function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

/**
 * 向渲染进程发送 IPC 消息
 * @param channel IPC 频道名称
 * @param data 要发送的数据
 * @returns 是否发送成功
 */
export function sendToRenderer<T>(
  channel: string,
  data: T,
  target?: BrowserWindow | WebContents | RendererTarget
): boolean {
  const targetContents = resolveWebContents(target)

  if (!targetContents) {
    console.warn(`[IPC] No main window found, cannot send: ${channel}`)
    return false
  }

  try {
    targetContents.send(channel, data)
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
export function sendToRendererOrThrow<T>(
  channel: string,
  data: T,
  target?: BrowserWindow | WebContents | RendererTarget
): void {
  const targetContents = resolveWebContents(target)

  if (!targetContents) {
    throw new Error('No active window found')
  }

  try {
    targetContents.send(channel, data)
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
