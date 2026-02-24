# 移动端 SDK 调用约定（Phowson）

本文档用于指导 iOS/Android 的网络层/数据层实现，确保两端行为一致，便于排障与验收。

## 1. 基本约定

- Base URL：`{baseUrl}` + `/{path}`（无固定 `/api` 前缀）
- 超时：建议 10~20 秒（上传可更长）
- 编码：UTF-8
- 压缩：客户端应启用 gzip；服务端会返回压缩响应

## 2. 认证与请求头

### 2.1 首选鉴权（生产必用）

- `Authorization: Bearer <token>`

token 来源：`POST /auth/login` 返回的 `token`，必须存入系统安全存储。

### 2.2 调试兼容头（生产禁用）

仅用于开发/联调兜底（不建议 App 上线使用）：

- `x-user-id`
- `x-user-name`
- `x-user-role`（admin/family）
- `x-user-avatar`

## 3. 统一错误模型

### 3.1 平台错误 body

非 2xx：

```json
{ "code": "SOME_CODE", "message": "中文提示", "requestId": "req_xxx" }
```

### 3.2 SDK 内部错误分类（建议）

- `NetworkUnavailable`：无网络/系统级失败
- `Timeout`：超时
- `HttpError`：HTTP 非 2xx（包含 status）
- `PlatformError`：解析出 `{ code, message, requestId }`
- `DecodeError`：响应格式不符合预期

### 3.3 401 处理（强约束）

当满足任一条件时，视为登录失效：
- HTTP 401
- `code == "UNAUTHORIZED"`

处理：
- 清理本地 token
- 清理用户缓存
- 跳转登录，并携带 returnUrl（若 App 有路由体系）

## 4. 重试、限流与熔断

### 4.1 重试策略（建议默认）

- GET：指数退避 + 抖动，最多 2 次重试
- POST/PATCH/DELETE：
  - 默认不自动重试
  - 可进入“任务队列”，由用户显式重试或网络恢复后重试

### 4.2 并发与限流（建议）

- 同一 host 并发请求数限制（例如 6~8）
- 同一资源（同一 photoId）的详情请求去重（只保留 1 个在飞请求）

### 4.3 熔断（建议）

- 同一接口连续失败 N 次（例如 5 次）→ 进入短时熔断（例如 30 秒）
- 熔断期间读缓存 + 给出降级提示

## 5. 缓存键与数据一致性

### 5.1 缓存键（建议）

- 列表页：`photos_page:limit=<L>:offset=<O>:filters=<...>`
- 详情页：`photo_detail:<id>`
- 媒体：直接使用 URL（包含 `variant`）作为缓存键

### 5.2 更新策略（建议）

当详情页有写操作（点赞/评论/编辑）：
- 本地立即更新 UI（乐观更新可选）
- 同步刷新详情 `GET /photos/:id` 并写回缓存

## 6. 分页与增量同步

### 6.1 Offset 分页（当前已存在）

接口：
- `GET /photos/page?limit=<L>&offset=<O>`

返回：
- `items / total / hasMore / nextOffset`

### 6.2 增量同步（规划对接）

当接口支持 `since`（按 `updatedAt`）时：
- 客户端保存 `lastSyncUpdatedAt`
- 拉取：`GET /photos/page?since=<lastSyncUpdatedAt>&limit=50&offset=0`
- upsert：按 `id` 覆盖本地记录
- 更新游标：`lastSyncUpdatedAt = max(items.updatedAt)`

## 7. 上传约定

### 7.1 照片上传

- `POST /photos`（`multipart/form-data`）
  - 文件字段名：`photo`
  - 文本字段：
    - `title`（必填）
    - `description`（必填）
    - `category`（必填）
    - `tags`（逗号分隔，允许为空字符串）
    - `exif`（JSON 字符串，建议包含拍摄时间/GPS/相机参数）

### 7.2 头像上传

- `POST /users/avatar`（`multipart/form-data`）
  - 文件字段名：`avatar`

## 8. 游客约定（guestId 与验证码）

### 8.1 guestId

- 生成：首次启动生成随机 UUID（v4）并持久化
- 使用场景：游客点赞、游客评论

### 8.2 验证码

- 获取：`GET /auth/captcha`
- 原生端若不便渲染 SVG：使用 `GET /auth/captcha?format=base64` 获取 PNG base64
- 提交游客评论时必须带：`captcha` + `captchaToken`
- 过期：5 分钟；失败应重新获取

## 9. 参考

- 接口清单：[API_REFERENCE.md](file:///home/zl/work/workspaces/phowson/doc/API_REFERENCE.md)
- 集成细节：[APP_INTEGRATION_GUIDE.md](file:///home/zl/work/workspaces/phowson/doc/APP_INTEGRATION_GUIDE.md)
