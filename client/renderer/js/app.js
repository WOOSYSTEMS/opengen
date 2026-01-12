// Main app orchestration

const App = {
  currentCard: 0,
  isInCall: false,

  // DOM elements
  elements: {
    authScreen: null,
    mainScreen: null,
    homeView: null,
    callView: null,
    cardsContainer: null,
    dots: null,
    // Auth
    usernameInput: null,
    passwordInput: null,
    displayNameInput: null,
    loginBtn: null,
    registerBtn: null,
    authError: null,
    // Header
    currentUser: null,
    settingsBtn: null,
    // Contacts
    contactsList: null,
    addContactBtn: null,
    // Modals
    incomingCallModal: null,
    addContactModal: null,
    settingsModal: null,
    // Back button
    backBtn: null
  },

  async init() {
    // Get all DOM elements
    this.cacheElements();

    // Initialize modules
    Call.init();
    Screen.init();
    Chat.init();

    // Set up event listeners
    this.setupEventListeners();

    // Set up card navigation
    this.setupCardNavigation();

    // Check for existing session
    await this.checkSession();
  },

  cacheElements() {
    // Screens (3 separate screens)
    this.elements.authScreen = document.getElementById('auth-screen');
    this.elements.pinScreen = document.getElementById('pin-screen');
    this.elements.mainScreen = document.getElementById('main-screen');
    this.elements.homeView = document.getElementById('home-view');
    this.elements.callView = document.getElementById('call-view');
    this.elements.cardsContainer = document.querySelector('.cards-container');
    this.elements.dots = document.querySelectorAll('.card-dots .dot');

    // Auth screen
    this.elements.usernameInput = document.getElementById('username');
    this.elements.passwordInput = document.getElementById('password');
    this.elements.displayNameInput = document.getElementById('displayName');
    this.elements.continueBtn = document.getElementById('continue-btn');
    this.elements.authError = document.getElementById('auth-error');

    // PIN screen
    this.elements.pinDots = document.querySelectorAll('#pin-screen .pin-dot');
    this.elements.pinError = document.getElementById('pin-error');
    this.elements.pinCancel = document.getElementById('pin-cancel');

    // Header
    this.elements.currentUser = document.getElementById('current-user');
    this.elements.settingsBtn = document.getElementById('settings-btn');

    // Contacts
    this.elements.contactsList = document.getElementById('contacts-list');
    this.elements.addContactBtn = document.getElementById('add-contact-btn');

    // Modals
    this.elements.incomingCallModal = document.getElementById('incoming-call-modal');
    this.elements.addContactModal = document.getElementById('add-contact-modal');
    this.elements.settingsModal = document.getElementById('settings-modal');

    // Back
    this.elements.backBtn = document.getElementById('back-btn');
  },

  currentPin: '',

  setupEventListeners() {
    // Auth - continue to PIN keypad
    this.elements.continueBtn.addEventListener('click', () => this.showPinKeypad());
    this.elements.passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.showPinKeypad();
    });
    this.elements.displayNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.showPinKeypad();
    });

    // PIN keypad (keys are inside #pin-screen)
    document.querySelectorAll('#pin-screen .key-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleKeyPress(btn.dataset.key));
    });
    this.elements.pinCancel.addEventListener('click', () => this.hidePinKeypad());

    // Settings
    this.elements.settingsBtn.addEventListener('click', () => this.showSettings());
    document.getElementById('settings-close').addEventListener('click', () => this.hideSettings());
    document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    document.getElementById('dnd-toggle').addEventListener('change', (e) => {
      Storage.updateSetting('doNotDisturb', e.target.checked);
    });
    document.getElementById('clear-data-btn').addEventListener('click', () => this.clearAllData());
    document.getElementById('copy-code-btn').addEventListener('click', () => this.copyCode());

    // Add contact
    this.elements.addContactBtn.addEventListener('click', () => this.showAddContact());
    document.getElementById('add-contact-confirm').addEventListener('click', () => this.addContact());
    document.getElementById('add-contact-cancel').addEventListener('click', () => this.hideAddContact());

    // Incoming call
    document.getElementById('accept-call').addEventListener('click', () => this.acceptCall());
    document.getElementById('decline-call').addEventListener('click', () => this.declineCall());

    // Back button
    this.elements.backBtn.addEventListener('click', () => this.goHome());

    // Signaling events
    Signaling.on('incoming-call', (data) => this.handleIncomingCall(data));
    Signaling.on('call-response', (data) => this.handleCallResponse(data));
  },

  setupCardNavigation() {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const container = this.elements.cardsContainer;

    container.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
    });

    container.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      const diff = currentX - startX;
      const offset = -this.currentCard * 100 + (diff / container.offsetWidth) * 100;
      container.style.transform = `translateX(${offset}%)`;
    });

    container.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;

      const diff = currentX - startX;
      const threshold = container.offsetWidth / 4;

      if (diff > threshold && this.currentCard > 0) {
        this.goToCard(this.currentCard - 1);
      } else if (diff < -threshold && this.currentCard < 2) {
        this.goToCard(this.currentCard + 1);
      } else {
        this.goToCard(this.currentCard);
      }
    });

    // Dot navigation
    this.elements.dots.forEach((dot, index) => {
      dot.addEventListener('click', () => this.goToCard(index));
    });
  },

  goToCard(index) {
    this.currentCard = index;
    this.elements.cardsContainer.style.transform = `translateX(-${index * 100}%)`;

    // Update dots
    this.elements.dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });

    // Clear unread indicator when viewing chat
    if (index === 2) {
      Chat.unreadCount = 0;
      Chat.updateIndicator(false);
    }
  },

  async checkSession() {
    const hasSession = Identity.restoreSession();
    if (hasSession) {
      try {
        await Signaling.connect();
        const success = await Identity.rejoin();
        if (success) {
          this.showMainScreen();
        } else {
          Storage.clearUser();
        }
      } catch (e) {
        console.error('Failed to reconnect:', e);
      }
    }
  },

  showPinKeypad() {
    const username = this.elements.usernameInput.value.trim();
    const password = this.elements.passwordInput.value;

    if (!username || !password) {
      this.elements.authError.textContent = 'Please enter username and password';
      return;
    }

    this.elements.authError.textContent = '';
    // Switch from auth screen to PIN screen
    this.elements.authScreen.classList.remove('active');
    this.elements.pinScreen.classList.add('active');
    this.currentPin = '';
    this.updatePinDots();
    if (this.elements.pinError) this.elements.pinError.textContent = '';
  },

  hidePinKeypad() {
    // Switch from PIN screen back to auth screen
    this.elements.pinScreen.classList.remove('active');
    this.elements.authScreen.classList.add('active');
    this.currentPin = '';
    this.updatePinDots();
  },

  handleKeyPress(key) {
    if (key === 'back') {
      this.currentPin = this.currentPin.slice(0, -1);
    } else if (key === 'confirm') {
      if (this.currentPin.length === 6) {
        this.handleJoin();
      }
    } else if (this.currentPin.length < 6) {
      this.currentPin += key;
    }
    this.updatePinDots();
  },

  updatePinDots() {
    this.elements.pinDots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < this.currentPin.length);
    });
  },

  async handleJoin() {
    const username = this.elements.usernameInput.value.trim();
    const password = this.elements.passwordInput.value;
    const pin = this.currentPin;
    const displayName = this.elements.displayNameInput.value.trim() || username;

    try {
      await Signaling.connect();
      await Identity.join(username, password, pin, displayName);

      // Switch from PIN screen to main screen
      this.elements.pinScreen.classList.remove('active');
      this.showMainScreen();
    } catch (e) {
      // Show error on PIN screen
      if (this.elements.pinError) {
        this.elements.pinError.textContent = e.message;
      }
    }
  },

  logout() {
    Identity.logout();
    this.hideSettings();
    this.showAuthScreen();
  },

  showAuthScreen() {
    // Hide all other screens, show auth
    this.elements.pinScreen.classList.remove('active');
    this.elements.mainScreen.classList.remove('active');
    this.elements.authScreen.classList.add('active');
    // Clear inputs
    this.elements.usernameInput.value = '';
    this.elements.passwordInput.value = '';
    this.elements.displayNameInput.value = '';
    this.elements.authError.textContent = '';
    this.currentPin = '';
  },

  showMainScreen() {
    // Hide auth and PIN screens, show main
    this.elements.authScreen.classList.remove('active');
    this.elements.pinScreen.classList.remove('active');
    this.elements.mainScreen.classList.add('active');
    this.elements.currentUser.textContent = Identity.currentUser.displayName;

    // Load settings
    const settings = Storage.getSettings();
    document.getElementById('dnd-toggle').checked = settings.doNotDisturb;

    this.renderContacts();
  },

  renderContacts() {
    const contacts = Storage.getContacts();

    if (contacts.length === 0) {
      this.elements.contactsList.innerHTML = '<p class="empty-state">No contacts yet. Tap + to add someone.</p>';
      return;
    }

    this.elements.contactsList.innerHTML = contacts.map(contact => `
      <div class="contact-item" data-id="${contact.id}">
        <div class="contact-avatar">${(contact.displayName || '?').charAt(0).toUpperCase()}</div>
        <div class="contact-info">
          <div class="contact-name">${this.escapeHtml(contact.displayName || 'Unknown')}</div>
          <div class="contact-status">${this.escapeHtml(contact.shortCode || '')}</div>
        </div>
        <div class="contact-actions">
          <button class="action-btn call-btn" title="Call">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </button>
          <button class="action-btn chat-btn" title="Chat">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Add click handlers for call buttons
    this.elements.contactsList.querySelectorAll('.call-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const contactId = btn.closest('.contact-item').dataset.id;
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
          this.startCallWithContact(contact);
        }
      });
    });

    // Add click handlers for chat buttons
    this.elements.contactsList.querySelectorAll('.chat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const contactId = btn.closest('.contact-item').dataset.id;
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
          this.startChatWithContact(contact);
        }
      });
    });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  showAddContact() {
    this.elements.addContactModal.classList.add('active');
    document.getElementById('contact-code').value = '';
    document.getElementById('contact-error').textContent = '';
  },

  hideAddContact() {
    this.elements.addContactModal.classList.remove('active');
  },

  async addContact() {
    const code = document.getElementById('contact-code').value.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    const errorEl = document.getElementById('contact-error');

    if (!code || code.length !== 12) {
      errorEl.textContent = 'Please enter a valid 12-character code';
      return;
    }

    // Don't add yourself
    if (Identity.currentUser && code === Identity.currentUser.shortCode) {
      errorEl.textContent = "That's your own code!";
      return;
    }

    try {
      const result = await Signaling.lookupUser(code);

      Storage.addContact({
        id: result.id,
        shortCode: result.shortCode,
        displayName: result.displayName
      });

      this.renderContacts();
      this.hideAddContact();
    } catch (e) {
      errorEl.textContent = e.message;
    }
  },

  async startCallWithContact(contact) {
    this.isInCall = true;
    this.pendingOutgoingCall = contact;
    Chat.setContact(contact.id);
    Call.setContactInfo(contact);

    // Show call view
    this.elements.homeView.classList.remove('active');
    this.elements.callView.classList.add('active');
    this.goToCard(0);

    try {
      await Signaling.call(contact.id);
      // Now wait for receiver to accept (handled in handleCallResponse)
    } catch (e) {
      console.error('Failed to start call:', e);
      this.pendingOutgoingCall = null;
      this.goHome();
    }
  },

  startChatWithContact(contact) {
    this.isInCall = true;
    Chat.setContact(contact.id);

    // Show call view, go to chat card
    this.elements.homeView.classList.remove('active');
    this.elements.callView.classList.add('active');
    this.goToCard(2); // Chat card
  },

  handleIncomingCall(data) {
    // Check if blocked or DND
    if (Storage.isBlocked(data.fromId)) return;
    if (Storage.getSettings().doNotDisturb) return;

    this.pendingCall = data;
    document.getElementById('caller-name').textContent = data.fromDisplayName;
    this.elements.incomingCallModal.classList.add('active');
  },

  async acceptCall() {
    if (!this.pendingCall) return;

    this.elements.incomingCallModal.classList.remove('active');
    this.isInCall = true;

    const contact = {
      id: this.pendingCall.fromId,
      displayName: this.pendingCall.fromDisplayName
    };

    Chat.setContact(contact.id);
    Call.setContactInfo(contact);

    // Show call view
    this.elements.homeView.classList.remove('active');
    this.elements.callView.classList.add('active');
    this.goToCard(0);

    // Send acceptance
    Signaling.send('call-response', {
      targetId: this.pendingCall.fromId,
      accepted: true
    });

    // Start WebRTC (not initiator)
    await Call.startCall(this.pendingCall.fromId, false);

    this.pendingCall = null;
  },

  declineCall() {
    if (!this.pendingCall) return;

    Signaling.send('call-response', {
      targetId: this.pendingCall.fromId,
      accepted: false
    });

    this.elements.incomingCallModal.classList.remove('active');
    this.pendingCall = null;
  },

  async handleCallResponse(data) {
    if (data.accepted && this.pendingOutgoingCall) {
      // Receiver accepted, now start WebRTC
      await Call.startCall(this.pendingOutgoingCall.id, true);
      this.pendingOutgoingCall = null;
    } else {
      // Call was declined
      this.pendingOutgoingCall = null;
      this.goHome();
    }
  },

  onCallEnded() {
    this.isInCall = false;
    Screen.reset();
    Chat.reset();

    // Return to home after brief delay
    setTimeout(() => {
      if (!this.isInCall) {
        this.goHome();
      }
    }, 2000);
  },

  goHome() {
    this.isInCall = false;
    this.elements.callView.classList.remove('active');
    this.elements.homeView.classList.add('active');

    // Reset modules
    Screen.reset();
    Chat.reset();
  },

  showSettings() {
    this.elements.settingsModal.classList.add('active');

    // Display user's code
    if (Identity.currentUser && Identity.currentUser.shortCode) {
      const code = Identity.currentUser.shortCode;
      document.getElementById('my-short-code').textContent = code;

      // Generate QR code
      const canvas = document.getElementById('qr-code');
      QRCode.generate(canvas, code, 150);
    }
  },

  copyCode() {
    if (Identity.currentUser && Identity.currentUser.shortCode) {
      navigator.clipboard.writeText(Identity.currentUser.shortCode).then(() => {
        const btn = document.getElementById('copy-code-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy Code', 2000);
      });
    }
  },

  hideSettings() {
    this.elements.settingsModal.classList.remove('active');
  },

  clearAllData() {
    if (confirm('This will clear all contacts, messages, and settings. Continue?')) {
      Storage.clearAll();
      Identity.logout();
      this.hideSettings();
      this.showAuthScreen();
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('SW registered'))
    .catch((e) => console.log('SW registration failed:', e));
}

window.App = App;
