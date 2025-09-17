import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Claude API methods
  sendMessage: (message: string) => ipcRenderer.invoke('claude:sendMessage', message),

  // Calendar methods
  getEvents: (timeMin: string, timeMax: string) =>
    ipcRenderer.invoke('calendar:getEvents', { timeMin, timeMax }),

  createEvent: (eventData: any) =>
    ipcRenderer.invoke('calendar:createEvent', eventData),

  // App lifecycle methods
  onAppReady: (callback: () => void) =>
    ipcRenderer.on('app:ready', callback),

  // Window methods
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
})

// Define types for TypeScript
declare global {
  interface Window {
    electronAPI: {
      sendMessage: (message: string) => Promise<string>
      getEvents: (timeMin: string, timeMax: string) => Promise<any[]>
      createEvent: (eventData: any) => Promise<any>
      onAppReady: (callback: () => void) => void
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
    }
  }
}