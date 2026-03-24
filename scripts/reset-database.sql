-- 完全重置 circle_dev 数据库
-- 警告：这将删除所有数据！

-- 断开所有现有连接
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'circle_dev'
  AND pid <> pg_backend_pid();

-- 删除数据库
DROP DATABASE IF EXISTS circle_dev;

-- 创建新数据库
CREATE DATABASE circle_dev;

-- 完成！
-- 现在运行: pnpm drizzle-kit push

