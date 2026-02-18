import asyncio
import hashlib
import json
import os
import random
import secrets
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DB_PATH = BASE_DIR / "game.db"

app = FastAPI(title="Truth or Dare Online")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    with open(BASE_DIR / "questions.json", "r", encoding="utf-8") as f:
        QUESTIONS = json.load(f)
except FileNotFoundError:
    QUESTIONS = [{"id": 0, "content": "题目文件未找到，请检查后端配置"}]


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM rooms")
    if cursor.fetchone()[0] == 0:
        demo_rooms = [
            ("欢乐局", "轻松聊天 + 真心话", "system"),
            ("刺激大冒险", "适合勇士玩家", "system"),
            ("深夜坦白局", "走心真心话专场", "system"),
        ]
        cursor.executemany(
            "INSERT INTO rooms(name, description, created_by) VALUES (?, ?, ?)",
            demo_rooms,
        )
        conn.commit()

    conn.close()


def hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    pwd_hash = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"{salt}${pwd_hash}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return hash_password(password, salt) == stored


TOKENS: Dict[str, str] = {}


def get_username_by_token(token: str) -> Optional[str]:
    return TOKENS.get(token)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=20)
    password: str = Field(min_length=4, max_length=64)
    email: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateRoomRequest(BaseModel):
    name: str = Field(min_length=2, max_length=30)
    description: str = Field(default="", max_length=120)


@app.on_event("startup")
async def startup_event() -> None:
    init_db()


@app.post("/api/register")
def register(payload: RegisterRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users(username, password_hash, email) VALUES (?, ?, ?)",
            (payload.username.strip(), hash_password(payload.password), payload.email),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="用户名已存在")

    conn.close()
    return {"message": "注册成功，请登录"}


@app.post("/api/login")
def login(payload: LoginRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT username, password_hash FROM users WHERE username = ?",
        (payload.username.strip(),),
    )
    row = cursor.fetchone()
    conn.close()

    if not row or not verify_password(payload.password, row[1]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = secrets.token_urlsafe(32)
    TOKENS[token] = row[0]
    return {"token": token, "username": row[0]}


@app.get("/api/me")
def me(token: str = Query(...)):
    username = get_username_by_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="无效登录状态")
    return {"username": username}


@app.get("/api/rooms")
def list_rooms(search: str = ""):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if search.strip():
        cursor.execute(
            """
            SELECT id, name, description, created_by
            FROM rooms
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY id DESC
            """,
            (f"%{search.strip()}%", f"%{search.strip()}%"),
        )
    else:
        cursor.execute(
            "SELECT id, name, description, created_by FROM rooms ORDER BY id DESC"
        )

    rows = cursor.fetchall()
    conn.close()
    return {
        "rooms": [
            {
                "id": row[0],
                "name": row[1],
                "description": row[2] or "",
                "created_by": row[3],
            }
            for row in rows
        ]
    }


@app.post("/api/rooms")
def create_room(payload: CreateRoomRequest, token: str = Query(...)):
    username = get_username_by_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="请先登录")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO rooms(name, description, created_by) VALUES (?, ?, ?)",
            (payload.name.strip(), payload.description.strip(), username),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="房间名已存在")

    room_id = cursor.lastrowid
    conn.close()
    return {"id": room_id, "name": payload.name.strip()}


class RoomConnectionManager:
    def __init__(self):
        self.room_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, room_id: int, websocket: WebSocket):
        await websocket.accept()
        self.room_connections.setdefault(room_id, []).append(websocket)

    def disconnect(self, room_id: int, websocket: WebSocket):
        room = self.room_connections.get(room_id, [])
        if websocket in room:
            room.remove(websocket)
        if not room and room_id in self.room_connections:
            del self.room_connections[room_id]

    async def broadcast(self, room_id: int, message: dict):
        for connection in self.room_connections.get(room_id, []):
            await connection.send_json(message)


room_manager = RoomConnectionManager()


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int, token: str):
    username = get_username_by_token(token)
    if not username:
        await websocket.close(code=1008)
        return

    await room_manager.connect(room_id, websocket)
    await room_manager.broadcast(
        room_id,
        {"type": "system", "msg": f"{username} 进入了房间 🎉"},
    )

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "roll":
                point = random.randint(1, 6)
                await room_manager.broadcast(
                    room_id,
                    {
                        "type": "game",
                        "user": username,
                        "msg": f"🎲 掷出了 {point} 点！",
                        "val": point,
                    },
                )

            elif action == "draw":
                q = random.choice(QUESTIONS)
                await room_manager.broadcast(
                    room_id,
                    {
                        "type": "question",
                        "user": "系统",
                        "msg": f"🔥 抽到了题目：{q['content']}",
                        "content": q["content"],
                    },
                )

            elif action == "chat":
                msg = data.get("msg", "").strip()
                if msg:
                    await room_manager.broadcast(
                        room_id,
                        {"type": "chat", "user": username, "msg": msg},
                    )

    except WebSocketDisconnect:
        room_manager.disconnect(room_id, websocket)
        await room_manager.broadcast(
            room_id,
            {"type": "system", "msg": f"{username} 离开了房间"},
        )


app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")


@app.get("/")
def home():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/game")
def game_page():
    return FileResponse(FRONTEND_DIR / "game.html")


@app.get("/index.html")
def home_compat():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/game.html")
def game_page_compat():
    return FileResponse(FRONTEND_DIR / "game.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
