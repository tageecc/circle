import React, { useState, useMemo, useEffect } from 'react'
import { Search, Keyboard as KeyboardIcon, RotateCcw, SearchCode } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { ScrollArea } from '../ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { cn } from '../../lib/utils'
import { KEYMAP_PRESETS, COMMANDS } from '../../config/keymaps'
import { useSettings } from '../../contexts/SettingsContext'

interface KeyRecorderProps {
  initialKeys?: string
  onSave: (keys: string) => void
  onCancel: () => void
}

const KeyRecorder = ({ initialKeys, onSave, onCancel }: KeyRecorderProps) => {
  const [recordedString, setRecordedString] = useState<string>(initialKeys || '')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Allow Escape to cancel recording if no modifiers are pressed
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        onCancel()
        return
      }

      const newKeys = new Set<string>()

      if (e.metaKey) newKeys.add('Meta')
      if (e.ctrlKey) newKeys.add('Ctrl')
      if (e.altKey) newKeys.add('Alt')
      if (e.shiftKey) newKeys.add('Shift')

      // Don't add modifier keys themselves as the main key
      if (!['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
        // Handle special keys
        let key = e.key.toUpperCase()
        if (key === ' ') key = 'Space'
        if (key === 'ESCAPE') key = 'Esc'
        newKeys.add(key)
      }

      // Convert to string representation
      const parts: string[] = []
      if (newKeys.has('Meta')) parts.push('Meta')
      if (newKeys.has('Ctrl')) parts.push('Ctrl')
      if (newKeys.has('Alt')) parts.push('Alt')
      if (newKeys.has('Shift')) parts.push('Shift')

      // Add non-modifier keys
      newKeys.forEach((k) => {
        if (!['Meta', 'Ctrl', 'Alt', 'Shift'].includes(k)) {
          parts.push(k)
        }
      })

      const result = parts.join('+')
      setRecordedString(result)
    }

    const handleKeyUp = () => {
      // Optional: stop recording on key up if needed, but usually we wait for Enter
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center p-6 gap-4 outline-none">
      <div className="text-4xl font-mono font-bold flex items-center gap-2 h-16">
        {recordedString ? (
          recordedString.split('+').map((k, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-muted-foreground text-2xl">+</span>}
              <kbd className="px-3 py-1.5 bg-muted rounded-md border border-border min-w-[40px] text-center shadow-sm">
                {k}
              </kbd>
            </React.Fragment>
          ))
        ) : (
          <span className="text-muted-foreground text-lg">按下键盘组合键...</span>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={() => onSave(recordedString)} disabled={!recordedString}>
          确认
        </Button>
      </div>
    </div>
  )
}

export function KeymapSettingsContent() {
  const { keymapSettings, updateKeymapSettings } = useSettings()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingCommand, setEditingCommand] = useState<string | null>(null)

  // Local state for bindings to allow unsaved changes logic if we wanted,
  // but here we sync with context directly for simplicity or use a local buffer.
  // Using context directly as per SettingsDialog pattern.

  const handleProfileChange = async (value: string) => {
    const preset = KEYMAP_PRESETS[value]
    if (preset) {
      await updateKeymapSettings({
        profile: value,
        bindings: { ...preset.bindings }
      })
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const filteredCommands = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return COMMANDS.filter((cmd) => {
      const binding = keymapSettings.bindings[cmd.id] || ''
      return (
        cmd.label.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query) ||
        binding.toLowerCase().includes(query)
      )
    })
  }, [searchQuery, keymapSettings.bindings])

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, typeof COMMANDS> = {}
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  const handleSaveBinding = async (commandId: string, keybinding: string) => {
    const newBindings = { ...keymapSettings.bindings, [commandId]: keybinding }
    await updateKeymapSettings({
      bindings: newBindings
      // If we modify a preset, maybe we should switch to 'custom' or keep it as 'modified'
      // For now, we keep the profile name but arguably it's custom now.
    })
    setEditingCommand(null)
  }

  const handleResetBinding = async (commandId: string) => {
    const preset = KEYMAP_PRESETS[keymapSettings.profile] || KEYMAP_PRESETS['vscode']
    const defaultBinding = preset.bindings[commandId]

    const newBindings = { ...keymapSettings.bindings }
    if (defaultBinding) {
      newBindings[commandId] = defaultBinding
    } else {
      delete newBindings[commandId]
    }

    await updateKeymapSettings({ bindings: newBindings })
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-4 p-1">
        <div className="flex items-center gap-2 flex-1">
          <Select value={keymapSettings.profile} onValueChange={handleProfileChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择键位映射" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(KEYMAP_PRESETS).map(([key, preset]) => (
                <SelectItem key={key} value={key}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索命令或快捷键 (如: '保存', 'Cmd+S')"
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <div className="border rounded-md flex-1 overflow-hidden bg-card">
        <ScrollArea className="h-full">
          <div className="p-0">
            {Object.entries(groupedCommands).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <SearchCode className="h-12 w-12 mb-4 opacity-20" />
                <p>未找到匹配的命令</p>
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, commands]) => (
                <div key={category}>
                  <div className="sticky top-0 bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm border-y border-border first:border-t-0">
                    {category}
                  </div>
                  <div className="divide-y divide-border">
                    {commands.map((cmd) => {
                      const binding = keymapSettings.bindings[cmd.id]
                      return (
                        <div
                          key={cmd.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 group transition-colors"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{cmd.label}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {cmd.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingCommand(cmd.id)}
                              className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded hover:bg-background border border-transparent hover:border-border transition-all',
                                !binding && 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {binding ? (
                                binding.split('+').map((k, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && (
                                      <span className="text-muted-foreground mx-0.5">+</span>
                                    )}
                                    <kbd className="font-mono text-xs font-medium bg-muted px-1.5 py-0.5 rounded border border-border/50">
                                      {k}
                                    </kbd>
                                  </React.Fragment>
                                ))
                              ) : (
                                <span className="text-xs italic">点击设置快捷键</span>
                              )}
                              <KeyboardIcon className="h-3 w-3 ml-2 opacity-0 group-hover:opacity-50" />
                            </button>
                            {binding && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleResetBinding(cmd.id)}
                                title="重置"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={!!editingCommand} onOpenChange={(open) => !open && setEditingCommand(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>输入快捷键</DialogTitle>
            <DialogDescription>
              为 <b>{COMMANDS.find((c) => c.id === editingCommand)?.label}</b> 输入新的组合键。
              <br />按 Esc 取消，Enter 确认。
            </DialogDescription>
          </DialogHeader>

          {editingCommand && (
            <KeyRecorder
              initialKeys={keymapSettings.bindings[editingCommand]}
              onSave={(keys) => handleSaveBinding(editingCommand, keys)}
              onCancel={() => setEditingCommand(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
