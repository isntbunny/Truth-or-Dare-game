const api = {
  async getRooms(search = "") {
    const res = await fetch(`/api/rooms?search=${encodeURIComponent(search)}`);
    return res.json();
  },
  async register(payload) {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error((await res.json()).detail || '注册失败');
    return res.json();
  },
  async login(payload) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error((await res.json()).detail || '登录失败');
    return res.json();
  },
  async createRoom(token, payload) {
    const res = await fetch(`/api/rooms?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error((await res.json()).detail || '创建房间失败');
    return res.json();
  }
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
  username: localStorage.getItem('username') || ''
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

  for (const room of rooms) {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.innerHTML = `
      <h4>${room.name}</h4>
      <p class="room-meta">${room.description || '暂无描述'} · 创建者：${room.created_by}</p>
      <button class="primary-btn">进入房间</button>
    `;

    card.querySelector('button').onclick = () => {
      if (!state.token) {
        alert('请先登录再开始游戏');
        loginDialog.showModal();
        return;
      }
      window.location.href = `/game?roomId=${room.id}&roomName=${encodeURIComponent(room.name)}`;
    };
    roomList.appendChild(card);
  }
}

async function loadRooms(search = '') {
  const data = await api.getRooms(search);
  renderRooms(data.rooms || []);
}

document.getElementById('searchBtn').onclick = () => loadRooms(searchInput.value.trim());
document.getElementById('refreshBtn').onclick = () => {
  searchInput.value = '';
  loadRooms('');
};

document.getElementById('createRoomBtn').onclick = async () => {
  if (!state.token) {
    alert('请先登录后创建房间');
    loginDialog.showModal();
    return;
  }

  const name = document.getElementById('roomName').value.trim();
  const description = document.getElementById('roomDesc').value.trim();
  if (!name) return alert('请输入房间名称');

  try {
    await api.createRoom(state.token, { name, description });
    document.getElementById('roomName').value = '';
    document.getElementById('roomDesc').value = '';
    await loadRooms();
  } catch (e) {
    alert(e.message);
  }
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
    const data = await api.login({
      username: form.get('username').trim(),
      password: form.get('password')
    });
    state.token = data.token;
    state.username = data.username;
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    syncUserUI();
    loginDialog.close();
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById('registerForm').onsubmit = async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api.register({
      username: form.get('username').trim(),
      password: form.get('password'),
      email: (form.get('email') || '').trim() || null
    });
    registerDialog.close();
    alert('注册成功，请登录');
    loginDialog.showModal();
  } catch (err) {
    alert(err.message);
  }
};

syncUserUI();
loadRooms();
