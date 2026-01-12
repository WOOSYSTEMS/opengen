// Identity system: hash(username + password) → unique ID
// No registration needed - your identity IS the hash

const Identity = {
  currentUser: null,

  async generateId(username, password, pin) {
    const data = new TextEncoder().encode(username.toLowerCase() + password + pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Generate 12-char alphanumeric code from hash
  generateShortCode(hash) {
    const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // No I, O (avoid confusion with 1, 0)
    let code = '';
    for (let i = 0; i < 12; i++) {
      const byte = parseInt(hash.substr(i * 2, 2), 16);
      code += chars[byte % chars.length];
    }
    return code;
  },

  // Single join method - no separate register/login
  async join(username, password, pin, displayName) {
    const id = await this.generateId(username, password, pin);
    const shortCode = this.generateShortCode(id);

    return new Promise((resolve, reject) => {
      const handler = (result) => {
        if (result.success) {
          this.currentUser = {
            id,
            shortCode,
            username,
            displayName: displayName || username
          };
          Storage.saveUser(this.currentUser);
          resolve({ success: true });
        } else {
          reject(new Error(result.error || 'Join failed'));
        }
      };

      Signaling.once('join-result', handler);
      Signaling.send('join', { id, shortCode, username, displayName: displayName || username });

      setTimeout(() => {
        Signaling.off('join-result', handler);
        reject(new Error('Connection timeout'));
      }, 10000);
    });
  },

  logout() {
    this.currentUser = null;
    Storage.clearUser();
    Signaling.disconnect();
  },

  restoreSession() {
    const savedUser = Storage.getUser();
    if (savedUser) {
      this.currentUser = savedUser;
      return true;
    }
    return false;
  },

  // Rejoin with saved credentials
  async rejoin() {
    if (!this.currentUser) return false;

    return new Promise((resolve) => {
      const handler = (result) => {
        resolve(result.success);
      };

      Signaling.once('join-result', handler);
      Signaling.send('join', {
        id: this.currentUser.id,
        username: this.currentUser.username,
        displayName: this.currentUser.displayName
      });

      setTimeout(() => {
        Signaling.off('join-result', handler);
        resolve(false);
      }, 10000);
    });
  },

  getCurrentUser() {
    return this.currentUser;
  }
};

window.Identity = Identity;
