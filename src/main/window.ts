import { BrowserWindow } from 'electron'
import path from 'path'

interface WindowOptions {
  width?: number
  height?: number
}

export function createWindow(options: WindowOptions = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: options.width || 1200,
    height: options.height || 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready-to-show
    icon: path.join(__dirname, '../../assets/icon.png')
  })

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/public/index.html'))
  }

  // Show window when ready to prevent visual flash
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  // Handle external links
  win.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}