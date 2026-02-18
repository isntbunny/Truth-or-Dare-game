const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const roomName = params.get('roomName') || '未知房间';
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');
const API_BASE = localStorage.getItem('api_base') || '';

if (!token || !username) {
  alert('请先登录再进入房间');
  window.location.href = './index.html';
}
if (!roomId) {
  alert('房间不存在');
  window.location.href = './index.html';
}

document.getElementById('roomTitle').textContent = `房间：${decodeURIComponent(roomName)}`;

const logEl = document.getElementById('log');
const messageInput = document.getElementById('messageInput');
const QUESTIONS = [
  '你做过最尴尬的事是什么？',
  '给左边玩家说一句夸奖的话。',
  '最近一次心动是什么时候？',
  '模仿一个你最喜欢的角色 10 秒。',
  '你最想去哪里旅行？',
];

function addLog(msg, user = '') {
  const item = document.createElement('div');
  item.className = 'log-item';
  item.textContent = user ? `${user}: ${msg}` : msg;
  logEl.appendChild(item);
  logEl.scrollTop = logEl.scrollHeight;
}

function setupLocalMode() {
  addLog('当前为纯前端离线模式：同一浏览器标签页可用。');
  const key = `tod_room_chat_${roomId}`;
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  history.forEach((row) => addLog(row.msg, row.user));

  const post = (payload) => {
    let msg = '';
    if (payload.action === 'roll') msg = `🎲 掷出了 ${Math.floor(Math.random() * 6) + 1} 点！`;
    if (payload.action === 'draw') msg = `🔥 抽到了题目：${QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]}`;
    if (payload.action === 'chat') msg = payload.msg;
    if (!msg) return;
    const row = { user: username, msg };
    history.push(row);
    localStorage.setItem(key, JSON.stringify(history.slice(-120)));
    addLog(row.msg, row.user);
  };

  document.getElementById('rollBtn').onclick = () => post({ action: 'roll' });
  document.getElementById('drawBtn').onclick = () => post({ action: 'draw' });
  document.getElementById('sendBtn').onclick = () => {
    const msg = messageInput.value.trim();
    if (!msg) return;
    post({ action: 'chat', msg });
    messageInput.value = '';
  };
}

function setupBackendMode() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = API_BASE ? new URL(API_BASE).host : window.location.host;
  const ws = new WebSocket(`${protocol}://${host}/ws/${roomId}?token=${encodeURIComponent(token)}`);

  ws.onopen = () => addLog('已连接房间，开始游戏吧！');
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    addLog(data.msg, data.type === 'system' ? '' : data.user);
  };
  ws.onclose = () => addLog('连接已断开，已切换离线模式。');

  const safeSend = (payload) => {
    if (ws.readyState !== WebSocket.OPEN) return alert('连接尚未建立，请稍后');
    ws.send(JSON.stringify(payload));
  };
  document.getElementById('rollBtn').onclick = () => safeSend({ action: 'roll' });
  document.getElementById('drawBtn').onclick = () => safeSend({ action: 'draw' });
  document.getElementById('sendBtn').onclick = () => {
    const msg = messageInput.value.trim();
    if (!msg) return;
    safeSend({ action: 'chat', msg });
    messageInput.value = '';
  };
}

(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/rooms`);
    if (!res.ok) throw new Error('offline');
    setupBackendMode();
  } catch {
    setupLocalMode();
  }
})();

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('sendBtn').click();
  }
});
