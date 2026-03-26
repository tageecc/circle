# 向量搜索配置指南

Circle 使用 **sqlite-vec** 扩展实现可选的语义代码搜索。

## 功能特点

- ✅ **可选功能**：默认关闭，开启后使用 AI embeddings
- ✅ **真语义搜索**：理解代码含义，不仅仅匹配关键词
- ✅ **本地存储**：向量存在 SQLite，无需独立向量库
- ✅ **多提供商支持**：OpenAI、Voyage AI、Qwen
- ✅ **增量索引**：只对新增/修改文件生成向量

## 快速开始

### 1. 启用向量搜索

在 **设置 → 通用 → 代码搜索** 中：
1. 开启"向量语义搜索"开关
2. 选择 Embedding Provider：
   - `OpenAI Small` (推荐)：1536 维，成本低速度快
   - `OpenAI Large`：3072 维，更精确
   - `Voyage AI Code`：1536 维，代码优化
   - `Qwen Embedding`：1024 维，中文友好

### 2. 配置 API Key

在 **设置 → API Keys** 中配置对应的 key：
- OpenAI：需 OpenAI API key
- Voyage AI：需 Voyage AI key
- Qwen：需 Alibaba DashScope key

### 3. 索引项目（首次或代码变更后）

点击状态栏的 **"索引项目"** 按钮，或使用命令面板 `⌘K` → "Index Project"

**索引过程：**
1. 扫描支持的代码文件（.ts/.js/.py/.java 等）
2. 切分成 512 token 的 chunks（带 50 token overlap）
3. 批量生成 embeddings（每批调用 API）
4. 存储向量到 SQLite

**预计时间：**
- 小项目（1-2万行）：1-2 分钟
- 中型项目（5-10万行）：5-10 分钟
- 大型项目（50万行+）：30+ 分钟

### 4. 使用语义搜索

在 AI 对话中，助手会自动使用 `codebase_search` 工具：

```
👤 用户：Where is user authentication implemented?

🤖 助手：[自动调用 codebase_search]
找到 5 个相关结果：
- src/auth/middleware.ts (score: 0.89)
- src/services/user.service.ts (score: 0.82)
...
```

**搜索特点：**
- 自动理解同义词（"auth" / "authentication" / "login"）
- 跨文件找相关代码
- 按相似度排序（0.5-1.0，默认阈值 0.5）
- Top 15 结果

## 技术细节

### 架构

```
┌─────────────────────────────────────┐
│ 用户查询: "How is auth handled?"    │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ EmbeddingService.generateEmbedding  │
│ → OpenAI API / Voyage AI API        │
└─────────────┬───────────────────────┘
              │ Float32Array (1536 维)
              ▼
┌─────────────────────────────────────┐
│ SQLite + sqlite-vec                 │
│ vec_distance_cosine(embedding, ?)   │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ 返回 Top 15 结果（相似度 > 0.5）     │
└─────────────────────────────────────┘
```

### 数据库 Schema

```sql
-- codebase_vectors 表
CREATE TABLE codebase_vectors (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  file_path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  text TEXT NOT NULL,
  language TEXT NOT NULL,
  embedding BLOB,  -- Float32Array as Buffer
  created_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX idx_codebase_vectors_project ON codebase_vectors(project_path);
CREATE INDEX idx_codebase_vectors_file ON codebase_vectors(file_path);
```

### sqlite-vec 函数

- `vec_distance_cosine(vec1, vec2)`：余弦距离（0-2，越小越相似）
- `vec_length(vec)`：向量维度
- `vec_normalize(vec)`：归一化

### 相似度计算

```typescript
score = 1 - distance  // 转换为相似度 (0-1)
filter: score >= 0.5  // 默认阈值
```

## 常见问题

### Q: 索引很慢？
**A**: 
- embedding API 调用是主要耗时（网络 + 计算）
- 使用批量接口（每批最多 2048 tokens）
- 大项目考虑后台索引或分批索引

### Q: 搜索结果不准？
**A**:
- 检查 API Key 是否配置正确
- 尝试更换 embedding 模型（`openai-large` 更精确）
- 降低相似度阈值（代码中 `minScore` 参数）
- 查看是否降级到文本搜索（日志会提示）

### Q: 成本如何？
**A**:
- OpenAI text-embedding-3-small: $0.02 / 1M tokens
- 示例：Circle 项目（21万行）→ 约 5万 chunks × 512 tokens ≈ $1.28
- 索引一次，长期使用，增量更新

### Q: 能离线使用吗？
**A**:
- 当前版本需要 embedding API（在线）
- 未来可集成本地模型（Ollama/ONNX）
- 已生成的向量支持离线搜索

### Q: 和 grep 的区别？
**A**:
| 工具 | 适用场景 | 示例 |
|------|---------|------|
| `grep` | 精确符号查找 | "找所有 `getUserById` 调用" |
| `codebase_search` | 语义理解 | "用户认证是怎么实现的" |

### Q: 向量存储占多少空间？
**A**:
- 1536 维 float32 = 6KB/chunk
- 5万 chunks ≈ 300MB（文本 + 向量）
- 在同一个 `circle.db` 里

## 性能优化建议

1. **首次索引选择合适时机**：在空闲时索引大项目
2. **排除无关目录**：`node_modules`、`dist` 等已自动忽略
3. **定期增量更新**：git pull 后重新索引（只处理变更文件）
4. **调整相似度阈值**：根据项目调整 `minScore`（0.3-0.7）

## 未来计划

- [ ] 本地 embedding 模型支持（Ollama/ONNX）
- [ ] 混合检索（向量 + BM25 文本）
- [ ] 多模态索引（图片、文档）
- [ ] 跨项目联合检索
- [ ] 实时增量索引（文件保存时自动更新）

## 技术栈

- **sqlite-vec**: v0.1.7（Alex Garcia / asg017）
- **better-sqlite3**: v12.5.0（SQLite 驱动）
- **OpenAI Embeddings API**: text-embedding-3-small/large
- **Voyage AI API**: voyage-code-2

---

**遇到问题？** 
- 查看主进程日志（Help → Toggle Developer Tools → Console）
- 搜索 `[Embedding]` / `[CodebaseIndex]` 标签
- 问题反馈：Help → Report Bug
