# 知库云快速搜索

知库云快速搜索是一个面向团队内网的文件检索页面。用户使用自己的知库云
账号登录后，可以按文件名搜索文档，并按最后修改时间从新到旧查看结果。

本文档采用 Step by Step 方式，按顺序执行即可完成本地开发和生产部署。

> 安全要求：禁止将真实账号、密码、Cookie、Token 写入源码、环境文件、
> 日志、截图或 Git 提交。用户密码只用于本次登录请求，不会保存在项目文件
> 或浏览器本地存储中。

## 功能概览

- 按文件名搜索全部文档。
- 支持结果内二次筛选。
- 支持文件、文件夹及常用文件格式筛选。
- 搜索结果按最后修改时间倒序排列。
- 每页显示 50 条结果，支持翻页和重新加载。
- 点击结果可跳转到知库云对应位置。
- 浏览器仅保存安全会话 Cookie。
- 后端不保存用户账号和密码。

## 支持平台

- Windows 10/11 x64。
- Windows 11 ARM64。
- macOS Intel x64。
- macOS Apple Silicon ARM64，包括 M1、M2、M3、M4。
- Linux x64/ARM64。

每台电脑必须单独安装依赖。不要在不同系统或 CPU 架构之间复制
`node_modules`。

## 本地运行

### Step 1：安装运行环境

安装以下软件：

- Node.js 20 或更高版本。
- npm 10 或更高版本。
- Git。

打开终端并检查版本：

```bash
node --version
npm --version
git --version
```

成功标志：

```text
Node.js 版本不低于 v20
npm 版本不低于 10
Git 可以正常输出版本号
```

### Step 2：获取项目

首次使用时执行：

```bash
git clone https://github.com/fengye7500/zhikuyun.git
cd zhikuyun
```

项目已经存在时，只需进入项目目录：

macOS、Linux：

```bash
cd /项目实际路径/zhikuyun
```

Windows PowerShell：

```powershell
Set-Location "C:\项目实际路径\zhikuyun"
```

确认当前目录正确：

macOS、Linux：

```bash
pwd
ls
```

Windows PowerShell：

```powershell
Get-Location
Get-ChildItem
```

目录中应能看到 `package.json`、`src` 和 `server`。

### Step 3：安装项目依赖

在项目根目录执行：

```bash
npm ci
```

首次开发且锁文件需要更新时，可以执行：

```bash
npm install
```

正常情况下优先使用 `npm ci`，确保所有电脑安装相同版本的依赖。

成功标志：命令执行结束，没有出现 `npm error`。

如果启动时出现以下错误：

```text
concurrently: command not found
```

说明依赖不完整。重新执行：

```bash
npm ci
```

### Step 4：配置环境变量

本地开发可以直接使用程序内置默认值，无需创建 `.env`：

```dotenv
PORT=3000
TRUST_PROXY=0
SESSION_TTL_MINUTES=480
ZHIKUYUN_BASE_URL=https://pan.winhong.com
ZHIKUYUN_LOGIN_PATH=/netdisk-api/usercenter/login
ZHIKUYUN_USERINFO_PATH=/netdisk-api/usercenter/userinfo
ZHIKUYUN_SEARCH_PATH=/netdisk-api/netdisk/objectList
ZHIKUYUN_WEB_URL=https://pan.winhong.com/netdisk-ui/
```

需要修改默认值时，在启动服务前向当前终端设置环境变量。

macOS、Linux 示例：

```bash
export PORT=3000
export TRUST_PROXY=0
export SESSION_TTL_MINUTES=480
```

Windows PowerShell 示例：

```powershell
$env:PORT = "3000"
$env:TRUST_PROXY = "0"
$env:SESSION_TTL_MINUTES = "480"
```

环境变量仅对当前终端窗口有效。不要在命令中写入账号、密码、Cookie 或
Token。

### Step 5：启动开发服务

在项目根目录执行：

```bash
npm run dev
```

该命令会同时启动：

- 前端服务：`http://localhost:5173`
- 后端服务：`http://localhost:3000`

终端出现以下内容表示启动成功：

```text
Local: http://localhost:5173/
知库云搜索服务已启动：http://localhost:3000
```

保持该终端窗口运行，不要关闭。

### Step 6：打开页面

在浏览器访问：

```text
http://localhost:5173
```

同一局域网中的其他设备可以使用启动日志中的 `Network` 地址访问，例如：

```text
http://192.168.0.23:5173
```

局域网访问失败时，检查电脑防火墙是否允许 Node.js 访问 5173 端口。

### Step 7：登录并搜索

1. 输入自己的知库云账号和密码。
2. 点击“安全登录”。
3. 在主搜索框输入文件名关键字。
4. 按需选择“全部”“文件”或“文件夹”。
5. 选择“文件”后，可以继续筛选文件格式。
6. 使用“结果内筛选”缩小当前结果范围。
7. 点击结果卡片，打开知库云中的对应位置。

主搜索英文不区分大小写，结果内筛选英文区分大小写。

### Step 8：停止开发服务

返回运行 `npm run dev` 的终端，按：

```text
Ctrl+C
```

前端和后端服务会同时停止。

## 运行检查

### Step 1：执行类型检查

