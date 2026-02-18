const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
const roomName = params.get('roomName') || '未知房间';
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');

if (!token || !username) {
  alert('请先登录再进入房间');
  window.location.href = '/';
}

if (!roomId) {
  alert('房间不存在');
  window.location.href = '/';
}

document.getElementById('roomTitle').textContent = `房间：${decodeURIComponent(roomName)}`;

const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${protocol}://${window.location.host}/ws/${roomId}?token=${encodeURIComponent(token)}`);

const logEl = document.getElementById('log');
const messageInput = document.getElementById('messageInput');

function addLog(msg, user = '') {
  const item = document.createElement('div');
  item.className = 'log-item';
  item.textContent = user ? `${user}: ${msg}` : msg;
  logEl.appendChild(item);
  logEl.scrollTop = logEl.scrollHeight;
}

ws.onopen = () => addLog('已连接房间，开始游戏吧！');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'system') {
    addLog(data.msg);
  } else {
    addLog(data.msg, data.user);
  }
};
ws.onclose = () => addLog('连接已断开，请返回大厅重试。');

const safeSend = (payload) => {
  if (ws.readyState !== WebSocket.OPEN) {
    return alert('连接尚未建立，请稍后');
  }
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

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('sendBtn').click();
  }
});
