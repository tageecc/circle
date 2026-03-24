#!/bin/bash

# Mastra Traces 查看工具
# 用于查看 AI 请求的详细信息

DB_FILE="circle-traces.db"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Mastra AI Traces 查看工具"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 查看最近的 traces
echo "📋 最近的 10 条 AI 请求："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sqlite3 -column -header "$DB_FILE" "
SELECT 
  substr(traceId, 1, 8) as trace_id,
  name as agent,
  datetime(startTime/1000000000, 'unixepoch', 'localtime') as time
FROM mastra_traces 
ORDER BY startTime DESC 
LIMIT 10;
"
echo ""

# 2. 查看 apply_edit_agent 的请求
echo "🤖 Apply Edit Agent 的请求："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sqlite3 -column -header "$DB_FILE" "
SELECT 
  substr(traceId, 1, 8) as trace_id,
  datetime(startTime/1000000000, 'unixepoch', 'localtime') as time,
  json_extract(status, '$.code') as status
FROM mastra_traces 
WHERE name LIKE '%apply%edit%' 
ORDER BY startTime DESC 
LIMIT 5;
"
echo ""

# 3. 查看最近一次请求的详细信息
echo "📝 最近一次请求的详细信息："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LATEST_TRACE=$(sqlite3 "$DB_FILE" "SELECT traceId FROM mastra_traces ORDER BY startTime DESC LIMIT 1;")

if [ -n "$LATEST_TRACE" ]; then
  echo "Trace ID: $LATEST_TRACE"
  echo ""
  
  # 查看 spans（请求步骤）
  echo "🔄 执行步骤 (Spans)："
  sqlite3 -column -header "$DB_FILE" "
  SELECT 
    substr(spanId, 1, 8) as span_id,
    name,
    status,
    (endTime - startTime) as duration_ns
  FROM mastra_ai_spans 
  WHERE traceId = '$LATEST_TRACE'
  ORDER BY startTime;
  "
  echo ""
  
  # 查看 attributes（包含实际请求参数）
  echo "📤 请求参数 (Attributes):"
  sqlite3 -json "$DB_FILE" "
  SELECT attributes 
  FROM mastra_ai_spans 
  WHERE traceId = '$LATEST_TRACE' 
  AND name LIKE '%generate%'
  LIMIT 1;
  " | python3 -m json.tool 2>/dev/null || sqlite3 "$DB_FILE" "
  SELECT attributes 
  FROM mastra_ai_spans 
  WHERE traceId = '$LATEST_TRACE' 
  LIMIT 1;
  "
else
  echo "❌ 没有找到任何 traces"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 提示："
echo "  - 运行应用并触发文件编辑操作"
echo "  - 再次运行此脚本查看最新的请求"
echo "  - 或查看控制台日志获取实时输出"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

