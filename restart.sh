#!/bin/bash

# Phowson - 浮生 (PhotoLogs) 重启脚本
# 快速重启前后端服务

set -e

echo "🔄 正在重启 Phowson 服务..."

# 切换到项目根目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 停止旧进程
echo "🛑 停止旧进程..."
fuser -k 3000/tcp 3001/tcp 3002/tcp 2>/dev/null || true
sleep 2

# 检查端口是否真正释放
for port in 3000 3001 3002; do
    if lsof -ti:$port > /dev/null 2>&1; then
        echo "⚠️  警告: 端口 $port 仍被占用，强制结束..."
        fuser -k $port/tcp 2>/dev/null || true
        sleep 1
    fi
done

# 启动后端（跳过迁移）
echo "📡 启动后端服务..."

# 指定 ENV_FILE（绝对路径），后端将按此路径加载 .env.local
if [ -f "$SCRIPT_DIR/server/.env.local" ]; then
    export ENV_FILE="$SCRIPT_DIR/server/.env.local"
elif [ -f "$SCRIPT_DIR/.env.local" ]; then
    export ENV_FILE="$SCRIPT_DIR/.env.local"
fi
export NODE_ENV="development"

nohup node server/index.mjs > backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端就绪
echo "⌛ 等待后端就绪..."
for i in {1..15}; do
    if curl -s http://192.168.31.83:3001/health > /dev/null 2>&1; then
        echo "✅ 后端已就绪！"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "❌ 后端启动超时，请检查 backend.log"
        tail -20 backend.log
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# 启动前端
echo "🎨 启动前端服务..."
echo "🔍 检查前端依赖..."
if ! node -e "require.resolve('tailwindcss')" >/dev/null 2>&1; then
    echo "📦 检测到 tailwindcss 未安装，正在执行 pnpm install..."
    pnpm install
fi
nohup pnpm dev -- --host 192.168.31.83 --port 3002 --strictPort > frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端就绪
echo "⌛ 等待前端就绪..."
for i in {1..20}; do
    if curl -s http://192.168.31.83:3002 > /dev/null 2>&1; then
        echo "✅ 前端已就绪！"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "❌ 前端启动超时，请检查 frontend.log"
        tail -20 frontend.log
        kill $FRONTEND_PID 2>/dev/null || true
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

echo ""
echo "🎉 Phowson 重启完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 前端地址: http://192.168.31.83:3002"
echo "🔌 后端地址: http://192.168.31.83:3001"
echo "📊 后端进程 PID: $BACKEND_PID"
echo "🎨 前端进程 PID: $FRONTEND_PID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 提示："
echo "  - 查看后端日志: tail -f backend.log"
echo "  - 查看前端日志: tail -f frontend.log"
echo "  - 停止服务: fuser -k 3001/tcp 3002/tcp"
echo ""
