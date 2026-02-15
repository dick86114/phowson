<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Phowson - 浮生（PhotoLogs）

个人摄影分享与复盘网站：支持作品上传、EXIF 解析、管理后台、点赞评论、数据统计，并已将数据从 localStorage 迁移到 Postgres。

本仓库采用「开源核心 + 私有扩展」模式：核心能力开源，敏感/差异化能力通过可选的私有扩展注入。

## 技术栈

- 前端：React + Vite + TypeScript + Tailwind
- 后端：Fastify
- 数据库：Postgres

## 开源许可证

本项目以 MIT License 开源，见 [LICENSE](LICENSE)。

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
PORT=2615
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

默认监听 `http://localhost:2615`，媒体资源通过 `/media/photos/:id`、`/media/avatars/:id` 提供。

### 6）启动前端

```bash
pnpm dev
```

浏览器访问 `http://localhost:2614`。

## Docker 一键启动（推荐）

```bash
docker compose up --build
```

- 前端：`http://localhost:2614`
- 后端：`http://localhost:2615`
- 数据库：`localhost:5432`（默认账号密码见 [docker-compose.yml](file:///home/zl/work/workspaces/phowson/docker-compose.yml)）
- 数据库：`localhost:5432`（默认账号密码见 [docker-compose.yml](docker-compose.yml)）

## 环境变量说明

### 前端（.env.local）

`.env.local` 默认已被 git 忽略。

- `VITE_API_BASE_URL`：后端 API 地址。推荐留空（走同源反代或 Vite proxy）
- `VITE_PROXY_TARGET`：Vite 开发代理的后端地址，默认 `http://127.0.0.1:2615`
- `VITE_PRIVATE_WEB_DISABLED=true`：禁用前端私有扩展注入
- `PRIVATE_WEB_MODULE=@your-scope/phowson-private-web`：从私有 npm 包注入前端扩展（构建时生效）

### 后端（.env.local）

`.env.local` 默认已被 git 忽略。

- `DATABASE_URL`：Postgres 连接串
- `HOST` / `PORT`：后端监听地址与端口
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`：初始化管理员账号（Docker 示例中已提供默认值）

可选：AI（服务端调用，不会暴露到浏览器）

- `AI_PROVIDER`：`gemini` / `openai_compatible` / `openrouter` / `vercelai_gateway` / `anthropic`
- 通用 OpenAI 兼容配置：
  - `AI_API_KEY`/`AI_BASE_URL`/`AI_MODEL`
  - 或 `AI_COMPATIBLE_API_KEY`/`AI_COMPATIBLE_BASE_URL`/`AI_COMPATIBLE_MODEL`
- Gemini：`GEMINI_API_KEY`（或 `AI_API_KEY`）

可选：对象存储（S3/R2/MinIO）

- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` / `S3_PUBLIC_BASE_URL`：启用对象存储上传
- `S3_ENDPOINT` / `S3_REGION` / `S3_FORCE_PATH_STYLE`：S3 兼容服务配置（R2/MinIO 常用）
- `UPLOAD_MAX_BYTES`：上传大小限制（字节）

## 私有扩展（公私混合部署）

### 后端私有扩展

默认会尝试加载 `private/server/plugin.mjs`。你也可以通过环境变量切换加载方式：

- `PRIVATE_EXTENSIONS_DISABLED=true`：禁用私有扩展（开源仓库默认建议关闭或不提供 private 目录）
- `PRIVATE_EXTENSIONS_PATH=relative/path/to/plugin.mjs`：从仓库内指定相对路径加载
- `PRIVATE_EXTENSIONS_MODULE=@your-scope/phowson-private-server`：从私有 npm 包加载
- `PRIVATE_EXTENSIONS_REQUIRED=true`：强制要求私有扩展存在（缺失则启动失败）

私有插件需要导出 `registerPrivateRoutes(app, ctx)` 或 `default` 函数。参考模板：
- [private-template/server/plugin.mjs](private-template/server/plugin.mjs)
- 入口加载器：[server/plugins/private_extensions.mjs](server/plugins/private_extensions.mjs)

### 前端私有扩展

前端通过模块别名 `@private/web` 注入额外路由，默认优先加载 `private/web/plugin.tsx`，否则回退到开源空实现：

- 回退实现：[private-stubs/web.tsx](private-stubs/web.tsx)
- 私有模板：[private-template/web/plugin.tsx](private-template/web/plugin.tsx)
- 全局开关：`VITE_PRIVATE_WEB_DISABLED=true`
- 以私有 npm 包形式提供：设置 `PRIVATE_WEB_MODULE=@your-scope/phowson-private-web`

## API 文档与功能演示

- API 参考：[doc/API_REFERENCE.md](doc/API_REFERENCE.md)
- 移动端对接：[doc/APP_INTEGRATION_GUIDE.md](doc/APP_INTEGRATION_GUIDE.md)
- SDK 约定：[doc/MOBILE_SDK_CONVENTIONS.md](doc/MOBILE_SDK_CONVENTIONS.md)
- 公私混合部署（两仓/隔离方案）：[doc/OPEN_CORE_DEPLOYMENT.md](doc/OPEN_CORE_DEPLOYMENT.md)

## 贡献指南与代码规范

- 包管理：统一使用 pnpm
- 提交前检查：必须通过 `pnpm typecheck` 与 `pnpm build`
- 代码风格：保持与现有文件一致；避免引入无必要依赖
- 安全：禁止提交密钥与敏感配置，可用 `pnpm secrets:scan` 自检

## localStorage 数据一键迁移

如果你之前已经在浏览器里产生了 localStorage Mock 数据，可在管理后台的“设置”页点击“导入本地数据”，会调用后端 `/admin/migrate/localstorage` 将本地照片/评论迁移到数据库持久化。

## 开源导出与同步建议

本仓库提供一个「导出开源仓库目录」的脚本，会按 [.ossignore](.ossignore) 排除私有目录、环境文件、日志等：

```bash
pnpm oss:export
```

生成目录为 `dist-oss/`（建议在该目录内初始化新的 GitHub 仓库并推送）。

开源发布的推荐流程（两仓）：

1) 在私有仓库/私有分支开发（可包含 `private/` 或私有包配置）
2) 发布前执行：

```bash
pnpm secrets:scan
pnpm oss:export
```

3) 将 `dist-oss/` 推送到新的 GitHub 仓库（开源核心仓库）

## 三种代码隔离方案（可选）

1) 开源核心 + 私有扩展（推荐）
   - 开源仓库保持可独立运行；私有能力通过「动态加载模块 + 前端别名注入」实现。

2) 开源核心 + 私有 npm 包
   - 私有能力全部发布到私有 registry，通过 `PRIVATE_EXTENSIONS_MODULE` / `PRIVATE_WEB_MODULE` 引入。

3) 单仓库 + 自动剥离发布
   - 继续单仓维护，在 CI 中基于 `.ossignore` 导出开源子树推送到公开仓库（适合频繁同步）。
