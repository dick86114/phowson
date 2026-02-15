#!/bin/bash

# 检查是否为 git 仓库
if [ ! -d ".git" ]; then
  echo "正在初始化 git 仓库..."
  git init
fi

# 检查 git 用户配置，如果没有配置则使用默认值
if [ -z "$(git config user.name)" ]; then
    echo "未检测到 git 用户配置，正在设置临时用户信息..."
    git config user.name "Project User"
    git config user.email "user@example.com"
fi

# 添加所有文件
echo "正在添加文件..."
git add .

# 获取提交信息
if [ -z "$1" ]; then
  COMMIT_MSG="Auto commit: $(date '+%Y-%m-%d %H:%M:%S')"
else
  COMMIT_MSG="$1"
fi

# 提交代码
echo "正在提交代码: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

echo "完成！"
