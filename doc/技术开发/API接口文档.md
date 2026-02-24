# Phowson 平台 API 参考（移动端）

本文档面向 iOS/Android 原生客户端，描述 Phowson 后端现有 API 的调用方式、鉴权约定、错误格式与核心端点说明。

## 1. 基本约定

### 1.1 Base URL

- 本项目后端默认不强制 `/api` 前缀，示例均使用绝对路径（如 `/photos/page`）。
- 生产环境建议配置为 `https://<你的域名>`；开发环境可指向本地或测试域名。

### 1.2 数据格式

- 绝大多数接口为 JSON（`application/json`）。
- 媒体接口返回二进制流（图片）或 302 跳转；客户端应按图片资源加载方式处理。
- 上传接口使用 `multipart/form-data`。

### 1.3 统一错误格式

当 HTTP 状态码为非 2xx 时，响应 body 统一为：

```json
{
  "code": "SOME_ERROR_CODE",
  "message": "错误信息（中文）",
  "requestId": "req_xxx"
}
```

同时响应头会包含 `x-request-id`（便于排障与日志定位）。

## 2. 鉴权与权限（重点）

### 2.1 鉴权机制不是 OAuth/JWT

平台当前采用“服务端会话 token”：

- 登录：`POST /auth/login` 成功返回随机 token（非 JWT）。
- 客户端请求：携带 `Authorization: Bearer <token>`。
- 服务端：仅保存 token 的 hash 并在 `sessions` 表中校验是否存在/有效。

### 2.2 权限角色（RBAC）

- `admin`：管理员（全功能）
- `family`：成员（大部分读写与个人中心）
- `guest`：游客（仅公开浏览 + 游客点赞/评论）

后端对写入/管理类接口会做权限校验，未授权返回 401/403 并携带统一错误格式。

### 2.3 兼容鉴权头（不建议生产使用）

服务端在没有 Bearer token 时会回退解析以下请求头：

- `x-user-id`
- `x-user-name`
- `x-user-role`（`admin`/`family`）
- `x-user-avatar`

此方式更适合开发调试或前端模拟登录，不建议移动端生产环境使用。

## 3. 媒体代理策略（移动端强烈建议遵守）

移动端加载图片/头像时，优先使用平台提供的媒体代理端点：

- `GET /media/photos/:id?variant=thumb|medium|original`
- `GET /media/avatars/:id`

不要直接使用数据库中的绝对 URL（如 MinIO/S3 内网地址），避免 Mixed Content、跨域限制或内网不可达。

## 4. 端点目录

### 4.1 健康检查

#### GET /health

- 鉴权：否
- 响应：

```json
{ "ok": true }
```

### 4.2 认证

#### POST /auth/login

- 鉴权：否
- body：

```json
{
  "email": "user@example.com",
  "password": "******"
}
```

- 响应：

```json
{
  "token": "base64url-random-token",
  "user": {
    "id": "admin",
    "name": "管理员",
    "role": "admin",
    "email": "admin@example.com",
    "avatar": "/media/avatars/admin"
  }
}
```

常见错误：
- `AUTH_NOT_READY`：认证表结构未初始化
- `INVALID_CREDENTIALS`：账号或密码错误
- `ACCOUNT_DISABLED`：账号已禁用

#### GET /auth/me

- 鉴权：是（Bearer token）
- 响应：

```json
{
  "user": {
    "id": "admin",
    "name": "管理员",
    "role": "admin",
    "email": "admin@example.com",
    "avatar": "/media/avatars/admin"
  }
}
```

#### POST /auth/logout

- 鉴权：建议是（Bearer token），缺省也会返回 `{ ok: true }`
- 响应：

```json
{ "ok": true }
```

#### GET /auth/captcha

- 鉴权：否
- query：
  - `format`：可选，`svg`（默认）或 `base64/png/png_base64`（返回 PNG 的 base64）
- 响应（默认 SVG）：

```json
{
  "svg": "<svg .../>",
  "token": "base64(...)"
}
```

说明：用于游客评论验证码校验；`token` 内含过期时间与签名。

- 响应（PNG base64）：

```json
{
  "pngBase64": "iVBORw0KGgoAAA...",
  "mimeType": "image/png",
  "token": "base64(...)"
}
```

### 4.3 分类

#### GET /categories

- 鉴权：否
- 响应：分类数组

#### POST /categories

- 鉴权：是（admin）
- body：

```json
{ "value": "landscape", "label": "风景", "sortOrder": 10 }
```

#### PATCH /categories/:value

- 鉴权：是（admin）
- body（可选字段）：

```json
{ "label": "新名称", "sortOrder": 11 }
```

#### DELETE /categories/:value

- 鉴权：是（admin）

### 4.4 照片（公开）

#### GET /photos

- 鉴权：否
- 响应：照片数组（按创建时间倒序）

#### GET /photos/page?limit&offset

- 鉴权：否
- query：
  - `limit`：1~50（默认 12）
  - `offset`：从 0 开始
  - `since`：可选，增量拉取游标（时间字符串，可被 `Date.parse` 解析）；返回 `updatedAt > since` 的变更项
