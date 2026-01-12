// In-memory user store
// Stores: { id: { displayName, online, ws } }

const users = new Map();
const usernameToId = new Map();

module.exports = {
  register(id, username, displayName) {
    if (users.has(id)) {
      return { success: false, error: 'User already exists' };
    }
    if (usernameToId.has(username.toLowerCase())) {
      return { success: false, error: 'Username taken' };
    }
    users.set(id, { displayName, username, online: false, ws: null });
    usernameToId.set(username.toLowerCase(), id);
    return { success: true };
  },

  login(id) {
    if (!users.has(id)) {
      return { success: false, error: 'User not found' };
    }
    const user = users.get(id);
    return { success: true, displayName: user.displayName, username: user.username };
  },

  setOnline(id, ws) {
    if (!users.has(id)) return false;
    const user = users.get(id);
    user.online = true;
    user.ws = ws;
    return true;
  },

  setOffline(id) {
    if (!users.has(id)) return false;
    const user = users.get(id);
    user.online = false;
    user.ws = null;
    return true;
  },

  getUser(id) {
    return users.get(id) || null;
  },

  getUserByUsername(username) {
    const id = usernameToId.get(username.toLowerCase());
    if (!id) return null;
    const user = users.get(id);
    return user ? { id, ...user } : null;
  },

  isOnline(id) {
    const user = users.get(id);
    return user ? user.online : false;
  },

  getWs(id) {
    const user = users.get(id);
    return user ? user.ws : null;
  }
};
