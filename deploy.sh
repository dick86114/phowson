#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== 开始构建并部署流程 ===${NC}"

# 函数：检查并清理占用端口的进程
check_and_kill_port() {
    local port=$1
    local name=$2
    
    if ! command -v lsof &> /dev/null; then
        echo -e "${YELLOW}警告: 未找到 lsof 命令，跳过端口 $port 清理检查。${NC}"
        return
    fi
    
    # 检查端口是否有进程占用
    local pid=$(lsof -ti :$port 2>/dev/null | xargs)
    
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}警告: 端口 $port ($name) 正被进程 $pid 占用。${NC}"
        # 获取进程名称以便提示
        local pname=$(ps -p $pid -o comm= 2>/dev/null)
        echo -e "${YELLOW}正在尝试终止进程 $pid ($pname)...${NC}"
        
        # 尝试终止所有占用该端口的进程
        echo "$pid" | xargs kill -9 2>/dev/null
        
        # 再次检查
        sleep 1
        pid=$(lsof -ti :$port 2>/dev/null)
        if [ -n "$pid" ]; then
            echo -e "${RED}无法终止占用端口 $port 的进程 $pid。请手动处理。${NC}"
            exit 1
        else
            echo -e "${GREEN}已成功释放端口 $port。${NC}"
        fi
    else
        echo -e "${GREEN}端口 $port ($name) 可用。${NC}"
    fi
}

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo -e "${YELLOW}警告: 未检测到 .env 文件。${NC}"
    if [ -f .env.example ]; then
        echo -e "${YELLOW}正在从 .env.example 复制创建 .env 文件...${NC}"
        cp .env.example .env
        echo -e "${GREEN}已创建 .env 文件，请稍后根据需要修改其中的配置（如数据库密码、API密钥等）。${NC}"
    else
        echo -e "${RED}错误: 未找到 .env 或 .env.example 文件，无法继续。${NC}"
        exit 1
    fi
fi

# 加载环境变量（仅用于显示当前版本信息，实际构建由 docker compose 处理）
# 导出 .env 中的变量
set -a
source .env
set +a

echo -e "${GREEN}当前配置信息:${NC}"
echo "API 镜像: ${DOCKER_IMAGE_API:-phowson-api}"
echo "Web 镜像: ${DOCKER_IMAGE_WEB:-phowson-web}"
echo "版本 Tag: ${DOCKER_TAG:-latest}"
echo "API 端口: 26215"
echo "Web 端口: 26214"

echo -e "\n${GREEN}1. 开始构建 Docker 镜像...${NC}"
docker compose build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}镜像构建成功！${NC}"
else
    echo -e "${RED}镜像构建失败，请检查 Dockerfile 或网络连接。${NC}"
    exit 1
fi

echo -e "${GREEN}2. 清理旧服务及检查端口...${NC}"

# 停止旧容器并清理孤儿容器（解决服务改名导致的端口占用）
echo -e "${YELLOW}正在停止并移除旧容器...${NC}"
docker compose down --remove-orphans

if command -v lsof &> /dev/null; then
    # 检查 Web 端口
    check_and_kill_port 26214 "Web 服务"
    # 检查 API 端口
    check_and_kill_port 26215 "API 服务"
    # 检查 DB 端口
    check_and_kill_port "${DB_PORT:-5432}" "数据库服务"
else
    echo -e "${YELLOW}警告: 未找到 lsof 命令，跳过端口自动清理。${NC}"
fi

echo -e "\n${GREEN}3. 启动服务...${NC}"
docker compose up -d

if [ $? -eq 0 ]; then
    echo -e "${GREEN}=== 部署完成 ===${NC}"
    echo -e "Web 服务地址: http://localhost:26214"
    echo -e "API 服务地址: http://localhost:26215"
    echo -e "请使用 'docker compose logs -f' 查看实时日志。"
else
    echo -e "${RED}服务启动失败。${NC}"
    exit 1
fi
