#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 正在准备启动 Phowson - 浮生 (PhotoLogs)..."

# 1. 检查环境变量文件
if [ ! -f ".env.local" ] && [ ! -f "server/.env.local" ]; then
    echo "⚠️  未发现 .env.local 文件，正在从 server/.env.example 复制..."
    cp server/.env.example .env.local
    echo "📝 请根据需要编辑 .env.local 并配置您的数据库和 API 密钥。"
fi

# 1.1 设置 ENV_FILE，供后端按指定路径加载
if [ -f "server/.env.local" ]; then
    export ENV_FILE="server/.env.local"
else
    export ENV_FILE=".env.local"
fi

# 2. 清理残留进程 (防止端口占用导致启动失败)
echo "🧹 正在清理旧的进程 (端口 3000, 3001)..."
fuser -k 3000/tcp 3001/tcp 3002/tcp 2>/dev/null || true

# 3. 运行数据库迁移
echo "🗄️  正在检查并运行数据库迁移..."
pnpm db:migrate

# 4. 启动后端并等待就绪
echo "📡 正在启动后端服务器..."
pnpm dev:server > backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端健康检查通过 (最多等待 10 秒)
echo "⌛ 等待后端就绪..."
for i in {1..10}; do
    if curl -s http://192.168.31.83:3001/health | grep -q "ok"; then
        echo "✅ 后端已就绪 (http://192.168.31.83:3001)"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ 后端启动超时，请检查 backend.log"
        kill $BACKEND_PID
        exit 1
    fi
    sleep 1
done

# 5. 启动前端
echo "🌟 正在启动前端界面..."
pnpm dev &
FRONTEND_PID=$!

echo "-------------------------------------------------------"
echo "🎉 项目启动成功！"
echo "🏠 本地访问: http://192.168.31.83:3000"
echo "🌐 远程访问: http://$(hostname -I | awk '{print $1}'):3000"
echo "-------------------------------------------------------"
echo "💡 提示: 后端日志保存在 backend.log"
echo "按 Ctrl+C 停止所有服务"

# 使用 trap 确保脚本按下 Ctrl+C 退出时关闭所有子进程
trap "echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM EXIT

# 等待所有后台进程结束
wait
