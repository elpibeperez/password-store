import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerStoreHandlers } from '../ipc/store'
import { registerKeyHandlers } from '../ipc/key'
import { registerGitHandlers } from '../ipc/git'
import { getStatus, addAll, commit, push, hasGitRepo } from '../git/sync'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow() {
  const iconPath = join(__dirname, '../../build/icon.png')

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    },
    show: false,
    titleBarStyle: 'hiddenInset'
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function autoCommitOnClose() {
  const dir = join(app.getPath('home'), '.password-store')
  try {
    const isRepo = await hasGitRepo(dir)
    if (!isRepo) return

    const status = await getStatus(dir)
    const hasChanges =
      status.modified.length > 0 ||
      status.added.length > 0 ||
      status.deleted.length > 0

    if (!hasChanges) return

    await addAll(dir)
    await commit(dir, 'Se cerró sin guardar cambios')
    await push(dir)
  } catch {
    // Silently ignore — app is closing anyway
  }
}

app.whenReady().then(() => {
  registerStoreHandlers()
  registerKeyHandlers()
  registerGitHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', async (event) => {
  if (isQuitting) return
  event.preventDefault()
  isQuitting = true
  await autoCommitOnClose()
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
