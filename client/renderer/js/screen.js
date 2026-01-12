// Screen share & remote control feature (Card 2)

const Screen = {
  isSharing: false,
  isControlling: false,
  isBeingControlled: false,
  controlPermissionGranted: false,

  // DOM elements
  elements: {
    screenVideo: null,
    controlOverlay: null,
    shareBtn: null,
    requestControlBtn: null,
    screenStatus: null,
    screenIndicator: null,
    controlModal: null,
    controlRequester: null,
    allowControlBtn: null,
    denyControlBtn: null
  },

  init() {
    // Get DOM elements
    this.elements.screenVideo = document.getElementById('screen-video');
    this.elements.controlOverlay = document.getElementById('control-overlay');
    this.elements.shareBtn = document.getElementById('share-screen-btn');
    this.elements.requestControlBtn = document.getElementById('request-control-btn');
    this.elements.screenStatus = document.getElementById('screen-status');
    this.elements.screenIndicator = document.getElementById('screen-indicator');
    this.elements.controlModal = document.getElementById('control-modal');
    this.elements.controlRequester = document.getElementById('control-requester');
    this.elements.allowControlBtn = document.getElementById('allow-control');
    this.elements.denyControlBtn = document.getElementById('deny-control');

    // Set up event listeners
    this.elements.shareBtn.addEventListener('click', () => this.toggleScreenShare());
    this.elements.requestControlBtn.addEventListener('click', () => this.requestControl());
    this.elements.allowControlBtn.addEventListener('click', () => this.allowControl());
    this.elements.denyControlBtn.addEventListener('click', () => this.denyControl());

    // WebRTC event handlers
    WebRTCManager.on('screen-share-started', (stream) => this.handleScreenShareStarted(stream));
    WebRTCManager.on('screen-share-stopped', () => this.handleScreenShareStopped());
    WebRTCManager.on('remote-stream', (stream) => this.handleRemoteStream(stream));
    WebRTCManager.on('data-message', (msg) => this.handleDataMessage(msg));

    // Set up control overlay events
    this.setupControlOverlay();
  },

  setupControlOverlay() {
    const overlay = this.elements.controlOverlay;

    overlay.addEventListener('mousemove', (e) => {
      if (this.isControlling) {
        this.sendControlEvent('mouse', {
          event: 'move',
          x: e.offsetX / overlay.width,
          y: e.offsetY / overlay.height
        });
      }
    });

    overlay.addEventListener('mousedown', (e) => {
      if (this.isControlling) {
        this.sendControlEvent('mouse', {
          event: 'down',
          button: e.button,
          x: e.offsetX / overlay.width,
          y: e.offsetY / overlay.height
        });
      }
    });

    overlay.addEventListener('mouseup', (e) => {
      if (this.isControlling) {
        this.sendControlEvent('mouse', {
          event: 'up',
          button: e.button,
          x: e.offsetX / overlay.width,
          y: e.offsetY / overlay.height
        });
      }
    });

    overlay.addEventListener('click', (e) => {
      if (this.isControlling) {
        this.sendControlEvent('mouse', {
          event: 'click',
          button: e.button,
          x: e.offsetX / overlay.width,
          y: e.offsetY / overlay.height
        });
      }
    });

    document.addEventListener('keydown', (e) => {
      if (this.isControlling && document.activeElement === overlay) {
        e.preventDefault();
        this.sendControlEvent('key', {
          event: 'down',
          key: e.key,
          code: e.code,
          modifiers: {
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey
          }
        });
      }
    });

    document.addEventListener('keyup', (e) => {
      if (this.isControlling && document.activeElement === overlay) {
        e.preventDefault();
        this.sendControlEvent('key', {
          event: 'up',
          key: e.key,
          code: e.code
        });
      }
    });
  },

  async toggleScreenShare() {
    if (this.isSharing) {
      await this.stopScreenShare();
    } else {
      await this.startScreenShare();
    }
  },

  async startScreenShare() {
    try {
      await WebRTCManager.startScreenShare();
    } catch (e) {
      console.error('Failed to start screen share:', e);
      this.elements.screenStatus.textContent = 'Failed to share screen';
    }
  },

  async stopScreenShare() {
    await WebRTCManager.stopScreenShare();
    this.isBeingControlled = false;
    this.controlPermissionGranted = false;

    // Notify peer that control is revoked
    this.sendControlEvent('control', { action: 'revoked' });
  },

  handleScreenShareStarted(stream) {
    this.isSharing = true;
    this.elements.shareBtn.textContent = 'Stop Sharing';
    this.elements.screenStatus.textContent = 'Sharing your screen';
    this.updateIndicator(true);
  },

  handleScreenShareStopped() {
    this.isSharing = false;
    this.elements.shareBtn.textContent = 'Share My Screen';
    this.elements.screenStatus.textContent = 'No screen shared';
    this.updateIndicator(false);
  },

  handleRemoteStream(stream) {
    // Check if this is a screen share stream (usually has no audio)
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      this.elements.screenVideo.srcObject = stream;
      this.elements.requestControlBtn.disabled = false;
      this.elements.screenStatus.textContent = 'Viewing remote screen';
    }
  },

  requestControl() {
    this.sendControlEvent('control', { action: 'request' });
    this.elements.screenStatus.textContent = 'Requesting control...';
  },

  allowControl() {
    this.controlPermissionGranted = true;
    this.isBeingControlled = true;
    this.elements.controlModal.classList.remove('active');
    this.sendControlEvent('control', { action: 'granted' });
    this.elements.screenStatus.textContent = 'Remote control active';
  },

  denyControl() {
    this.controlPermissionGranted = false;
    this.elements.controlModal.classList.remove('active');
    this.sendControlEvent('control', { action: 'denied' });
  },

  handleDataMessage(msg) {
    if (msg.type === 'control') {
      this.handleControlMessage(msg);
    } else if (msg.type === 'mouse' || msg.type === 'key') {
      this.handleRemoteInput(msg);
    }
  },

  handleControlMessage(msg) {
    switch (msg.action) {
      case 'request':
        // Show permission modal
        const contact = Storage.getContacts().find(c => c.id === WebRTCManager.currentPeerId);
        this.elements.controlRequester.textContent =
          `${contact?.displayName || 'Remote user'} wants to control your screen`;
        this.elements.controlModal.classList.add('active');
        break;

      case 'granted':
        this.isControlling = true;
        this.elements.controlOverlay.classList.add('active');
        this.elements.controlOverlay.tabIndex = 0;
        this.elements.controlOverlay.focus();
        this.elements.screenStatus.textContent = 'You are in control';
        this.elements.requestControlBtn.textContent = 'Release Control';
        break;

      case 'denied':
        this.elements.screenStatus.textContent = 'Control request denied';
        break;

      case 'revoked':
        this.isControlling = false;
        this.elements.controlOverlay.classList.remove('active');
        this.elements.screenStatus.textContent = 'Control ended';
        this.elements.requestControlBtn.textContent = 'Request Control';
        break;
    }
  },

  handleRemoteInput(msg) {
    if (!this.isBeingControlled || !this.controlPermissionGranted) return;

    // NOTE: Actually executing mouse/keyboard events requires native modules
    // or a separate helper process. For now, we just log them.
    // In a production app, you'd use something like robotjs or native messaging.
    console.log('Remote input:', msg);

    // Emit event for potential native handling
    if (window.electronAPI && window.electronAPI.simulateInput) {
      window.electronAPI.simulateInput(msg);
    }
  },

  sendControlEvent(type, data) {
    WebRTCManager.sendData({ type, ...data });
  },

  updateIndicator(active) {
    this.elements.screenIndicator.classList.toggle('active', active);
  },

  reset() {
    this.isSharing = false;
    this.isControlling = false;
    this.isBeingControlled = false;
    this.controlPermissionGranted = false;

    this.elements.screenVideo.srcObject = null;
    this.elements.shareBtn.textContent = 'Share My Screen';
    this.elements.requestControlBtn.textContent = 'Request Control';
    this.elements.requestControlBtn.disabled = true;
    this.elements.screenStatus.textContent = 'No screen shared';
    this.elements.controlOverlay.classList.remove('active');
    this.elements.controlModal.classList.remove('active');
    this.updateIndicator(false);
  }
};

window.Screen = Screen;
