# 公私混合部署（开源核心 + 私有扩展）

本文档描述如何将 Phowson 拆分为「开源核心仓库」与「私有功能仓库」，并通过扩展点实现混合部署。

## 目标

- 开源核心仓库可独立安装、编译、运行、测试。
- 私有仓库包含敏感逻辑/密钥/定制功能，不进入公开仓库。
- 部署时通过配置与依赖注入加载私有功能，做到“可插拔”。
- 开源仓库不内置任何第三方密钥；所有密钥仅通过服务端环境变量注入。

## 代码结构建议

### 开源仓库（public）

- `server/`：后端核心（Fastify + Postgres）
- `pages/`、`components/`、`utils/`：前端核心（React + Vite）
- `private-stubs/`：私有扩展的空实现（保证开源仓库可编译）
- `server/plugins/private_extensions.mjs`：后端私有扩展加载器
- `vite.config.ts` + `tsconfig.json`：前端私有扩展别名注入
- `tools/export_oss_repo.mjs`：开源导出工具
- `.ossignore`：开源导出排除清单

### 私有仓库（private）

两种形态二选一：

1) 作为 Git 子模块挂载到开源仓库的 `private/` 目录
2) 作为私有 npm 包发布到私有 registry（推荐团队协作）

推荐目录结构：

- `server/plugin.mjs`：后端扩展入口（导出 `registerPrivateRoutes`）
- `web/plugin.tsx`：前端扩展入口（导出 `getPrivateRoutes`）

开源仓库已提供模板参考：
- [private-template/server/plugin.mjs](../private-template/server/plugin.mjs)
- [private-template/web/plugin.tsx](../private-template/web/plugin.tsx)

## 模块依赖与边界

- 开源核心不得 `import` 私有仓库的任何实现文件。
- 开源核心只允许依赖“扩展点接口”（约定的导出函数签名）与“加载器”（动态 import + 容错）。
- 私有仓库可以依赖开源核心提供的类型/工具（建议以文档约定为主，避免私有仓库深耦合内部实现细节）。

## 后端扩展点

开源后端会在启动时尝试加载私有插件：
- 默认路径：`private/server/plugin.mjs`
- 可选：通过 `PRIVATE_EXTENSIONS_PATH` 指定相对路径
- 可选：通过 `PRIVATE_EXTENSIONS_MODULE` 从私有 npm 包加载
- 禁用：`PRIVATE_EXTENSIONS_DISABLED=true`
- 强制要求：`PRIVATE_EXTENSIONS_REQUIRED=true`（缺失则启动失败）

私有插件签名：

- `export const registerPrivateRoutes = async (app, ctx) => { ... }`
- 或者 `export default async (app, ctx) => { ... }`

## 前端扩展点

前端通过模块 `@private/web` 注入额外路由：

- 默认优先加载：`private/web/plugin.tsx`
- 回退：`private-stubs/web.tsx`（空实现）
- 禁用：`VITE_PRIVATE_WEB_DISABLED=true`
- 以私有 npm 包方式提供：`PRIVATE_WEB_MODULE=@your-scope/phowson-private-web`

私有插件签名：

- `export const getPrivateRoutes = () => <Route ... />`

## 代码分离落地步骤（两仓方案）

目标是形成两个独立仓库：

- `phowson`（public）：开源核心仓库，可独立构建与运行
- `phowson-private`（private）：私有扩展仓库，仅内部可见

推荐流程：

1) 在私有仓库开发（包含 `private/` 或私有包接入），保持主仓库可运行
2) 发布开源时执行：

```bash
pnpm secrets:scan
pnpm oss:export
```

3) 进入 `dist-oss/`，初始化为新的 GitHub 仓库并推送（该目录为“开源核心仓库”内容）

说明：

- 本环境无法直接帮你创建 GitHub 仓库链接；但导出目录已具备“可直接公开”的最小集合，你只需要把它推送到 GitHub 即可。
- `.ossignore` 是剥离规则的唯一入口，建议每次变更都纳入评审。

## 开源导出（剥离私有代码）

