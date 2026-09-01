import { contextBridge, ipcRenderer } from 'electron';

export const API = {
  // Window & Mouse Passthrough Control
  setIslandState: (state: 'compact' | 'glance' | 'expanded') => ipcRenderer.invoke('island:setState', state),
  setIgnoreMouseEvents: (ignore: boolean, forward?: { forward: boolean }) =>
    ipcRenderer.invoke('island:setIgnoreMouseEvents', ignore, forward),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('app:showItemInFolder', filePath),

  // Media
  getMedia: () => ipcRenderer.invoke('media:get'),
  controlMedia: (action: 'play' | 'pause' | 'toggle' | 'next' | 'previous') =>
    ipcRenderer.invoke('media:control', action),
  onMediaUpdate: (callback: (track: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('media:update', handler);
    return () => ipcRenderer.removeListener('media:update', handler);
  },

  // Clipboard
  getClipboardHistory: () => ipcRenderer.invoke('clipboard:get'),
  copyClipboardItem: (content: string) => ipcRenderer.invoke('clipboard:copy', content),
  togglePinClipboard: (id: string) => ipcRenderer.invoke('clipboard:togglePin', id),
  deleteClipboardItem: (id: string) => ipcRenderer.invoke('clipboard:delete', id),
  clearClipboard: () => ipcRenderer.invoke('clipboard:clear'),
  onClipboardUpdate: (callback: (items: any[]) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('clipboard:update', handler);
    return () => ipcRenderer.removeListener('clipboard:update', handler);
  },

  // Screenshots
  getScreenshots: () => ipcRenderer.invoke('screenshots:get'),
  deleteScreenshot: (id: string) => ipcRenderer.invoke('screenshots:delete', id),
  onScreenshotsUpdate: (callback: (items: any[]) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('screenshots:update', handler);
    return () => ipcRenderer.removeListener('screenshots:update', handler);
  },
  onNewScreenshot: (callback: (item: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('screenshots:new', handler);
    return () => ipcRenderer.removeListener('screenshots:new', handler);
  },

  // Shelf
  getShelfFiles: () => ipcRenderer.invoke('shelf:get'),
  addShelfFile: (filePath: string) => ipcRenderer.invoke('shelf:add', filePath),
  removeShelfFile: (id: string) => ipcRenderer.invoke('shelf:remove', id),
  clearShelf: () => ipcRenderer.invoke('shelf:clear'),
  startDrag: (filePath: string) => ipcRenderer.send('shelf:startDrag', filePath),
  onShelfUpdate: (callback: (files: any[]) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('shelf:update', handler);
    return () => ipcRenderer.removeListener('shelf:update', handler);
  },

  // System & Power Events
  getSystemStats: () => ipcRenderer.invoke('system:get'),
  onSystemUpdate: (callback: (stats: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('system:update', handler);
    return () => ipcRenderer.removeListener('system:update', handler);
  },
  onPowerEvent: (callback: (event: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('system:power', handler);
    return () => ipcRenderer.removeListener('system:power', handler);
  },

  // Global hotkey event
  onToggleHotkey: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('hotkey:toggle', handler);
    return () => ipcRenderer.removeListener('hotkey:toggle', handler);
  },

  // Windows Notifications & Live Calls
  onNewNotification: (callback: (notification: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('notifications:new', handler);
    return () => ipcRenderer.removeListener('notifications:new', handler);
  },
  onCallStatusChange: (callback: (call: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('call:update', handler);
    return () => ipcRenderer.removeListener('call:update', handler);
  },
  onAgentUpdate: (callback: (agentState: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('agent:update', handler);
    return () => ipcRenderer.removeListener('agent:update', handler);
  },

  // Win32 Deep OS Hooks
  onForegroundApp: (callback: (info: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('hook:foreground', handler);
    return () => ipcRenderer.removeListener('hook:foreground', handler);
  },
  onVolumeChange: (callback: (vol: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('hook:volume', handler);
    return () => ipcRenderer.removeListener('hook:volume', handler);
  },
  onScreenLock: (callback: (state: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('hook:screenlock', handler);
    return () => ipcRenderer.removeListener('hook:screenlock', handler);
  },
};

contextBridge.exposeInMainWorld('islandAPI', API);
