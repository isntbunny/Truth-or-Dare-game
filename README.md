# 真心话大冒险在线游玩（FastAPI + 前后端分离）

## 本地运行

```bash
pip install -r requirements.txt
python3 main.py
```

默认启动在：`http://127.0.0.1:8000`

---

## 功能说明

- 大厅页：`/`（也兼容 `/index.html`）
  - 顶部登录/注册
  - 房间搜索
  - 所有房间列表
  - 创建房间（需登录）
- 游戏页：`/game?roomId=...&roomName=...`（也兼容 `/game.html?...`）
  - 掷骰子、抽题目、聊天
  - WebSocket 实时同步

---

## 如何导入到 GitHub 仓库（上传代码）

> 下面是最常见的“本地项目推送到你的 GitHub 仓库”的方法。

### 1) 在 GitHub 新建仓库

- 打开 GitHub，点击 `New repository`
- 填写仓库名（例如：`Truth-or-Dare-game`）
- 创建后会得到仓库地址，例如：
  - HTTPS：`https://github.com/<你的用户名>/<仓库名>.git`
  - SSH：`git@github.com:<你的用户名>/<仓库名>.git`

### 2) 在项目目录设置远程仓库

```bash
git remote -v
```

如果还没有 `origin`：

```bash
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
```

如果已有 `origin` 但地址不对：

```bash
git remote set-url origin https://github.com/<你的用户名>/<仓库名>.git
```

### 3) 推送当前分支

```bash
git push -u origin $(git branch --show-current)
```

### 4) 后续更新

改完代码后：

```bash
git add .
git commit -m "你的提交说明"
git push
```

---

## 常见问题

- **推送失败 403**：通常是 GitHub 账号权限或 token 问题。
- **HTTPS 频繁要密码**：建议使用 GitHub PAT（Personal Access Token）或改用 SSH key。
- **页面打不开**：确认服务在运行：`python3 main.py`，并访问 `http://127.0.0.1:8000`。
