// In-memory session store
// No registration - just tracks online sessions
// Identity = hash(username + password), generated client-side

const sessions = new Map(); // id → { displayName, username, ws }

module.exports = {
  // Join with your hash ID - creates session if not exists
  join(id, username, displayName) {
    sessions.set(id, { displayName, username, ws: null });
    return { success: true };
  },

  // Set websocket for session
  setOnline(id, ws) {
    const session = sessions.get(id);
    if (session) {
      session.ws = ws;
      return true;
    }
    return false;
  },

  // Remove session when disconnected
  setOffline(id) {
    sessions.delete(id);
    return true;
  },

  getUser(id) {
    return sessions.get(id) || null;
  },

  getUserByUsername(username) {
    for (const [id, session] of sessions) {
      if (session.username.toLowerCase() === username.toLowerCase()) {
        return { id, ...session };
      }
    }
    return null;
  },

  isOnline(id) {
    const session = sessions.get(id);
    return session && session.ws !== null;
  },

  getWs(id) {
    const session = sessions.get(id);
    return session ? session.ws : null;
  },

  getUserCount() {
    return sessions.size;
  }
};
