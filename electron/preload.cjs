const { contextBridge, ipcRenderer } = require('electron');

const API = {
  // Window & Mouse Passthrough Control
  setIslandState: (state) => ipcRenderer.invoke('island:setState', state),
  setIgnoreMouseEvents: (ignore, forward) =>
    ipcRenderer.invoke('island:setIgnoreMouseEvents', ignore, forward),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  showItemInFolder: (filePath) => ipcRenderer.invoke('app:showItemInFolder', filePath),

  // Media
  getMedia: () => ipcRenderer.invoke('media:get'),
  controlMedia: (action) => ipcRenderer.invoke('media:control', action),
  onMediaUpdate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('media:update', handler);
    return () => ipcRenderer.removeListener('media:update', handler);
  },

  // Clipboard
  getClipboardHistory: () => ipcRenderer.invoke('clipboard:get'),
  copyClipboardItem: (content) => ipcRenderer.invoke('clipboard:copy', content),
  togglePinClipboard: (id) => ipcRenderer.invoke('clipboard:togglePin', id),
  deleteClipboardItem: (id) => ipcRenderer.invoke('clipboard:delete', id),
  clearClipboard: () => ipcRenderer.invoke('clipboard:clear'),
  onClipboardUpdate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('clipboard:update', handler);
    return () => ipcRenderer.removeListener('clipboard:update', handler);
  },

  // Screenshots
  getScreenshots: () => ipcRenderer.invoke('screenshots:get'),
  deleteScreenshot: (id) => ipcRenderer.invoke('screenshots:delete', id),
  onScreenshotsUpdate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('screenshots:update', handler);
    return () => ipcRenderer.removeListener('screenshots:update', handler);
  },
  onNewScreenshot: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('screenshots:new', handler);
    return () => ipcRenderer.removeListener('screenshots:new', handler);
  },

  // Shelf
  getShelfFiles: () => ipcRenderer.invoke('shelf:get'),
  addShelfFile: (filePath) => ipcRenderer.invoke('shelf:add', filePath),
  removeShelfFile: (id) => ipcRenderer.invoke('shelf:remove', id),
  clearShelf: () => ipcRenderer.invoke('shelf:clear'),
  startDrag: (filePath) => ipcRenderer.send('shelf:startDrag', filePath),
  startApexDrop: (filePath) => ipcRenderer.invoke('drop:startShare', filePath),
  stopApexDrop: () => ipcRenderer.invoke('drop:stopShare'),
  onApexDropDownloaded: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('drop:downloaded', handler);
    return () => ipcRenderer.removeListener('drop:downloaded', handler);
  },
  onShelfUpdate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('shelf:update', handler);
    return () => ipcRenderer.removeListener('shelf:update', handler);
  },

  // System & Power Events
  getSystemStats: () => ipcRenderer.invoke('system:get'),
  getGitStatus: () => ipcRenderer.invoke('git:getStatus'),
  getPing: () => ipcRenderer.invoke('network:getPing'),
  onSystemUpdate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('system:update', handler);
    return () => ipcRenderer.removeListener('system:update', handler);
  },
  onPowerEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('system:power', handler);
    return () => ipcRenderer.removeListener('system:power', handler);
  },

  // Notifications & Agents
  onNewNotification: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('notifications:new', handler);
    return () => ipcRenderer.removeListener('notifications:new', handler);
  },
  onCallStatusChange: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('call:update', handler);
    return () => ipcRenderer.removeListener('call:update', handler);
  },
  onAgentUpdate: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('agent:update', handler);
    return () => ipcRenderer.removeListener('agent:update', handler);
  },

  // Google Calendar & Tasks API
  getGoogleStatus: () => ipcRenderer.invoke('google:getStatus'),
  loginGoogle: (clientId, clientSecret) => ipcRenderer.invoke('google:login', clientId, clientSecret),
  setGoogleIcal: (icalUrl) => ipcRenderer.invoke('google:setIcal', icalUrl),
  logoutGoogle: () => ipcRenderer.invoke('google:logout'),
  getGoogleCalendarEvents: () => ipcRenderer.invoke('google:getCalendarEvents'),
  getGoogleTasks: () => ipcRenderer.invoke('google:getTasks'),
  createGoogleTask: (title) => ipcRenderer.invoke('google:createTask', title),
  toggleGoogleTask: (id, completed) => ipcRenderer.invoke('google:toggleTask', id, completed),
  deleteGoogleTask: (id) => ipcRenderer.invoke('google:deleteTask', id),

  // Global hotkey event
  onToggleHotkey: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('hotkey:toggle', handler);
    return () => ipcRenderer.removeListener('hotkey:toggle', handler);
  },

  // Win32 Deep OS Hooks
  onForegroundApp: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('hook:foreground', handler);
    return () => ipcRenderer.removeListener('hook:foreground', handler);
  },
  onVolumeChange: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('hook:volume', handler);
    return () => ipcRenderer.removeListener('hook:volume', handler);
  },
  onScreenLock: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('hook:screenlock', handler);
    return () => ipcRenderer.removeListener('hook:screenlock', handler);
  },
};

contextBridge.exposeInMainWorld('islandAPI', API);
