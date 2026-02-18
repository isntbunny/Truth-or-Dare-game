# 真心话大冒险在线游玩

这个项目现在支持两种模式：

1. **纯前端离线模式（推荐给 Netlify 免费部署）**：不需要后端，房间/账号存 localStorage。
2. **前后端联机模式**：启动 `FastAPI` 后自动切换成在线 API + WebSocket。

## 一、最省钱方案（免费）

你只部署 `frontend/` 到 Netlify 就可以玩（离线模式）。

- 样式会正常加载（已改成相对路径 `./styles.css`）
- 登录/注册可用（保存在浏览器）
- 创建房间可用（保存在浏览器）
- 游戏页聊天/骰子/抽题可用（离线）

> 注意：离线模式的数据只在你的浏览器里，不会跨设备同步。

## 二、本地启动后端（可选）

```bash
pip install -r requirements.txt
python3 main.py
```

然后访问：`http://127.0.0.1:8000`

## 三、Netlify 部署步骤

1. GitHub 仓库连接到 Netlify。
2. Build command 留空。
3. Publish directory 设为：`frontend`
4. 部署后访问：`https://你的站点.netlify.app/index.html`

## 四、推送到 GitHub

```bash
git remote set-url origin https://github.com/isntbunny/Truth-or-Dare-game.git
git push -u origin work
```

如果要推到 main：

```bash
git push -u origin work:main
```