使用：

```bash
pnpm oss:export
```

脚本会把仓库导出到 `dist-oss/`，并按 [.ossignore](../.ossignore) 排除：

- `private/`
- `.env.local` 等敏感配置文件
- 日志、构建产物、测试报告、node_modules 等

建议将 `dist-oss/` 初始化为新的公开 GitHub 仓库。

## 私有部分保护与接入方式

### 方式 A：Git 子模块（挂载到 private/）

适合：私有功能与核心仓库强绑定、团队 Git 工作流成熟。

在开源核心仓库中添加子模块（示意）：

```bash
git submodule add <private-repo-url> private
git submodule update --init --recursive
```

约定：

- 私有后端入口：`private/server/plugin.mjs`
- 私有前端入口：`private/web/plugin.tsx`
- 严禁把 `private/` 导出到开源：`.ossignore` 中必须包含 `private/`

### 方式 B：私有 npm 包（推荐团队协作）

适合：多项目复用、希望独立发布/回滚私有能力。

后端（Node ESM）：

- 发布私有包：`@your-scope/phowson-private-server`
- 部署时设置：`PRIVATE_EXTENSIONS_MODULE=@your-scope/phowson-private-server`

前端（Vite alias）：

- 发布私有包：`@your-scope/phowson-private-web`
- 构建时设置：`PRIVATE_WEB_MODULE=@your-scope/phowson-private-web`

建议：

- 私有包不得包含任何明文密钥；密钥一律通过运行时环境变量注入到后端。

## 部署验证方案（开源核心）

- Docker 一键启动：使用 [docker-compose.yml](../docker-compose.yml)
- 示例数据：使用 `pnpm db:seed:env` 将 `constants.ts` 的 mock 数据写入数据库
- 自动化测试：
  - `pnpm test:ci`：路由注入测试（不依赖外部后端）
  - `pnpm test:full`：系统端到端测试（需要启动后端）
- CI/CD：
  - 示例流水线： [.github/workflows/ci.yml](../.github/workflows/ci.yml)
  - 系统测试： [.github/workflows/system-test.yml](../.github/workflows/system-test.yml)

## CI/CD 建议

开源仓库推荐在 CI 中固定执行：

- `pnpm secrets:scan`：基础密钥扫描
- `pnpm db:migrate`：数据库迁移
- `pnpm test:ci`：注入测试（无需外部后端）
- `pnpm typecheck`：类型检查
- `pnpm build`：前端构建

示例见：[.github/workflows/ci.yml](../.github/workflows/ci.yml)

## 持续维护策略（同步、版本、反馈）

### 同步机制

推荐以“私有仓库为主源”开发，定期导出开源核心并推送到 GitHub：

- 开发日常：私有仓库提交为主（可包含 `private/` 或私有包配置）
- 开源同步：`pnpm secrets:scan && pnpm oss:export`，导出后的 `dist-oss/` 单独提交到开源仓库

### 版本管理规范

建议使用语义化版本（SemVer）并明确兼容性：

- 开源核心：`coreVersion`（例如 `1.4.0`）
- 私有扩展：`privateVersion`（例如 `1.4.0+corp.3` 或独立 `0.3.0`）

兼容约定：

- 私有扩展需声明兼容的核心版本范围（例如 `^1.4.0`）
- 核心若破坏扩展点契约（导出签名、注入时机、路由约定），必须提升主版本并在变更说明中给出迁移步骤

### 问题跟踪与反馈分流

- 开源社区：GitHub Issues（仅讨论开源核心）
- 私有需求：内部工单系统（Jira/飞书/Linear 等）

处理原则：

- 可通用的问题优先回馈开源（修复 + 测试 + 说明）
- 与私有业务强耦合的问题仅在私有仓库处理

## 至少三种隔离方案（可选）

1) 开源核心 + 私有扩展（插件化注入，推荐默认）
2) 开源核心 + 私有 npm 包（私有能力独立发布）
3) 单仓库 + 自动剥离发布（以 `.ossignore` 导出 `dist-oss/` 推送开源）
