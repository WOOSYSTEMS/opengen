// In-memory session store
// No registration - just tracks online sessions
// Identity = hash(username + password + pin), generated client-side

const sessions = new Map(); // id → { shortCode, displayName, username, ws }
const shortCodeToId = new Map(); // shortCode → id (for lookup)

module.exports = {
  // Join with your hash ID - creates session if not exists
  join(id, shortCode, username, displayName) {
    sessions.set(id, { shortCode, displayName, username, ws: null });
    shortCodeToId.set(shortCode, id);
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
    const session = sessions.get(id);
    if (session) {
      shortCodeToId.delete(session.shortCode);
    }
    sessions.delete(id);
    return true;
  },

  getUser(id) {
    return sessions.get(id) || null;
  },

  // Lookup by 12-char shortCode
  getUserByShortCode(shortCode) {
    const id = shortCodeToId.get(shortCode.toUpperCase());
    if (!id) return null;
    const session = sessions.get(id);
    return session ? { id, ...session } : null;
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
