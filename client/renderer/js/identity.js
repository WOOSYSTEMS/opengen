// Identity system: hash(username + password) → unique ID

const Identity = {
  currentUser: null,

  async generateId(username, password) {
    const data = new TextEncoder().encode(username.toLowerCase() + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async register(username, password, displayName) {
    const id = await this.generateId(username, password);

    return new Promise((resolve, reject) => {
      const handler = (result) => {
        if (result.success) {
          this.currentUser = { id, username, displayName };
          Storage.saveUser(this.currentUser);
          resolve({ success: true });
        } else {
          reject(new Error(result.error));
        }
      };

      Signaling.once('register-result', handler);
      Signaling.send('register', { id, username, displayName });

      // Timeout after 10 seconds
      setTimeout(() => {
        Signaling.off('register-result', handler);
        reject(new Error('Registration timeout'));
      }, 10000);
    });
  },

  async login(username, password) {
    const id = await this.generateId(username, password);

    return new Promise((resolve, reject) => {
      const handler = (result) => {
        if (result.success) {
          this.currentUser = { id, username: result.username, displayName: result.displayName };
          Storage.saveUser(this.currentUser);
          resolve({ success: true, user: this.currentUser });
        } else {
          reject(new Error(result.error));
        }
      };

      Signaling.once('login-result', handler);
      Signaling.send('login', { id });

      // Timeout after 10 seconds
      setTimeout(() => {
        Signaling.off('login-result', handler);
        reject(new Error('Login timeout'));
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

  getCurrentUser() {
    return this.currentUser;
  }
};

window.Identity = Identity;
