// Call feature - Audio/Video calls (Card 1)

const Call = {
  isActive: false,
  isMuted: false,
  isVideoOff: false,
  callStartTime: null,
  durationInterval: null,
  currentContactId: null,

  // DOM elements
  elements: {
    localVideo: null,
    remoteVideo: null,
    callStatus: null,
    callDuration: null,
    toggleAudio: null,
    toggleVideo: null,
    hangupBtn: null,
    callIndicator: null
  },

  init() {
    // Get DOM elements
    this.elements.localVideo = document.getElementById('local-video');
    this.elements.remoteVideo = document.getElementById('remote-video');
    this.elements.callStatus = document.getElementById('call-status');
    this.elements.callDuration = document.getElementById('call-duration');
    this.elements.toggleAudio = document.getElementById('toggle-audio');
    this.elements.toggleVideo = document.getElementById('toggle-video');
    this.elements.hangupBtn = document.getElementById('hangup-btn');
    this.elements.callIndicator = document.getElementById('call-indicator');

    // Set up event listeners
    this.elements.toggleAudio.addEventListener('click', () => this.toggleAudio());
    this.elements.toggleVideo.addEventListener('click', () => this.toggleVideo());
    this.elements.hangupBtn.addEventListener('click', () => this.hangup());

    // WebRTC event handlers
    WebRTCManager.on('local-stream', (stream) => this.handleLocalStream(stream));
    WebRTCManager.on('remote-stream', (stream) => this.handleRemoteStream(stream));
    WebRTCManager.on('connection-state', (state) => this.handleConnectionState(state));
    WebRTCManager.on('hangup', () => this.handleHangup());
    WebRTCManager.on('closed', () => this.handleClosed());
  },

  async startCall(contactId, isInitiator) {
    this.currentContactId = contactId;
    this.isActive = true;
    this.updateIndicator(true);
    this.elements.callStatus.textContent = 'Connecting...';

    try {
      await WebRTCManager.init(contactId, isInitiator);
      await WebRTCManager.startCall();
    } catch (e) {
      console.error('Failed to start call:', e);
      this.elements.callStatus.textContent = 'Failed to connect';
      this.isActive = false;
      this.updateIndicator(false);
    }
  },

  handleLocalStream(stream) {
    this.elements.localVideo.srcObject = stream;
  },

  handleRemoteStream(stream) {
    this.elements.remoteVideo.srcObject = stream;
    this.elements.callStatus.textContent = 'Connected';
    this.startDurationTimer();
  },

  handleConnectionState(state) {
    switch (state) {
      case 'connecting':
        this.elements.callStatus.textContent = 'Connecting...';
        break;
      case 'connected':
        this.elements.callStatus.textContent = 'Connected';
        break;
      case 'disconnected':
        this.elements.callStatus.textContent = 'Reconnecting...';
        break;
      case 'failed':
        this.elements.callStatus.textContent = 'Connection failed';
        this.endCall();
        break;
      case 'closed':
        this.endCall();
        break;
    }
  },

  handleHangup() {
    this.endCall();
  },

  handleClosed() {
    this.endCall();
  },

  toggleAudio() {
    this.isMuted = !WebRTCManager.toggleAudio();
    this.elements.toggleAudio.classList.toggle('active', this.isMuted);
  },

  toggleVideo() {
    this.isVideoOff = !WebRTCManager.toggleVideo();
    this.elements.toggleVideo.classList.toggle('active', this.isVideoOff);
  },

  hangup() {
    WebRTCManager.hangup();
    this.endCall();
  },

  endCall() {
    this.isActive = false;
    this.isMuted = false;
    this.isVideoOff = false;
    this.currentContactId = null;

    // Clear video elements
    this.elements.localVideo.srcObject = null;
    this.elements.remoteVideo.srcObject = null;

    // Stop duration timer
    this.stopDurationTimer();

    // Reset UI
    this.elements.callStatus.textContent = 'Call ended';
    this.elements.toggleAudio.classList.remove('active');
    this.elements.toggleVideo.classList.remove('active');
    this.updateIndicator(false);

    // Notify app
    if (window.App) {
      App.onCallEnded();
    }
  },

  startDurationTimer() {
    this.callStartTime = Date.now();
    this.durationInterval = setInterval(() => {
      const elapsed = Date.now() - this.callStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      this.elements.callDuration.textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  },

  stopDurationTimer() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    this.elements.callDuration.textContent = '';
  },

  updateIndicator(active) {
    this.elements.callIndicator.classList.toggle('active', active);
  }
};

window.Call = Call;
