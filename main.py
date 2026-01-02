import json
import random
import asyncio
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. 加载题目到内存
try:
    with open("questions.json", "r", encoding="utf-8") as f:
        QUESTIONS = json.load(f)
except FileNotFoundError:
    QUESTIONS = [{"id": 0, "content": "题目文件未找到，请检查后端配置"}]

# 2. 管理连接
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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # 接收客户端消息
            data = await websocket.receive_json()
            user = data.get("user", "匿名玩家")
            
            # 处理：掷骰子
            if data.get("action") == "roll":
                point = random.randint(1, 6)
                await manager.broadcast({
                    "type": "game",
                    "user": user,
                    "msg": f"🎲 掷出了 {point} 点！",
                    "val": point
                })
            
            # 处理：抽题
            elif data.get("action") == "draw":
                q = random.choice(QUESTIONS)
                await manager.broadcast({
                    "type": "question",
                    "user": "系统",
                    "msg": f"🔥 抽到了题目：{q['content']}",
                    "content": q['content']
                })

            # 处理：聊天
            elif data.get("action") == "chat":
                await manager.broadcast({
                    "type": "chat",
                    "user": user,
                    "msg": data.get("msg")
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)


import os
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
# ... 保持之前的逻辑不变 ...

if __name__ == "__main__":
    # Koyeb 会自动注入 PORT 环境变量
    port = int(os.environ.get("PORT", 8000))
    # 必须使用 0.0.0.0 才能让外部访问
    uvicorn.run(app, host="0.0.0.0", port=port)