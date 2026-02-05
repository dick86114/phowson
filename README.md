<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Phowson - 浮生（PhotoLogs）

个人摄影分享与复盘网站：支持作品上传、EXIF 解析、管理后台、点赞评论、数据统计，并已将数据从 localStorage 迁移到 Postgres。

## 技术栈

- 前端：React + Vite + TypeScript + Tailwind
- 后端：Fastify
- 数据库：Postgres

## 本地启动

**前置条件**

- Node.js（建议 18+）
- pnpm
- 可访问的 Postgres 实例

### 1）安装依赖

```bash
pnpm install
```

### 2）配置后端环境变量

复制 `server/.env.example` 的内容到项目根目录的 `.env.local`，并填写你的数据库连接串：

```bash
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB
HOST=0.0.0.0
PORT=3001
```

### 3）初始化数据库表结构

```bash
pnpm db:migrate
```

### 4）导入示例数据（可选）

将 `constants.ts` 的 `MOCK_PHOTOS` 写入数据库：

```bash
pnpm db:seed:env
```

### 5）启动后端

```bash
pnpm dev:server
```

默认监听 `http://localhost:3001`，媒体资源通过 `/media/photos/:id`、`/media/avatars/:id` 提供。

### 6）启动前端

```bash
pnpm dev
```

浏览器访问 `http://localhost:5173`。

## 环境变量说明

### 前端（.env.local）

`.env.local` 默认已被 git 忽略。

- `VITE_API_BASE_URL`：后端 API 地址，默认 `http://localhost:3001`
- `GEMINI_API_KEY` 或 `VITE_GEMINI_API_KEY`：用于“AI 智能填单”

### 后端（.env.local）

`.env.local` 默认已被 git 忽略。

- `DATABASE_URL`：Postgres 连接串
- `HOST` / `PORT`：后端监听地址与端口

可选：对象存储（S3/R2/MinIO）

- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` / `S3_PUBLIC_BASE_URL`：启用对象存储上传
- `S3_ENDPOINT` / `S3_REGION` / `S3_FORCE_PATH_STYLE`：S3 兼容服务配置（R2/MinIO 常用）
- `UPLOAD_MAX_BYTES`：上传大小限制（字节）

## localStorage 数据一键迁移

如果你之前已经在浏览器里产生了 localStorage Mock 数据，可在管理后台的“设置”页点击“导入本地数据”，会调用后端 `/admin/migrate/localstorage` 将本地照片/评论迁移到数据库持久化。
