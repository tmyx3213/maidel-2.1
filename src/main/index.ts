import { app, BrowserWindow } from 'electron'
import { MaidelApp } from './app'
import path from 'path'

// Enable live reload for Electron in development
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    })
  } catch (err) {
    console.log('electron-reload not found, running without live reload')
  }
}

const maidelApp = new MaidelApp()

app.whenReady().then(async () => {
  try {
    await maidelApp.initialize()
    await maidelApp.createMainWindow()
  } catch (error) {
    console.error('Failed to initialize Maidel 2.1:', error)
    app.quit()
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await maidelApp.createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await maidelApp.shutdown()
})