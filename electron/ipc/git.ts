import { ipcMain, app } from 'electron'
import { join } from 'path'
import * as gitSync from '../git/sync'

function passDir() {
  return join(app.getPath('home'), '.password-store')
}

function friendlyError(e: unknown): string {
  const msg = String(e)
  if (msg.includes('fast-forward') || msg.includes('Not possible'))
    return 'Your local and remote have diverged. Pull manually via terminal or back up your changes.'
  if (msg.includes('401') || msg.includes('403'))
    return 'Authentication failed. Set up your SSH key or git credential helper.'
  if (msg.includes('Could not read from remote'))
    return 'Could not connect to remote. Check your SSH key and remote URL.'
  return msg.slice(0, 300)
}

export function registerGitHandlers() {
  ipcMain.handle('git:init', async () => {
    try {
      await gitSync.initRepo(passDir())
      await gitSync.addAll(passDir())
      await gitSync.commit(passDir(), 'Initial commit')
      return { success: true }
    } catch (e) {
      return { success: false, error: friendlyError(e) }
    }
  })

  ipcMain.handle('git:clone', async (_event, url: string) => {
    try {
      await gitSync.cloneRepo(url, passDir())
      return { success: true }
    } catch (e) {
      return { success: false, error: friendlyError(e) }
    }
  })

  ipcMain.handle('git:status', async () => {
    try {
      return await gitSync.getStatus(passDir())
    } catch {
      return { modified: [], added: [], deleted: [], ahead: 0, behind: 0 }
    }
  })

  ipcMain.handle('git:pull', async () => {
    try {
      await gitSync.pull(passDir())
      return { success: true }
    } catch (e) {
      return { success: false, error: friendlyError(e) }
    }
  })

  ipcMain.handle('git:push', async () => {
    try {
      await gitSync.push(passDir())
      return { success: true }
    } catch (e) {
      return { success: false, error: friendlyError(e) }
    }
  })

  ipcMain.handle('git:commit', async (_event, message: string) => {
    try {
      await gitSync.addAll(passDir())
      await gitSync.commit(passDir(), message)
      return { success: true }
    } catch (e) {
      return { success: false, error: friendlyError(e) }
    }
  })

  ipcMain.handle('git:getRemote', async () => {
    try {
      const remotes = await gitSync.getRemotes(passDir())
      return remotes.find((r) => r.remote === 'origin')?.url ?? null
    } catch {
      return null
    }
  })

  ipcMain.handle('git:setRemote', async (_event, url: string) => {
    try {
      await gitSync.setRemoteUrl(passDir(), url)
      return { success: true }
    } catch (e) {
      return { success: false, error: friendlyError(e) }
    }
  })

  ipcMain.handle('git:hasRepo', async () => {
    return await gitSync.hasGitRepo(passDir())
  })

  ipcMain.handle('git:branch', async () => {
    return await gitSync.currentBranch(passDir())
  })
}
