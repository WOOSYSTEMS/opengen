// Local storage utilities for contacts, messages, settings

const Storage = {
  // Keys
  KEYS: {
    USER: 'opengen_user',
    CONTACTS: 'opengen_contacts',
    MESSAGES: 'opengen_messages',
    BLOCKED: 'opengen_blocked',
    SETTINGS: 'opengen_settings'
  },

  // User data
  saveUser(userData) {
    localStorage.setItem(this.KEYS.USER, JSON.stringify(userData));
  },

  getUser() {
    const data = localStorage.getItem(this.KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  clearUser() {
    localStorage.removeItem(this.KEYS.USER);
  },

  // Contacts
  getContacts() {
    const data = localStorage.getItem(this.KEYS.CONTACTS);
    return data ? JSON.parse(data) : [];
  },

  saveContacts(contacts) {
    localStorage.setItem(this.KEYS.CONTACTS, JSON.stringify(contacts));
  },

  addContact(contact) {
    const contacts = this.getContacts();
    const exists = contacts.find(c => c.id === contact.id);
    if (!exists) {
      contacts.push(contact);
      this.saveContacts(contacts);
    }
    return contacts;
  },

  removeContact(contactId) {
    const contacts = this.getContacts().filter(c => c.id !== contactId);
    this.saveContacts(contacts);
    return contacts;
  },

  updateContact(contactId, updates) {
    const contacts = this.getContacts();
    const index = contacts.findIndex(c => c.id === contactId);
    if (index !== -1) {
      contacts[index] = { ...contacts[index], ...updates };
      this.saveContacts(contacts);
    }
    return contacts;
  },

  // Messages (stored per contact)
  getMessages(contactId) {
    const allMessages = localStorage.getItem(this.KEYS.MESSAGES);
    const messages = allMessages ? JSON.parse(allMessages) : {};
    return messages[contactId] || [];
  },

  saveMessage(contactId, message) {
    const allMessages = localStorage.getItem(this.KEYS.MESSAGES);
    const messages = allMessages ? JSON.parse(allMessages) : {};
    if (!messages[contactId]) {
      messages[contactId] = [];
    }
    messages[contactId].push(message);
    // Keep last 500 messages per contact
    if (messages[contactId].length > 500) {
      messages[contactId] = messages[contactId].slice(-500);
    }
    localStorage.setItem(this.KEYS.MESSAGES, JSON.stringify(messages));
    return messages[contactId];
  },

  clearMessages(contactId) {
    const allMessages = localStorage.getItem(this.KEYS.MESSAGES);
    const messages = allMessages ? JSON.parse(allMessages) : {};
    delete messages[contactId];
    localStorage.setItem(this.KEYS.MESSAGES, JSON.stringify(messages));
  },

  // Block list
  getBlockedUsers() {
    const data = localStorage.getItem(this.KEYS.BLOCKED);
    return data ? JSON.parse(data) : [];
  },

  blockUser(userId) {
    const blocked = this.getBlockedUsers();
    if (!blocked.includes(userId)) {
      blocked.push(userId);
      localStorage.setItem(this.KEYS.BLOCKED, JSON.stringify(blocked));
    }
    return blocked;
  },

  unblockUser(userId) {
    const blocked = this.getBlockedUsers().filter(id => id !== userId);
    localStorage.setItem(this.KEYS.BLOCKED, JSON.stringify(blocked));
    return blocked;
  },

  isBlocked(userId) {
    return this.getBlockedUsers().includes(userId);
  },

  // Settings
  getSettings() {
    const data = localStorage.getItem(this.KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      doNotDisturb: false,
      mutedContacts: []
    };
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  updateSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    this.saveSettings(settings);
    return settings;
  },

  muteContact(contactId) {
    const settings = this.getSettings();
    if (!settings.mutedContacts.includes(contactId)) {
      settings.mutedContacts.push(contactId);
      this.saveSettings(settings);
    }
    return settings;
  },

  unmuteContact(contactId) {
    const settings = this.getSettings();
    settings.mutedContacts = settings.mutedContacts.filter(id => id !== contactId);
    this.saveSettings(settings);
    return settings;
  },

  isContactMuted(contactId) {
    return this.getSettings().mutedContacts.includes(contactId);
  }
};

window.Storage = Storage;
