// WebRTC connection manager

const WebRTCManager = {
  peerConnection: null,
  dataChannel: null,
  localStream: null,
  remoteStream: null,
  screenStream: null,
  currentPeerId: null,
  isInitiator: false,

  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  },

  listeners: new Map(),

  async init(peerId, isInitiator) {
    this.currentPeerId = peerId;
    this.isInitiator = isInitiator;

    // Close existing connection
    this.close();

    // Create new peer connection
    this.peerConnection = new RTCPeerConnection(this.config);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        Signaling.send('ice-candidate', {
          targetId: this.currentPeerId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('Connection state:', state);
      this.emit('connection-state', state);
    };

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      console.log('Received track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.emit('remote-stream', this.remoteStream);
      }
    };

    // Create data channel (initiator only)
    if (isInitiator) {
      this.dataChannel = this.peerConnection.createDataChannel('data', {
        ordered: true
      });
      this.setupDataChannel();
    }

    // Handle incoming data channel
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    // Set up signaling handlers
    this.setupSignalingHandlers();
  },

  setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel open');
      this.emit('data-channel-open');
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
      this.emit('data-channel-close');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.emit('data-message', msg);
      } catch (e) {
        console.error('Invalid data message:', e);
      }
    };
  },

  setupSignalingHandlers() {
    // Handle incoming offer
    Signaling.on('offer', async (data) => {
      if (data.fromId !== this.currentPeerId) return;

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      Signaling.send('answer', {
        targetId: this.currentPeerId,
        answer: answer
      });
    });

    // Handle incoming answer
    Signaling.on('answer', async (data) => {
      if (data.fromId !== this.currentPeerId) return;
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    // Handle ICE candidates
    Signaling.on('ice-candidate', async (data) => {
      if (data.fromId !== this.currentPeerId) return;
      if (data.candidate) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    // Handle hangup
    Signaling.on('hangup', (data) => {
      if (data.fromId !== this.currentPeerId) return;
      this.emit('hangup');
      this.close();
    });
  },

  async startCall() {
    if (!this.peerConnection) return;

    // Get local media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      this.emit('local-stream', this.localStream);

      // Create and send offer (initiator only)
      if (this.isInitiator) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        Signaling.send('offer', {
          targetId: this.currentPeerId,
          offer: offer
        });
      }
    } catch (e) {
      console.error('Error starting call:', e);
      this.emit('error', e);
    }
  },

  async addLocalMedia() {
    try {
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      this.emit('local-stream', this.localStream);
      return this.localStream;
    } catch (e) {
      console.error('Error getting local media:', e);
      throw e;
    }
  },

  toggleAudio() {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  },

  toggleVideo() {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  },

  async startScreenShare() {
    try {
      // Use Electron's desktopCapturer
      if (window.electronAPI) {
        const sources = await window.electronAPI.getSources();
        if (sources.length === 0) {
          throw new Error('No screen sources available');
        }

        // For now, use the first screen source
        this.screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sources[0].id
            }
          }
        });
      } else {
        // Fallback for non-Electron
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });
      }

      // Replace video track
      const screenTrack = this.screenStream.getVideoTracks()[0];
      const sender = this.peerConnection.getSenders().find(s =>
        s.track && s.track.kind === 'video'
      );

      if (sender) {
        await sender.replaceTrack(screenTrack);
      } else {
        this.peerConnection.addTrack(screenTrack, this.screenStream);
      }

      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      this.emit('screen-share-started', this.screenStream);
      return this.screenStream;
    } catch (e) {
      console.error('Error starting screen share:', e);
      throw e;
    }
  },

  async stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;

      // Restore camera video
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find(s =>
          s.track && s.track.kind === 'video'
        );
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      }

      this.emit('screen-share-stopped');
    }
  },

  sendData(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(data));
      return true;
    }
    return false;
  },

  hangup() {
    Signaling.send('hangup', { targetId: this.currentPeerId });
    this.close();
  },

  close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.currentPeerId = null;
    this.emit('closed');
  },

  // Event system
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
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
        console.error('WebRTC listener error:', e);
      }
    });
  }
};

window.WebRTCManager = WebRTCManager;
