#!/bin/bash

set -e

echo "🚀 正在启动 Phowson..."

load_env_file() {
    local file="$1"
    [ -f "$file" ] || return 0
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line#"${line%%[![:space:]]*}"}"
        [ -z "$line" ] && continue
        case "$line" in \#*) continue ;; esac
        [[ "$line" != *=* ]] && continue
        local key="${line%%=*}"
        local value="${line#*=}"
        key="${key//[[:space:]]/}"
        value="${value#"${value%%[![:space:]]*}"}"
        value="${value%"${value##*[![:space:]]}"}"
        if [[ "$value" != \"* && "$value" != \'* ]]; then
            value="${value%%[[:space:]]\#*}"
            value="${value%"${value##*[![:space:]]}"}"
        fi
        if [[ "$value" == \"*\" && "$value" == *\" ]]; then value="${value:1:${#value}-2}"; fi
        if [[ "$value" == \'*\' && "$value" == *\' ]]; then value="${value:1:${#value}-2}"; fi
        export "$key=$value"
    done < "$file"
}

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

DEFAULT_BACKEND_HOST="127.0.0.1"
DEFAULT_BACKEND_PORT="2615"
DEFAULT_FRONTEND_PORT="2614"
DEFAULT_VITE_HOST="0.0.0.0"
DEFAULT_FRONTEND_ACCESS_HOST="127.0.0.1"

if [ ! -f ".env.local" ] && [ ! -f "server/.env.local" ]; then
    echo "⚠️  未发现 .env.local 文件，正在从 server/.env.example 复制..."
    cp server/.env.example .env.local
    echo "📝 请根据需要编辑 .env.local 并配置数据库与密钥。"
fi

if [ -f "$SCRIPT_DIR/server/.env.local" ]; then
    export ENV_FILE="$SCRIPT_DIR/server/.env.local"
else
    export ENV_FILE="$SCRIPT_DIR/.env.local"
fi
load_env_file "$ENV_FILE"

BACKEND_HOST="${PHOWSON_BACKEND_HOST:-${HOST:-$DEFAULT_BACKEND_HOST}}"
BACKEND_PORT="${PHOWSON_BACKEND_PORT:-${PORT:-$DEFAULT_BACKEND_PORT}}"
FRONTEND_PORT="${PHOWSON_FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}"
VITE_HOST="${PHOWSON_VITE_HOST:-$DEFAULT_VITE_HOST}"
FRONTEND_ACCESS_HOST="${PHOWSON_FRONTEND_ACCESS_HOST:-$DEFAULT_FRONTEND_ACCESS_HOST}"

echo "🛑 停止旧进程..."
if command -v fuser >/dev/null 2>&1; then
    fuser -k "${FRONTEND_PORT}/tcp" "${BACKEND_PORT}/tcp" 2>/dev/null || true
fi

echo "🗄️  正在检查并运行数据库迁移..."
pnpm db:migrate

echo "📡 启动后端服务..."
export HOST="$BACKEND_HOST"
export PORT="$BACKEND_PORT"
nohup pnpm dev:server > backend.log 2>&1 &
BACKEND_PID=$!

echo "⌛ 等待后端就绪..."
for i in {1..20}; do
    if curl -sf "http://${BACKEND_HOST}:${BACKEND_PORT}/health" | grep -q "ok"; then
        echo "✅ 后端已就绪！"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "❌ 后端启动超时，请检查 backend.log"
        tail -20 backend.log
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

echo "🎨 启动前端服务..."
nohup pnpm dev -- --host "$VITE_HOST" --port "$FRONTEND_PORT" --strictPort > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "⌛ 等待前端就绪..."
for i in {1..20}; do
    if curl -sf "http://${FRONTEND_ACCESS_HOST}:${FRONTEND_PORT}" > /dev/null 2>&1; then
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

echo "-------------------------------------------------------"
echo "🎉 项目启动成功！"
echo "✅ 服务已在后台运行"
echo "📱 前端地址: http://${FRONTEND_ACCESS_HOST}:${FRONTEND_PORT}"
echo "🔌 后端地址: http://${BACKEND_HOST}:${BACKEND_PORT}"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -n "$LAN_IP" ]; then
    echo "🌐 局域网访问: http://${LAN_IP}:${FRONTEND_PORT}"
fi
echo "-------------------------------------------------------"
echo "💡 提示: 后端日志 backend.log，前端日志 frontend.log"
echo "💡 提示: 使用 'fuser -k ${FRONTEND_PORT}/tcp ${BACKEND_PORT}/tcp' 停止服务"
echo "-------------------------------------------------------"
