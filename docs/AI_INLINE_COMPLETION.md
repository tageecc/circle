# AI 行内自动补全（Inline Completion）实现说明

> **分支**：`dev-ide`（本文档基于该分支当前代码撰写）  
> **范围**：从 Monaco 灰色幽灵文本到主进程 LLM 调用、可选 TypeScript 验证的完整链路。

---

## 1. 功能概览

本功能实现 **类 Copilot 的 AI 行内补全**：

- Monaco 通过 **`registerInlineCompletionsProvider`** 向编辑器注册「行内补全」来源。
- 用户输入时 Monaco 会调用 `provideInlineCompletions`；前端将 **光标前后文本** 打成 **FIM（Fill-in-the-Middle）** 提示，经 **IPC** 交给主进程。
- 主进程 **`CompletionService`** 使用 Vercel AI SDK 的 **`generateText`** 调用配置的 **聊天模型**（默认来自 `ConfigService.getCompletionModel()`），生成 **仅中间缺口** 的代码。
- 返回文本经 **后处理**（去 markdown、去模型思考标签、去 FIM 特殊 token、去重前缀、截断行数）后，作为 **幽灵文本** 显示；用户按 Tab 等键接受（Monaco 默认行为）。
- 可选：对 **TS/JS** 启用 **Shadow Workspace**：在内存里把补全「缝」进文件，用 **LanguageService 诊断** 校验；失败则带错误信息 **重试生成**。

与 **LSP 列表补全** 的关系：编辑器配置为 **不自动弹出** `quickSuggestions`，避免与 AI 抢交互；**Ctrl/Cmd+Space** 手动触发传统 Suggest；**Alt+\\** 等快捷键专门触发 **inline suggest**。

---

## 2. 架构与数据流

```
Monaco (InlineCompletionsProvider)
  → InlineCompletionProvider.provideInlineCompletions
  → CompletionRequestManager.requestCompletion (防抖 100ms)
  → window.api.completion.generate (preload IPC)
  → ipcMain.handle('completion:generate')
  → CompletionService.generateCompletion
       ├─ enableValidation + TS/JS → generateWithValidation + ShadowWorkspace.validateCompletion
       └─ 否则 → generateWithoutValidation
  → generateText (ai SDK) + buildPrompt (FIM)
  → CompletionChunk { type, text, metrics } 回到渲染进程
  → postProcessCompletion → Monaco InlineCompletionItem.insertText
```

---

## 3. 各文件逐段说明

### 3.1 `src/renderer/src/services/inline-completion-provider.ts`

| 行号 | 逻辑 |
|------|------|
| 1–7 | 文件头注释：说明 FIM、任意位置、项目级上下文（实际上下文由主进程 prompt 截取前后若干行体现）。 |
| 9–10 | `DEBUG`：`development` 或 `DEBUG_COMPLETION=true` 时打日志；`debug` 为条件 `console.log`。 |
| 12–14 | 仅类型导入 `monaco` 与 `editor/languages/CancellationToken/Position`；从 `completion-request-manager` 引入 `getCompletionRequestManager` 与 `CompletionContext`。 |
| 16–18 | `InlineCompletionProviderOptions`：`enabled` 是否启用；`enableValidation` 是否走 Shadow Workspace（默认 false，性能优先）。 |
| 21–26 | 类实现 `languages.InlineCompletionsProvider`：`options` 存 `enabled` + `enableValidation`；`requestManager` 单例。 |
| 28–33 | 构造函数：`_monacoInstance` 未使用（保留扩展位）；`enabled` 默认 true，`enableValidation` 默认 false。 |
| 35–40 | `provideInlineCompletions`：Monaco 在需要行内建议时调用。若关闭或 `token` 已取消，返回 `undefined`（不显示建议）。 |
| 45–48 | **`selectedSuggestionInfo` 存在时直接返回**：避免 LSP 的 Suggest Widget 打开时与 AI 行内补全叠在一起。 |
| 50–56 | `buildCompletionContext` → `requestManager.requestCompletion`；无响应或取消则返回 `undefined`。 |
| 58–71 | 返回 `InlineCompletions`：`items` 单条，`insertText` 为模型输出；`range` 为 **零宽**（起止行列均为当前光标），即从光标处插入；`enableForwardStability: true` 为 Monaco 稳定策略提示。 |
| 72–74 | `catch` 吞掉异常，返回 `undefined`（用户无感）。 |
| 77–79 | `freeInlineCompletions` / `handleItemDidShow` / `disposeInlineCompletions` 空实现（接口要求）。 |
| 81–92 | `buildCompletionContext`：`filePath` 用 `model.uri.path`；`fileContent` 全文件；`language` 为 model 语言 id；光标 1-based 行列；传入 `enableValidation`。 |
| 94–96 | `dispose`：调用 `requestManager.cancelAll()` 清防抖定时器与 AbortController。 |
| 99–100 | `globalProvider` 模块级引用，防止被 GC（注释说明）。 |
| 102–119 | **`registerInlineCompletionProvider`**：新建 `InlineCompletionProvider`；**`monacoInstance.languages.registerInlineCompletionsProvider('*', provider)`** 对所有语言注册；返回 `dispose` 时卸载 provider、调用 `provider.dispose`、清空 `globalProvider`。 |
| 122–123 | 导出 `globalProvider` 防 tree-shaking。 |

