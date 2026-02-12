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
- 后端处理用户头像请求 (`/media/avatars/:id`) 时，若用户未设置头像，必须返回默认头像（如重定向至 ui-avatars.com），禁止直接返回 404。
- 前端全屏遮罩或浮层组件（如 Mobile Menu, Modal）必须使用 `createPortal` 渲染至 `document.body` 并设置极高的 z-index (如 z-[9999])，以防止被局部层叠上下文（Stacking Context）遮挡。
- 移动端筛选栏布局：多条件筛选在移动端应保持单行排列（flex-nowrap + overflow-x-auto），并根据需要使用 flex-1 均分宽度，避免换行占用过多纵向空间。
- 移动端侧边栏操作按钮（如发布作品）应参考 PC 端样式，使用渐变背景与圆角设计，增强视觉显著性。
- 移动端Admin/个人页面标题规范：在移动端视图中，应隐藏页面级的大标题（h1/h2）与副标题，以节省屏幕空间。
- 移动端分页交互规范：移动端分页应简化为仅显示“上一页/下一页”大按钮，隐藏具体页码列表与跳转输入框，以适应触控操作。
- 移动端筛选弹窗布局规范：移动端筛选弹窗（Bottom Sheet）内的选项列表可根据内容密度采用双列网格布局（Grid），以提高空间利用率。
- 登录跳转规范：登录成功后必须跳转回登录前的页面（通过 URL 参数 `returnUrl` 传递），禁止默认跳转到后台管理页面。
