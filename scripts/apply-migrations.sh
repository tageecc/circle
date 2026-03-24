#!/bin/bash

# 应用数据库迁移脚本
# 自动选择 "create table" 选项

set -e

echo "🚀 开始应用数据库迁移..."
echo ""

# 使用 expect 自动处理交互式选择
# 如果没有 expect，则手动执行
if command -v expect &> /dev/null; then
  expect << 'EOF'
    set timeout -1
    spawn pnpm drizzle-kit push
    
    # 等待 agent_memories 选择
    expect {
      "Is agent_memories table created or renamed from another table?" {
        send "\r"
        exp_continue
      }
      "Is agent_todos table created or renamed from another table?" {
        send "\r"
        exp_continue
      }
      "Is users table created or renamed from another table?" {
        send "\r"
        exp_continue
      }
      "Is projects table created or renamed from another table?" {
        send "\r"
        exp_continue
      }
      "Is sessions table created or renamed from another table?" {
        send "\r"
        exp_continue
      }
      eof
    }
EOF
else
  echo "⚠️  未安装 expect 工具，请手动执行："
  echo ""
  echo "  pnpm drizzle-kit push"
  echo ""
  echo "对于每个表，选择第一个选项（+ xxx create table）"
  echo ""
  exit 1
fi

echo ""
echo "✅ 数据库迁移完成！"

