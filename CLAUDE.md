# 规则库

- AI 环境变量模板需支持通用 OpenAI 兼容配置：可使用 `AI_PROVIDER=openai_compatible`，并通过 `AI_API_KEY/AI_BASE_URL/AI_MODEL` 或 `AI_COMPATIBLE_API_KEY/AI_COMPATIBLE_BASE_URL/AI_COMPATIBLE_MODEL` 进行配置，优先选择已设置的值。 
- 使用 React Query 的 `enabled` 选项时，必须处理 data 为 undefined 的情况（此时 isLoading 可能为 false），避免直接访问属性导致页面崩溃。
- 每次前端页面开发/改动后，必须先运行 `pnpm typecheck` 与 `pnpm build`，确保无运行时白屏问题再交付。
- 在 Vite 开发环境中，必须配置代理以转发 `/media` 等后端静态资源请求，防止本地上传的图片无法显示。
- 前端加载图片资源时，应优先使用 `/media/photos/:id` 代理路径，避免直接使用数据库中的绝对 URL (如 MinIO 地址)，以防止 Mixed Content 或内网无法访问的问题。
- 照片上传流程必须在选择文件时立即解析 GPS 并逆地理编码，不可推迟到发布时。
- AI 填单逻辑必须优先使用 GPS 逆地理编码结果，仅在无 GPS 时才允许 AI 推断地点。
- 前端 ModalContext 的 alert 方法仅接受字符串参数，禁止传入对象，以防止白屏崩溃。
- Admin后台页面标题需统一风格：使用 text-3xl font-extrabold tracking-tight 并搭配 w-8 h-8 text-primary 图标，与个人菜单保持一致。
- 编辑页面（如 Upload/Edit）保存后应使用 navigate(-1) 返回上一页，避免强制跳转到特定页面中断用户流程。
