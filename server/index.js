const http = require('http');
const { WebSocketServer } = require('ws');
const store = require('./store');

const PORT = process.env.PORT || 3000;

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', users: store.getUserCount?.() || 0 }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('openGen signaling server');
  }
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Map ws connections to user IDs
const wsToId = new Map();

server.listen(PORT, () => {
  console.log(`OpenGen signaling server running on port ${PORT}`);
});

wss.on('connection', (ws) => {
  console.log('New connection');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(ws, msg);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    const id = wsToId.get(ws);
    if (id) {
      store.setOffline(id);
      wsToId.delete(ws);
      console.log(`User ${id.slice(0, 8)}... went offline`);
    }
  });
});

function send(ws, type, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function handleMessage(ws, msg) {
  const { type } = msg;

  switch (type) {
    case 'register': {
      const { id, username, displayName } = msg;
      const result = store.register(id, username, displayName);
      if (result.success) {
        wsToId.set(ws, id);
        store.setOnline(id, ws);
        console.log(`Registered: ${username} (${id.slice(0, 8)}...)`);
      }
      send(ws, 'register-result', result);
      break;
    }

    case 'login': {
      const { id } = msg;
      const result = store.login(id);
      if (result.success) {
        wsToId.set(ws, id);
        store.setOnline(id, ws);
        console.log(`Login: ${result.username} (${id.slice(0, 8)}...)`);
      }
      send(ws, 'login-result', result);
      break;
    }

    case 'lookup': {
      const { username } = msg;
      const user = store.getUserByUsername(username);
      if (user) {
        send(ws, 'lookup-result', {
          success: true,
          id: user.id,
          displayName: user.displayName,
          username: user.username,
          online: user.online
        });
      } else {
        send(ws, 'lookup-result', { success: false, error: 'User not found' });
      }
      break;
    }

    case 'call': {
      const { targetId } = msg;
      const fromId = wsToId.get(ws);
      const fromUser = store.getUser(fromId);
      const targetWs = store.getWs(targetId);

      if (targetWs) {
        send(targetWs, 'incoming-call', {
          fromId,
          fromDisplayName: fromUser?.displayName || 'Unknown'
        });
        send(ws, 'call-result', { success: true });
      } else {
        send(ws, 'call-result', { success: false, error: 'User offline' });
      }
      break;
    }

    case 'call-response': {
      const { targetId, accepted } = msg;
      const fromId = wsToId.get(ws);
      const targetWs = store.getWs(targetId);

      if (targetWs) {
        send(targetWs, 'call-response', { fromId, accepted });
      }
      break;
    }

    case 'ready': {
      const { targetId } = msg;
      const fromId = wsToId.get(ws);
      const targetWs = store.getWs(targetId);

      if (targetWs) {
        send(targetWs, 'ready', { fromId });
      }
      break;
    }

    case 'offer': {
      const { targetId, offer } = msg;
      const fromId = wsToId.get(ws);
      const targetWs = store.getWs(targetId);

      if (targetWs) {
        send(targetWs, 'offer', { fromId, offer });
      }
      break;
    }

    case 'answer': {
      const { targetId, answer } = msg;
      const fromId = wsToId.get(ws);
      const targetWs = store.getWs(targetId);

      if (targetWs) {
        send(targetWs, 'answer', { fromId, answer });
      }
      break;
    }

    case 'ice-candidate': {
      const { targetId, candidate } = msg;
      const fromId = wsToId.get(ws);
      const targetWs = store.getWs(targetId);

      if (targetWs) {
        send(targetWs, 'ice-candidate', { fromId, candidate });
      }
      break;
    }

    case 'hangup': {
      const { targetId } = msg;
      const fromId = wsToId.get(ws);
      const targetWs = store.getWs(targetId);

      if (targetWs) {
        send(targetWs, 'hangup', { fromId });
      }
      break;
    }

    default:
      console.log('Unknown message type:', type);
  }
}