---

### 3.2 `src/renderer/src/services/completion-request-manager.ts`

| 行号 | 逻辑 |
|------|------|
| 1–8 | 注释：防抖、按文件取消、文本后处理。 |
| 10–11 | 同上 DEBUG。 |
| 13–22 | `CompletionContext`：路径、全文、语言、光标、`enableValidation` 可选。 |
| 24–31 | `CompletionResponse`：`completionText` + 可选 `metrics`。 |
| 33–34 | 默认防抖 100ms；补全最多 **20 行**。 |
| 36–44 | `CompletionRequestManager`：`debounceTimers` 按 key 存定时器；`activeFileRequests` 每文件一个 `AbortController`（注：当前未把 `signal` 传入 IPC，见下文「局限」）。 |
| 49–67 | `requestCompletion`：`getDebounceKey` = `filePath:line:column`；每次新输入会 **clear** 旧定时器；Promise 在 **debounce 结束后** 才 `executeRequest`。 |
| 73–100 | `executeRequest`：对 **同一路径** 若已有请求则 `abort` 旧 controller（仅前端状态）；新建 controller 记入 map；`handleIPCResponse`；`finally` 若当前 controller 仍是 map 中的则删除（避免删掉更新的请求）。 |
| 103–127 | `handleIPCResponse`：调用 **`window.api.completion.generate(context)`**；`type === 'error'` 抛错；无 `text` 抛错；`postProcessCompletion` 得到最终字符串；`metrics` 用返回或估算 token。 |
| 129–179 | `postProcessCompletion`：去 markdown 围栏；去 `</think>`/`<thinking>` 等；去 `<|fim_*|>`、`<|endoftext|>` 等；`trim`；**去重前缀**：取光标行前 **最后 3 个 token**，若补全以相同前缀开头则剥掉，减轻模型重复输出已有词；超过 20 行则截断。 |
| 184–190 | `cancelAll`：清所有防抖定时器；对所有 AbortController `abort`；清空 map。 |
| 195–197 | `getDebounceKey`。 |
| 202–205 | `estimateTokenCount`：长度/4 粗略估算。 |
| 208–215 | 单例 `getCompletionRequestManager`。 |

**局限（复刻时需知）**：`AbortController` 未传入 `ipcRenderer.invoke`，主进程上的 `generateText` **不会因用户继续打字而取消**；若要完整取消需 `ipcMain` 侧配合或可取消的调用封装。

---

### 3.3 `src/main/ipc/completion.handlers.ts`

| 行号 | 逻辑 |
|------|------|
| 1–7 | DEBUG。 |
| 9–10 | 引入 `ipcMain`、`CompletionService`、`CompletionRequest`、`ConfigService`。 |
| 12–28 | `registerCompletionHandlers(configService)`：new `CompletionService`；**`ipcMain.handle('completion:generate', async (_, request) => ...)`** 调用 `generateCompletion(request)`，catch 后返回 `{ type: 'error', error }`。 |

---

### 3.4 `src/main/services/completion.service.ts`

