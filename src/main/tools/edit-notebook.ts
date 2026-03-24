import { z } from 'zod'
import { promises as fs } from 'fs'
import * as path from 'path'

/**
 * 编辑 Jupyter Notebook 工具
 * 基于 Cursor 的 edit_notebook 设计
 */
export const editNotebookTool = {
  description: `Use this tool to edit a jupyter notebook cell. Use ONLY this tool to edit notebooks.

This tool supports editing existing cells and creating new cells:
  - If you need to edit an existing cell, set 'is_new_cell' to false and provide the 'old_string' and 'new_string'
  - If you need to create a new cell, set 'is_new_cell' to true and provide the 'new_string' (and keep 'old_string' empty)
  - It's critical that you set the 'is_new_cell' flag correctly!`,

  parameters: z.object({
    target_notebook: z.string().describe('The path to the notebook file you want to edit'),
    cell_idx: z.number().describe('The index of the cell to edit (0-based)'),
    is_new_cell: z
      .boolean()
      .describe('If true, a new cell will be created at the specified cell index'),
    cell_language: z
      .enum(['python', 'markdown', 'javascript', 'typescript', 'r', 'sql', 'shell', 'raw', 'other'])
      .describe('The language of the cell'),
    old_string: z.string().describe('The text to replace (must be unique within the cell)'),
    new_string: z
      .string()
      .describe('The edited text to replace the old_string or the content for the new cell')
  }),

  execute: async ({
    target_notebook,
    cell_idx,
    is_new_cell,
    cell_language,
    old_string,
    new_string
  }: {
    target_notebook: string
    cell_idx: number
    is_new_cell: boolean
    cell_language: string
    old_string: string
    new_string: string
  }) => {
    try {
      const absolutePath = path.isAbsolute(target_notebook)
        ? target_notebook
        : path.resolve(process.cwd(), target_notebook)

      // 检查文件是否存在
      let notebook: any
      try {
        const content = await fs.readFile(absolutePath, 'utf-8')
        notebook = JSON.parse(content)
      } catch {
        if (is_new_cell && cell_idx === 0) {
          // 创建新 notebook
          notebook = {
            cells: [],
            metadata: {},
            nbformat: 4,
            nbformat_minor: 2
          }
        } else {
          throw new Error(`Notebook not found: ${target_notebook}`)
        }
      }

      if (is_new_cell) {
        // 创建新 cell
        const newCell = {
          cell_type: cell_language === 'markdown' ? 'markdown' : 'code',
          metadata: {},
          source: new_string.split('\n')
        }

        if (cell_language !== 'markdown') {
          newCell['execution_count'] = null
          newCell['outputs'] = []
        }

        notebook.cells.splice(cell_idx, 0, newCell)
      } else {
        // 编辑现有 cell
        if (!notebook.cells[cell_idx]) {
          throw new Error(`Cell ${cell_idx} not found in notebook`)
        }

        const cell = notebook.cells[cell_idx]
        const cellContent = Array.isArray(cell.source) ? cell.source.join('\n') : cell.source

        if (!cellContent.includes(old_string)) {
          throw new Error(`Old string not found in cell ${cell_idx}`)
        }

        const updatedContent = cellContent.replace(old_string, new_string)
        cell.source = updatedContent.split('\n')
      }

      // 写入 notebook
      await fs.writeFile(absolutePath, JSON.stringify(notebook, null, 2), 'utf-8')

      return {
        success: true,
        message: is_new_cell
          ? `New cell created at index ${cell_idx}`
          : `Cell ${cell_idx} edited successfully`,
        notebook: target_notebook,
        cell_idx,
        is_new_cell
      }
    } catch (error: any) {
      throw new Error(`Failed to edit notebook: ${error.message}`)
    }
  }
}
