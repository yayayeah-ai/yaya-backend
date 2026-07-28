# 雅雅工作台 - 后端部署指南

## 为什么需要部署后端？

手机上的 App 是纯前端的，无法在 App 没打开时主动推送通知。后端服务器负责：
- 每天 21:00 推送记账提醒
- 每天 8:00 检查生日并推送提醒（提前 7 天 + 当天）

部署到云端后，**不需要电脑开机**，手机随时能收到推送。

## 部署步骤（约 5 分钟）

### 第 1 步：创建 GitHub 仓库

1. 打开 https://github.com/new
2. Repository name 填 `yaya-backend`
3. 选择 **Public**
4. 点击 **Create repository**

### 第 2 步：推送代码到 GitHub

在电脑终端执行（替换 `你的用户名` 为你的 GitHub 用户名）：

```bash
cd C:\Users\hansadmin\WorkBuddy\2026-07-27-16-43-16\yaya-backend
git remote add origin https://github.com/你的用户名/yaya-backend.git
git branch -M main
git push -u origin main
```

### 第 3 步：部署到 Render（免费）

1. 打开 https://render.com → 用 GitHub 账号登录
2. 点击 **New +** → **Web Service**
3. 选择刚才创建的 `yaya-backend` 仓库
4. Render 会自动检测 `render.yaml` 配置
5. 点击 **Create Web Service**
6. 等待 1-2 分钟构建完成
7. 部署成功后，复制页面顶部显示的 URL（如 `https://yaya-backend-xxxx.onrender.com`）

### 第 4 步：在 App 中配置

1. 手机打开雅雅工作台 App
2. 进入 **设置** 页面
3. 在「消息推送」区域的「服务器地址」填入上一步的 URL
4. 打开「开启推送提醒」开关
5. 允许通知权限
6. 点击「测试推送」验证是否正常

## 注意事项

- Render 免费版会在 15 分钟无访问后休眠，但每天 8:00 和 21:00 的定时任务会自动唤醒服务器
- iOS 需要将 App「添加到主屏幕」后才能接收推送通知
- 推送通知需要 iOS 16.4+ 或 Android 任意版本
- 如果更换设备，只需在新设备上重新开启推送即可