| 行号 | 逻辑 |
|------|------|
| 1–9 | 注释：FIM、前后行数、多模型、超时、可选 Shadow 验证。 |
| 11–13 | DEBUG。 |
| 15–22 | `generateText`、`ConfigService`、`getShadowWorkspace`、`Diagnostic`、`createLanguageModel`、`COMPLETION` 常量、`path`/`fs`。 |
| 24–48 | `CompletionRequest` / `CompletionChunk` 类型；`metrics` 可含 `validated`、`attempts`、`errors`。 |
| 50–55 | 从 `COMPLETION` 常量读超时、前缀行数、后缀行数、temperature、最大重试。 |
| 57–62 | 构造函数注入 `ConfigService`。 |
| 64–77 | **`generateCompletion` 入口**：若 `enableValidation` 且路径匹配 `\.(ts|tsx|js|jsx)$`，走 **`generateWithValidation`**；否则 **`generateWithoutValidation`**。 |
| 82–167 | **`generateWithValidation`**：`getProjectRoot` 向上找 `package.json` / `tsconfig.json` / `jsconfig.json` / `.git`，找不到则退回无验证；`getShadowWorkspace(projectRoot)`；循环 `attempt <= MAX_RETRY_ATTEMPTS`（常量多为 2，即最多若干次生成+验证）；每次 `generateText`；`shadowWorkspace.validateCompletion`；成功则 `type: 'done'` + metrics；失败则把 `validation.errors` 交给下一轮 `generateText`（通过 `previousErrors`）；超过重试仍返回最后一次补全并带 `errors` 计数。异常时 **fallback** 到 `generateWithoutValidation`。 |
| 172–209 | **`generateWithoutValidation`**：单次 `generateText`；成功返回 `done` + `validated: false`；错误时对非 timeout/abort 打日志。 |
| 214–263 | **`generateText`**：`getModel(request.modelId || this.configService.getCompletionModel())`；`buildPrompt(request)`；`system`：无错误时为 **`Complete code at <|fim_middle|>. Output only code.`**；有 `previousErrors` 时附加 **`FIX THESE ERRORS`** + `formatErrors`；`Promise.race` **`generateText` vs 超时**（`TIMEOUT_MS`，通常 5000ms）；`providerOptions.dashscope.enableThinking: false` 避免思考链；返回 `result.text`，失败返回 `null`。 |
| 265–287 | **`buildPrompt`**：当前行拆成 `beforeCursor` / `afterCursor`；先写 `<|file_sep|>${filePath}`；`buildPrefix` + 若 `shouldStartNewLine` 再追加换行；`<|fim_prefix|>${prefix}`；`<|fim_suffix|>${suffix}`；结尾 **`<|fim_middle|>`**（模型应只补「中间」）。 |
| 289–304 | **`buildPrefix`**：从「当前行往上最多 PREFIX_CONTEXT_LINES（30）行」到光标列之前，不含当前行光标后部分。 |
| 306–321 | **`buildSuffix`**：从当前行光标后字符开始，再拼接下面最多 SUFFIX_CONTEXT_LINES（10）行。 |
| 323–334 | **`shouldStartNewLine`**：若光标后非空或行前为空，不换行；若已在行尾且行前非空且长度>20，则在 prefix 末尾加换行（促发多行块补全）。 |
| 336–339 | **`getModel`**：`createLanguageModel(modelId, configService)`；若未传则 **`getDefaultModel()`**——注意此处 **私有方法**仅在 `generateText` 中以 `request.modelId || getCompletionModel()` 传入，故正常运行时使用 **completion 专用模型**。 |
| 341–343 | `estimateTokenCount`。 |
| 348–373 | **`getProjectRoot`**：从 `dirname(filePath)` 向上最多 10 层，存在任一标识文件则返回该目录。 |
| 378–383 | **`formatErrors`**：最多 3 条，`Line n: message`。 |

---

### 3.5 `src/main/services/shadow-workspace.service.ts`（验证相关）

