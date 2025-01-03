# Task Manager

一个简洁优雅的在线任务管理应用，使用 Cloudflare Workers 和 D1 数据库构建。支持任务创建、编辑、删除，自动同步，响应式设计等功能。

[在线预览](https://task.yvyan.top)

## 功能特点

- 📝 创建、编辑、删除任务
- ⏰ 设置任务截止时间
- ✅ 标记任务完成状态
- 🗂️ 按日期智能分组显示
- 🔍 多种筛选方式（今天/本周/全部）
- 🔄 自动同步，离线支持
- 📱 响应式设计，支持移动端
- 🧹 自动清理一个月前的已完成任务

## 技术栈

- 前端：原生 JavaScript + CSS
- 后端：Cloudflare Workers
- 数据库：Cloudflare D1
- 部署：Cloudflare Pages

## 部署步骤

### 1. 准备工作

1. 注册 [Cloudflare](https://dash.cloudflare.com) 账号
2. 在 GitHub 上 fork 本项目或创建新仓库并上传代码

### 2. 创建 D1 数据库

1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧菜单中的 `Workers & Pages`
3. 选择顶部的 `D1` 选项卡
4. 点击 `Create database` 按钮
5. 输入数据库名称（如：task-manager），点击 `Create database` 创建
6. 记下数据库 ID，将在后续步骤中使用

### 3. 部署 Worker

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com) 中点击 `Workers & Pages`
2. 点击 `Create application` 按钮
3. 选择 `Create Worker` 选项
4. 输入 Worker 名称（如：task-api）
5. 点击 `Deploy` 按钮
6. 部署完成后，点击 `Quick edit` 按钮
7. 将 `worker.js` 的内容复制到编辑器中
8. 点击 `Save and deploy` 保存部署

### 4. 绑定数据库

1. 在 Worker 详情页面，点击 `Settings` 选项卡
2. 找到 `D1 database bindings` 部分
3. 点击 `Add binding` 按钮
4. 设置 Variable name 为 `DB`
5. 选择之前创建的数据库
6. 点击 `Save and deploy`

### 5. 部署前端

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com) 中点击 `Workers & Pages`
2. 点击 `Create application` 按钮
3. 选择 `Pages` 选项，点击 `Connect to Git`
4. 选择你的 GitHub 仓库
5. 配置构建设置：
   - 构建命令：留空
   - 输出目录：`/`
   - 环境变量（可选）：根据需要设置
6. 点击 `Save and Deploy` 开始部署

### 6. 更新 API 地址

1. 在 `app.js` 中找到 `API_BASE_URL` 常量
2. 将其值更新为你的 Worker URL：

## 许可证

MIT License

## 作者

[Yvyan](https://github.com/yvyan)

## 致谢

- Cloudflare Workers 和 D1 提供的强大基础设施
- 代码由Cursor编写，仍存在少量bug未解决，欢迎大家提出问题和建议
- 所有贡献者和使用者