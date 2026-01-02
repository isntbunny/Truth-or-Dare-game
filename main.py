import json
import random
import asyncio
import os
import uvicorn
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# 第一步：先创建 app 实例
app = FastAPI()

# 第二步：配置跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 第三步：加载题目
try:
    with open("questions.json", "r", encoding="utf-8") as f:
        QUESTIONS = json.load(f)
except FileNotFoundError:
    QUESTIONS = [{"id": 0, "content": "题目文件未找到，请检查后端配置"}]

# 第四步：管理连接
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

# 第五步：定义路由
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            user = data.get("user", "匿名玩家")
            
            if data.get("action") == "roll":
                point = random.randint(1, 6)
                await manager.broadcast({
                    "type": "game",
                    "user": user,
                    "msg": f"🎲 掷出了 {point} 点！",
                    "val": point
                })
            
            elif data.get("action") == "draw":
                q = random.choice(QUESTIONS)
                await manager.broadcast({
                    "type": "question",
                    "user": "系统",
                    "msg": f"🔥 抽到了题目：{q['content']}",
                    "content": q['content']
                })

            elif data.get("action") == "chat":
                await manager.broadcast({
                    "type": "chat",
                    "user": user,
                    "msg": data.get("msg")
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# 第六步：最后放启动逻辑（必须放在最底部）
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)