| 行号 | 逻辑 |
|------|------|
| 1–15 | 设计说明：单例 LanguageService、快照回滚、主进程同步。 |
| 29–40 | `initialize(projectRoot)`：懒创建 `LanguageService.getInstance`。 |
| 51–109 | **`validateCompletion`**：若已在验证则 **跳过**（乐观 `isValid: true`）；非 TS/JS 直接有效；无 `languageService` 则乐观有效；`isValidating = true`；快照 `getFileContent` 或 `originalContent`；`applyCompletion` 拼进全文；`updateFile`；`getDiagnostics`；`rollback`；`filterRelevantErrors` 只保留 **补全行范围**；只保留 **category === 'error'`**；返回 `isValid`；异常则回滚并乐观有效。 |
| 114–139 | **`applyCompletion`**：单行则 `before + completion + after`；多行则首行接 `before`、中间插入、末行接 `after`。 |
| 144–154 | **`filterRelevantErrors`**：错误行在 `[cursorLine, cursorLine + completionLines - 1]`。 |
| 159–167 | **`rollback`**：`updateFile` 恢复快照。 |
| 170–183 | **`getShadowWorkspace`**：按 `projectRoot` 缓存实例并 `initialize`。 |

---

### 3.6 `src/preload/index.ts`（与补全相关的 API）

| 行号 | 逻辑 |
|------|------|
| 813–831 | `completion.generate` → **`ipcRenderer.invoke('completion:generate', request)`**。注意：**实现里的 `request` 类型**包含 `lintErrors`、`projectName` 等字段，与 **`index.d.ts`** 中较新的 `modelId` / `enableValidation` **不完全一致**；主进程 `CompletionRequest` 以 **`completion.service.ts`** 为准，多余字段一般被忽略。复刻时建议 **对齐三处类型**（preload / preload.d.ts / `CompletionRequest`）。 |

---

### 3.7 `src/main/index.ts`

| 行号 | 逻辑 |
|------|------|
| 9 | `import { registerCompletionHandlers }`。 |
| 245 | 应用启动时 **`registerCompletionHandlers(configService)`**，与主窗口/IPC 其余注册一起执行。 |

---

### 3.8 `src/renderer/src/components/features/editor/monaco-code-editor.tsx`

| 行号 | 逻辑 |
|------|------|
| 14 | 引入 `registerInlineCompletionProvider`。 |
| 17–26 | `loader.config({ monaco })` 使用本地 monaco 包。 |
| 87 | `inlineCompletionDisposableRef` 保存注册返回的 `IDisposable`。 |
| 163–194 | `workspaceRoot` 变化时 **dispose InlineCompletionProvider**（与 Model 清理同 effect）。 |
| 506–524 | **快捷键**：`Ctrl/Cmd+Space` → `editor.action.triggerSuggest`（LSP）；`Alt+\\` 与 **`Ctrl/Cmd+Shift+Space`** → `editor.action.inlineSuggest.trigger`（**手动触发 AI 行内补全**）。 |
| 577–593 | **`handleBeforeMount`**：`registerMonacoThemes`、设主题；若尚未注册则 **`registerInlineCompletionProvider(monacoInstance, { enabled: true })`**（**未传 `enableValidation`**，故默认不走 Shadow 验证）。 |

---

### 3.9 `src/renderer/src/config/monaco-editor-options.ts`

| 行号 | 逻辑 |
|------|------|
| 67–82 | **双层补全**：`quickSuggestions: false` 禁用输入时自动弹出单词/LSP 列表；`suggestOnTriggerCharacters: true` 仍允许 `.` 等触发；`tabCompletion: 'off'` 把 Tab 留给 inline；`wordBasedSuggestions: 'off'`；`suggest.showWords/showSnippets` 关闭。 |
| 83–88 | **`inlineSuggest.enabled: true`** 打开行内建议；`mode: 'prefix'`、`showToolbar` 等与 Monaco 版本相关（`as any`）。 |

---

### 3.10 `src/main/constants/service.constants.ts`

| 行号 | 逻辑 |
|------|------|
| 36–51 | `COMPLETION`：`TIMEOUT 5000`、`PREFIX_CONTEXT_LINES 30`、`SUFFIX_CONTEXT_LINES 10`、`TEMPERATURE 0.2`、`MAX_RETRY_ATTEMPTS 2`。 |

---

### 3.11 `src/main/services/config.service.ts`（节选）

- **`getCompletionModel()`**：默认 `'Alibaba (China)/qwen-turbo'`（以实际 `db.getUIState` 为准），供 **`CompletionService.generateText`** 使用。

---

## 4. 如何复刻（Checklist）

1. **依赖**：主进程需 `@ai-sdk/openai` 等（见 `model-factory`）、`ai` 包的 `generateText`；DashScope/Qwen 等按项目配置。
2. **IPC**：实现 `completion:generate`，入参对齐 `CompletionRequest`。
3. **Preload**：暴露 `window.api.completion.generate`，类型与主进程一致。
4. **渲染进程**：
   - 实现 `InlineCompletionsProvider` + 防抖 + 后处理；
   - 在 `beforeMount` 里 **`registerInlineCompletionsProvider('*', ...)`**；
   - 配置 **`inlineSuggest.enabled: true`**，并按产品要求调整 `quickSuggestions` 与快捷键。
5. **模型**：在设置中配置 **`completionModel`**（或请求里传 `modelId`）。
6. **可选 Shadow**：对 TS/JS 将 `enableValidation: true` 传入请求，并保证 `filePath` 为磁盘真实路径（`LanguageService` 能解析项目根）。
7. **环境变量**：如 `DASHSCOPE_API_KEY`、各厂商 API Key。

---

## 5. 与 `master` 分支的差异提示

若你当前在 **`master`**：该分支可能 **不包含** 上述文件或已删减；请以 **`dev-ide`** 为源做 merge/cherry-pick，并解决路径别名（`@/`）与组件目录差异。

---

## 6. 已知不一致与改进点（审阅备注）

- **Preload 类型**：`index.ts` 与 `index.d.ts` 中 `completion.generate` 的请求字段不完全一致，建议统一并传 **`enableValidation` / `modelId`**。
- **Abort**：渲染进程 `AbortController` 未连接到主进程取消逻辑。
- **`getModel` 后备**：私有 `getModel()` 使用 `getDefaultModel()`，若未来有路径未传 `modelId` 且未先套 `getCompletionModel()`，可能误用默认聊天模型。

---

*文档生成自 `dev-ide` 分支源码审阅。*
