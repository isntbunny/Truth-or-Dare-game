const API_BASE = localStorage.getItem('api_base') || '';

const store = {
  getUsers: () => JSON.parse(localStorage.getItem('tod_users') || '[]'),
  setUsers: (users) => localStorage.setItem('tod_users', JSON.stringify(users)),
  getRooms: () => JSON.parse(localStorage.getItem('tod_rooms') || '[]'),
  setRooms: (rooms) => localStorage.setItem('tod_rooms', JSON.stringify(rooms)),
};

function seedLocalRooms() {
  if (!store.getRooms().length) {
    store.setRooms([
      { id: 1, name: '欢乐局', description: '轻松聊天 + 真心话', created_by: 'system' },
      { id: 2, name: '刺激大冒险', description: '适合勇士玩家', created_by: 'system' },
      { id: 3, name: '深夜坦白局', description: '走心真心话专场', created_by: 'system' },
    ]);
  }
}
seedLocalRooms();

const api = {
  mode: 'backend',
  async probe() {
    try {
      const res = await fetch(`${API_BASE}/api/rooms`);
      if (!res.ok) throw new Error('backend unavailable');
      this.mode = 'backend';
    } catch {
      this.mode = 'local';
    }
    document.getElementById('modeTip').textContent =
      this.mode === 'backend' ? '当前模式：在线后端模式' : '当前模式：纯前端离线模式（无需后端，适合 Netlify）';
  },
  async getRooms(search = '') {
    if (this.mode === 'backend') {
      const res = await fetch(`${API_BASE}/api/rooms?search=${encodeURIComponent(search)}`);
      return res.json();
    }
    const key = search.trim().toLowerCase();
    const rooms = store.getRooms().filter((r) =>
      !key || r.name.toLowerCase().includes(key) || (r.description || '').toLowerCase().includes(key)
    );
    return { rooms: rooms.sort((a, b) => b.id - a.id) };
  },
  async register(payload) {
    if (this.mode === 'backend') {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail || '注册失败');
      return res.json();
    }
    const users = store.getUsers();
    if (users.some((u) => u.username === payload.username)) throw new Error('用户名已存在');
    users.push({ username: payload.username, password: payload.password, email: payload.email || null });
    store.setUsers(users);
    return { message: '注册成功，请登录' };
  },
  async login(payload) {
    if (this.mode === 'backend') {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail || '登录失败');
      return res.json();
    }
    const user = store.getUsers().find((u) => u.username === payload.username && u.password === payload.password);
    if (!user) throw new Error('用户名或密码错误');
    return { username: user.username, token: `local_${user.username}_${Date.now()}` };
  },
  async createRoom(token, payload, username) {
    if (this.mode === 'backend') {
      const res = await fetch(`${API_BASE}/api/rooms?token=${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail || '创建房间失败');
      return res.json();
    }
    const rooms = store.getRooms();
    if (rooms.some((r) => r.name === payload.name)) throw new Error('房间名已存在');
    const room = { id: Date.now(), name: payload.name, description: payload.description || '', created_by: username };
    rooms.push(room);
    store.setRooms(rooms);
    return room;
  },
};

const roomList = document.getElementById('roomList');
const searchInput = document.getElementById('searchInput');
const userTag = document.getElementById('userTag');
const logoutBtn = document.getElementById('logoutBtn');
const openLoginBtn = document.getElementById('openLoginBtn');
const openRegisterBtn = document.getElementById('openRegisterBtn');
const loginDialog = document.getElementById('loginDialog');
const registerDialog = document.getElementById('registerDialog');

const state = {
  token: localStorage.getItem('token') || '',
  username: localStorage.getItem('username') || '',
};

function syncUserUI() {
  const logged = !!state.token;
  userTag.classList.toggle('hidden', !logged);
  logoutBtn.classList.toggle('hidden', !logged);
  openLoginBtn.classList.toggle('hidden', logged);
  openRegisterBtn.classList.toggle('hidden', logged);
  userTag.textContent = logged ? `已登录：${state.username}` : '';
}

function renderRooms(rooms) {
  roomList.innerHTML = '';
  if (!rooms.length) {
    roomList.innerHTML = '<div class="room-card">暂无房间，快创建一个吧！</div>';
    return;
  }
  rooms.forEach((room) => {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.innerHTML = `
      <h4>${room.name}</h4>
      <p class="room-meta">${room.description || '暂无描述'} · 创建者：${room.created_by}</p>
      <button class="primary-btn">进入房间</button>
    `;
    card.querySelector('button').onclick = () => {
      if (!state.token) return loginDialog.showModal();
      window.location.href = `./game.html?roomId=${room.id}&roomName=${encodeURIComponent(room.name)}`;
    };
    roomList.appendChild(card);
  });
}

async function loadRooms(search = '') {
  const data = await api.getRooms(search);
  renderRooms(data.rooms || []);
}

document.getElementById('searchBtn').onclick = () => loadRooms(searchInput.value.trim());
document.getElementById('refreshBtn').onclick = () => { searchInput.value = ''; loadRooms(''); };

document.getElementById('createRoomBtn').onclick = async () => {
  if (!state.token) return loginDialog.showModal();
  const name = document.getElementById('roomName').value.trim();
  const description = document.getElementById('roomDesc').value.trim();
  if (!name) return alert('请输入房间名称');
  try {
    await api.createRoom(state.token, { name, description }, state.username);
    document.getElementById('roomName').value = '';
    document.getElementById('roomDesc').value = '';
    await loadRooms();
  } catch (e) { alert(e.message); }
};

openLoginBtn.onclick = () => loginDialog.showModal();
openRegisterBtn.onclick = () => registerDialog.showModal();
document.getElementById('closeLogin').onclick = () => loginDialog.close();
document.getElementById('closeRegister').onclick = () => registerDialog.close();

logoutBtn.onclick = () => {
  state.token = '';
  state.username = '';
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  syncUserUI();
};

document.getElementById('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await api.login({ username: form.get('username').trim(), password: form.get('password') });
    state.token = data.token;
    state.username = data.username;
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    syncUserUI();
    loginDialog.close();
  } catch (err) { alert(err.message); }
};

document.getElementById('registerForm').onsubmit = async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api.register({
      username: form.get('username').trim(),
      password: form.get('password'),
      email: (form.get('email') || '').trim() || null,
    });
    registerDialog.close();
    alert('注册成功，请登录');
    loginDialog.showModal();
  } catch (err) { alert(err.message); }
};

(async () => {
  await api.probe();
  syncUserUI();
  loadRooms();
})();