```bash
npm run typecheck
```

### Step 2：执行代码规范检查

```bash
npm run lint
```

### Step 3：执行单元测试

```bash
npm test
```

单元测试最大超时时间为 60 秒。

### Step 4：执行生产构建

```bash
npm run build
```

构建成功后，生产文件位于 `dist` 目录。

### Step 5：检查依赖安全

```bash
npm audit --audit-level=high
```

不要直接执行 `npm audit fix --force`。该命令可能升级核心依赖并引入不兼容
变更，应先评估影响并完成回归测试。

## 生产部署

以下步骤适用于 Linux 服务器。

### Step 1：准备部署目录

```bash
cd /opt
git clone https://github.com/fengye7500/zhikuyun.git
cd zhikuyun
```

如果项目已经存在：

```bash
cd /opt/zhikuyun
git pull origin main
```

### Step 2：安装依赖

```bash
npm ci
```

### Step 3：创建生产环境配置

创建 `/opt/zhikuyun/.env`，内容如下：

```dotenv
PORT=3000
TRUST_PROXY=1
SESSION_TTL_MINUTES=480
ZHIKUYUN_BASE_URL=https://pan.winhong.com
ZHIKUYUN_LOGIN_PATH=/netdisk-api/usercenter/login
ZHIKUYUN_USERINFO_PATH=/netdisk-api/usercenter/userinfo
ZHIKUYUN_SEARCH_PATH=/netdisk-api/netdisk/objectList
ZHIKUYUN_WEB_URL=https://pan.winhong.com/netdisk-ui/
```

该文件只能保存服务配置，禁止保存用户账号、密码、Cookie 或 Token。

### Step 4：执行质量检查

依次执行：

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

所有命令成功后再继续部署。

### Step 5：验证生产服务

导入环境变量并启动：

```bash
set -a
source .env
set +a
NODE_ENV=production npm start
```

打开另一个终端检查：

```bash
curl -I http://127.0.0.1:3000/
```

返回 HTTP 200 后，在服务终端按 `Ctrl+C` 停止前台验证。

### Step 6：配置 systemd

创建 `/etc/systemd/system/zhikuyun.service`：

```ini
[Unit]
Description=Zhikuyun File Search
After=network.target

[Service]
Type=simple
User=zhikuyun
WorkingDirectory=/opt/zhikuyun
EnvironmentFile=/opt/zhikuyun/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

加载并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zhikuyun
sudo systemctl status zhikuyun
```

查看日志：

```bash
sudo journalctl -u zhikuyun -f
```

日志中不应出现账号、密码、Cookie 或 Token。

### Step 7：配置 Nginx HTTPS

以下示例域名为 `zhikuyun.example.com`：

```nginx
server {
    listen 80;
    server_name zhikuyun.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name zhikuyun.example.com;

    ssl_certificate     /etc/nginx/certs/zhikuyun.crt;
    ssl_certificate_key /etc/nginx/certs/zhikuyun.key;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

检查并重新加载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

最终通过 HTTPS 访问：

```text
https://zhikuyun.example.com
```

生产模式使用安全 Cookie，最终用户必须通过 HTTPS 访问。

## 版本更新

### Step 1：安排维护窗口

更新会重启服务，应提前通知用户并确认当前没有重要操作。

### Step 2：拉取新版本

```bash
cd /opt/zhikuyun
git pull origin main
```

### Step 3：重新安装依赖

```bash
npm ci
```

### Step 4：执行检查与构建

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

### Step 5：重启并验证

```bash
sudo systemctl restart zhikuyun
sudo systemctl status zhikuyun
curl -I http://127.0.0.1:3000/
```

## 常见问题

### 无法打开 `http://localhost:5173`

按顺序检查：

1. 确认运行 `npm run dev` 的终端没有关闭。
2. 确认终端中出现 Vite 的 `Local` 地址。
3. 执行 `npm ci`，修复不完整的依赖。
4. 检查 5173 端口是否被其他程序占用。
5. 确认项目根目录存在 `index.html`。

macOS、Linux 检查端口：

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Windows PowerShell 检查端口：

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen
```

### 页面能打开，但无法登录或搜索

按顺序检查：

1. 确认当前电脑可以访问 `https://pan.winhong.com`。
2. 确认后端终端已显示 3000 端口启动成功。
3. 确认账号和密码可以在知库云官网正常登录。
4. 检查代理、防火墙和 DNS 设置。
5. 查看后端日志，但不要输出或传播认证信息。

### 3000 或 5173 端口被占用

临时调整后端端口时，还需要同步修改 `vite.config.ts` 中的代理端口。

调整前端端口：

```bash
npm run dev:web -- --port 5174
```

浏览器随后访问：

```text
http://localhost:5174
```

## 技术架构

```text
浏览器
  │
  ├── Vue 3 + TypeScript + Vite
  │
  └── /api 请求
        │
        ▼
Express + TypeScript
  │
  ├── 内存会话 SessionStore
  ├── 登录和搜索请求代理
  └── 知库云接口适配层
        │
        ▼
https://pan.winhong.com
```

生产构建后，Express 同时提供前端静态文件和 `/api` 接口，只需对外暴露一个
后端端口。