- 响应：

```json
{
  "items": [],
  "limit": 12,
  "offset": 0,
  "total": 0,
  "hasMore": false,
  "nextOffset": 0,
  "since": "2026-02-14T00:00:00.000Z",
  "nextSince": "2026-02-14T00:00:00.000Z"
}
```

#### GET /photos/:id

- 鉴权：否
- 响应：单个照片详情（含 comments、likes 等聚合字段）

#### POST /photos/:id/like

- 鉴权：否（但有差异）
- body（可选）：

```json
{ "guestId": "device-unique-id" }
```

说明：
- 登录用户（Bearer token）可不传 `guestId`。
- 游客必须传 `guestId` 才能点赞/取消点赞。

#### POST /photos/:id/comment

- 鉴权：否（但有差异）
- body：
  - 登录用户：`{ "content": "..." }`
  - 游客必须额外提供：
    - `guestId`（设备级唯一）
    - `nickname`
    - `email`
    - `captcha`（验证码文字）
    - `captchaToken`（来自 `/auth/captcha`）

### 4.5 照片（发布与管理）

#### POST /photos（发布）

- 鉴权：是（family/admin）
- `multipart/form-data`：
  - file：`photo`
  - text：`title`、`description`、`category`、`tags`（逗号分隔）、`exif`（JSON 字符串）
- 响应：201 + 新建照片详情

#### PATCH /photos/:id（更新）

- 鉴权：是（admin）
- `multipart/form-data`（字段与 `POST /photos` 类似，可按后端支持字段更新）

#### DELETE /photos/:id（删除）

- 鉴权：是（admin）
- 响应：`{ ok: true }`

#### 批量管理（admin）

- `GET /admin/photos/filters`
- `GET /admin/photos/page`
- `POST /admin/photos/batch-delete`
- `POST /admin/photos/batch-category`

#### AI 辅助（admin）

- `POST /photos/:id/ai-fill`
- `POST /photos/:id/ai-critique`
- `DELETE /photos/:id/ai-critique`

### 4.6 媒体

#### GET /media/photos/:id?variant=thumb|medium|original

- 鉴权：否
- 说明：按 variant 返回缩略图/中图/原图；后端会对远端 URL 做代理拉取并以 stream 返回。

#### GET /media/avatars/:id

- 鉴权：否
- 说明：若用户无头像，后端会重定向到默认头像，不会返回 404。

#### GET /media/files/:id

- 鉴权：否

### 4.7 地理编码

#### GET /geocode?lat&lng

- 鉴权：否
- 响应：

```json
{ "location": "国家/城市/地标..." }
```

### 4.8 统计与分析

- `GET /stats/summary?days=30`（公开）
- `GET /stats/platform`（admin）
- `GET /me/analytics/hourly?year&month`（family/admin）
- `GET /me/analytics/daily-goal`（family/admin）
- `POST /me/analytics/daily-goal`（family/admin）

### 4.9 活动与时间线

- `GET /activity/summary`（family/admin）
- `GET /activity/heatmap?year=`（family/admin）
- `GET /me/uploads/timeline?from&to&keyword&limitDays&offsetDays`（family/admin）

### 4.10 成就与挑战

- `GET /gamification/badges`（公开）
- `GET /gamification/challenges`（公开）
- `GET /gamification/badges/my`（family/admin）
- `POST /gamification/badges/check`（family/admin）
- `GET /gamification/challenges/my`（family/admin）
- `POST /gamification/challenges/:challengeId/join`（family/admin）

### 4.11 站点设置与评论审核（admin）

- `GET /site-settings`（公开）
- `GET /admin/site-settings`（admin）
- `POST /admin/site-settings`（admin）
- `POST /admin/upload`（admin）
- 评论审核：`/admin/comments*` 系列接口（筛选、批量操作、状态更新等）

## 5. 数据字段与类型提示

### 5.1 Photo（示意）

照片对象常见字段（以服务端返回为准）：

- `id`：string
- `url`：string（推荐直接用于展示：`/media/photos/:id`）
- `thumbUrl` / `mediumUrl` / `originalUrl`：string | null（可能为空）
- `title` / `description`：string
- `category`：string
- `tags`：string（逗号分隔）
- `exif`：string（JSON 字符串）
- `createdAt` / `updatedAt`：时间戳字符串或可被客户端解析的时间格式
- `lat` / `lng`：number | null
- `user`：{ id, name, avatar, role }
- `comments`：数组（默认只返回已审核通过）

## 6. 代码参考

如需确认具体字段与行为，请参考后端路由实现：

- 认证：[auth.mjs](file:///home/zl/work/workspaces/phowson/server/routes/auth.mjs)
- 照片：[photos.mjs](file:///home/zl/work/workspaces/phowson/server/routes/photos.mjs)
- 媒体：[media.mjs](file:///home/zl/work/workspaces/phowson/server/routes/media.mjs)
- 错误格式：[error.mjs](file:///home/zl/work/workspaces/phowson/server/plugins/error.mjs)
