// WebSocket signaling client

const Signaling = {
  ws: null,
  listeners: new Map(),
  connected: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,

  // Auto-detect: use WSS in production, WS locally
  get serverUrl() {
    if (window.SIGNALING_SERVER) return window.SIGNALING_SERVER;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'ws://localhost:3000';
    }
    // Production: Railway WebSocket server
    return window.SIGNALING_SERVER || 'wss://opengen-production.up.railway.app';
  },

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('Connected to signaling server');
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onclose = () => {
        console.log('Disconnected from signaling server');
        this.connected = false;
        this.emit('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.emit(msg.type, msg);
        } catch (e) {
          console.error('Invalid message:', e);
        }
      };
    });
  },

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  },

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.emit('reconnect-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this.connected) {
        this.connect().catch(() => {});
      }
    }, delay);
  },

  send(type, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    } else {
      console.error('WebSocket not connected');
    }
  },

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  },

  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  },

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  },

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('Listener error:', e);
      }
    });
  },

  // Convenience methods
  lookupUser(username) {
    return new Promise((resolve, reject) => {
      const handler = (result) => {
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error));
        }
      };

      this.once('lookup-result', handler);
      this.send('lookup', { username });

      setTimeout(() => {
        this.off('lookup-result', handler);
        reject(new Error('Lookup timeout'));
      }, 10000);
    });
  },

  call(targetId) {
    return new Promise((resolve, reject) => {
      const handler = (result) => {
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error));
        }
      };

      this.once('call-result', handler);
      this.send('call', { targetId });

      setTimeout(() => {
        this.off('call-result', handler);
        reject(new Error('Call timeout'));
      }, 30000);
    });
  }
};

window.Signaling = Signaling;
