// Chat feature (Card 3)

const Chat = {
  currentContactId: null,
  unreadCount: 0,

  // DOM elements
  elements: {
    messagesContainer: null,
    messageInput: null,
    sendBtn: null,
    chatIndicator: null
  },

  init() {
    // Get DOM elements
    this.elements.messagesContainer = document.getElementById('messages');
    this.elements.messageInput = document.getElementById('message-input');
    this.elements.sendBtn = document.getElementById('send-btn');
    this.elements.chatIndicator = document.getElementById('chat-indicator');

    // Set up event listeners
    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
    this.elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    // WebRTC event handlers
    WebRTCManager.on('data-channel-open', () => this.onDataChannelOpen());
    WebRTCManager.on('data-message', (msg) => this.onDataMessage(msg));
  },

  setContact(contactId) {
    this.currentContactId = contactId;
    this.loadMessages();
    this.unreadCount = 0;
    this.updateIndicator(false);
  },

  loadMessages() {
    if (!this.currentContactId) return;

    const messages = Storage.getMessages(this.currentContactId);
    this.elements.messagesContainer.innerHTML = '';

    messages.forEach(msg => {
      this.renderMessage(msg);
    });

    this.scrollToBottom();
  },

  sendMessage() {
    const content = this.elements.messageInput.value.trim();
    if (!content || !this.currentContactId) return;

    const message = {
      id: Date.now().toString(),
      content,
      sent: true,
      timestamp: Date.now()
    };

    // Send via data channel
    const sent = WebRTCManager.sendData({
      type: 'message',
      content: message.content,
      id: message.id,
      timestamp: message.timestamp
    });

    if (sent) {
      // Save locally
      Storage.saveMessage(this.currentContactId, message);

      // Render
      this.renderMessage(message);
      this.scrollToBottom();

      // Clear input
      this.elements.messageInput.value = '';
    } else {
      console.error('Failed to send message: data channel not open');
    }
  },

  onDataChannelOpen() {
    console.log('Chat: Data channel ready');
  },

  onDataMessage(msg) {
    if (msg.type !== 'message') return;

    const message = {
      id: msg.id || Date.now().toString(),
      content: msg.content,
      sent: false,
      timestamp: msg.timestamp || Date.now()
    };

    // Save locally
    Storage.saveMessage(this.currentContactId, message);

    // Render
    this.renderMessage(message);
    this.scrollToBottom();

    // Update unread count if not viewing chat
    if (!this.isVisible()) {
      this.unreadCount++;
      this.updateIndicator(true);

      // Show notification if not muted
      if (!Storage.getSettings().doNotDisturb &&
          !Storage.isContactMuted(this.currentContactId)) {
        this.showNotification(message);
      }
    }
  },

  renderMessage(message) {
    const div = document.createElement('div');
    div.className = `message ${message.sent ? 'sent' : 'received'}`;

    const time = new Date(message.timestamp);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
      <div class="message-content">${this.escapeHtml(message.content)}</div>
      <div class="message-time">${timeStr}</div>
    `;

    this.elements.messagesContainer.appendChild(div);
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  scrollToBottom() {
    this.elements.messagesContainer.scrollTop =
      this.elements.messagesContainer.scrollHeight;
  },

  isVisible() {
    // Check if chat card is currently visible
    return document.getElementById('card-chat').getBoundingClientRect().left === 0;
  },

  updateIndicator(hasUnread) {
    this.elements.chatIndicator.classList.toggle('active', hasUnread);
  },

  showNotification(message) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      const contact = Storage.getContacts().find(c => c.id === this.currentContactId);
      new Notification(contact?.displayName || 'New Message', {
        body: message.content,
        silent: false
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  },

  reset() {
    this.currentContactId = null;
    this.unreadCount = 0;
    this.elements.messagesContainer.innerHTML = '';
    this.elements.messageInput.value = '';
    this.updateIndicator(false);
  }
};

window.Chat = Chat;
