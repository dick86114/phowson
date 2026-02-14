# Phowson 移动端对接指南（iOS/Android 原生）

本文档给原生客户端开发使用，重点是“怎么对接更稳、更快、更安全”，以及一些平台特有的坑位与推荐实现方式。

## 1. 接入前准备

### 1.1 环境与 Base URL

- 线上：`https://<你的域名>`
- 测试：`https://<测试域名>` 或内网地址（建议用 HTTPS）
- 本地：如 `http://localhost:3001`（真机调试需走局域网 IP 或反向代理）

平台后端不强制 `/api` 前缀，直接拼接路径即可，例如：`GET {baseUrl}/photos/page`。

### 1.2 推荐的 HTTP 客户端能力

- 支持设置全局超时（建议 10~20s）
- 支持请求/响应拦截器（统一加鉴权、统一错误解析）
- 支持 gzip（服务端已启用压缩）

## 2. 登录态与权限（最关键）

### 2.1 认证流程（非 OAuth/JWT）

1) 登录：
- `POST /auth/login`（email + password）→ 返回 `{ token, user }`

2) 保存 token：
- iOS：Keychain
- Android：Keystore + EncryptedSharedPreferences（或 Jetpack Security）

3) 后续请求携带：
- `Authorization: Bearer <token>`

4) 启动校验：
- App 启动或回到前台时调用 `GET /auth/me`
- 若返回 401/`UNAUTHORIZED`：清理 token 并回到登录页

### 2.2 退出流程

- 调用 `POST /auth/logout`（带 Bearer token）销毁会话
- 清理本地 token 与用户缓存

### 2.3 角色差异

- `admin`：管理端能力（用户管理、评论审核、批量操作、站点设置、AI 等）
- `family`：上传、个人中心、数据分析等
- `guest`：仅公开浏览 + 游客互动

建议移动端在 UI 层根据 `user.role` 做菜单收敛，但务必以服务端权限校验为准。

## 3. 图片与媒体加载（强烈建议按此实现）

### 3.1 永远优先使用媒体代理端点

照片：
- `GET /media/photos/:id?variant=thumb|medium|original`

头像：
- `GET /media/avatars/:id`

原因：
- 服务端会处理远端图片源（对象存储、内网地址、带鉴权的 URL）并转发给客户端
- 可规避 Mixed Content、跨域、内网不可达等问题

### 3.2 分级加载策略（建议）

- 列表：只加载 `thumb`
- 详情首屏：加载 `medium`
- 放大/下载/保存原图：按需加载 `original`

### 3.3 缓存策略

- 使用系统/成熟图片库的磁盘缓存（按 URL 作为 cache key）
- 建议缓存分级：thumb/medium/original 分别缓存，避免原图污染列表缓存

## 4. 列表分页与离线缓存

### 4.1 推荐分页接口

- `GET /photos/page?limit=12&offset=0`
- 响应包含 `hasMore` 与 `nextOffset`

### 4.2 离线缓存建议

本地数据库缓存表（示意）：
- `photos(id primary key, title, ... , updatedAt, cachedAt)`
- `photo_details(id primary key, json, cachedAt)`

读取策略（建议）：
- 进入页面：先读缓存（快速出首屏）→ 再后台刷新
- 无网络：只读缓存，并提示离线状态

### 4.3 增量同步（v1 建议）

当后端提供 `since` 增量能力时：
- 客户端保存 `lastSyncUpdatedAt`
- 每次拉取 `GET /photos/page?since=<lastSyncUpdatedAt>&limit=50&offset=0`
- 将返回 items 按 `id` upsert 到本地库

## 5. 上传与 EXIF/GPS 处理

### 5.1 上传接口

- `POST /photos`（`multipart/form-data`）
  - 文件字段名：`photo`
  - 文本字段：`title`、`description`、`category`、`tags`（逗号分隔）、`exif`（JSON 字符串）

### 5.2 必须遵守的流程（平台约束）

- 选择文件后立即解析 EXIF（含 GPS）
- 若有 GPS：立即调用 `GET /geocode?lat&lng` 获取地点文本（locationHint）
- AI 填单逻辑中优先使用 GPS 逆地理结果（仅在无 GPS 时才允许 AI 推断地点）

说明：这是平台的稳定策略，能显著减少地点误判。

## 6. 游客互动与验证码

### 6.1 游客点赞

- `POST /photos/:id/like` body：`{ guestId }`
- `guestId` 建议为设备级随机 UUID，首次生成后持久化

### 6.2 游客评论（带验证码）

1) 获取验证码：
- `GET /auth/captcha` → 默认返回 `{ svg, token }`
- 若原生端不便渲染 SVG，可请求：`GET /auth/captcha?format=base64` → 返回 `{ pngBase64, mimeType, token }`

2) 提交评论：
- `POST /photos/:id/comment` body：

```json
{
  "content": "评论内容",
  "guestId": "device-uuid",
  "nickname": "昵称",
  "email": "xx@example.com",
  "captcha": "abcd",
  "captchaToken": "token-from-captcha"
}
```

3) 注意事项：
- 验证码 5 分钟过期；失败应提示用户重新获取
- 游客评论通常进入待审核状态，详情页可能不会立即展示

## 7. 错误处理与重试建议

### 7.1 统一错误解析

- 非 2xx：解析 `{ code, message, requestId }`
- 对于 401：统一触发登出/回到登录页（避免无限重试）

### 7.2 重试策略（建议）

- GET：指数退避 + 抖动（最多 2~3 次）
- POST（非幂等）：默认不自动重试；可进入“待发送队列”，由用户显式重试或在网络恢复时重试

### 7.3 用户提示

建议区分：
- 网络不可用（本地判断）→ “网络不可用，请检查连接”
- 平台业务错误（有 code/message）→ 展示 message（必要时追加 requestId 入口）

## 8. 监控与验收指标落地建议

为支持“API 成功率 99.9% / 崩溃率 <0.1%”，建议在 App 内实现：

- 请求埋点：成功/失败、耗时、HTTP 状态码、平台 `code`、`requestId` 采样
- 崩溃上报：Crash 统计与版本维度分析
- 可观测性：关键页面启动耗时、图片加载耗时、首屏渲染耗时

## 9. 参考文档

- 接口清单与字段：[API_REFERENCE.md](file:///home/zl/work/workspaces/phowson/doc/API_REFERENCE.md)
