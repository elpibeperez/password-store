import FS from '@isomorphic-git/lightning-fs'
import * as git from 'isomorphic-git'
import http from './http'

export interface GitStatus {
  modified: string[]
  added: string[]
  deleted: string[]
  ahead: number
  behind: number
}

const fs = new FS('pass-store')
const dir = '/'

// Ensure root directory exists
fs.promises.mkdir(dir).catch(() => {})

let gitToken = ''

export function setToken(token: string) {
  gitToken = token
}

function auth() {
  if (!gitToken) return undefined
  return () => ({ username: gitToken, password: '' })
}

export async function cloneRepo(url: string, token: string) {
  setToken(token)
  await git.clone({
    fs, http, dir,
    url,
    singleBranch: true,
    onAuth: auth()
  })
}

export async function getStatus(): Promise<GitStatus> {
  const modified: string[] = []
  const added: string[] = []
  const deleted: string[] = []
  let ahead = 0
  let behind = 0

  try {
    const matrix = await git.statusMatrix({ fs, dir })
    for (const [filepath, headStatus, workdirStatus, stageStatus] of matrix) {
      if (filepath === '.gpg-key.asc') continue
      if (filepath.startsWith('.')) continue
      if (workdirStatus !== stageStatus || stageStatus !== headStatus) {
        if (workdirStatus === 0) deleted.push(filepath)
        else if (stageStatus === 0) added.push(filepath)
        else modified.push(filepath)
      }
    }
  } catch {}

  try {
    const commits = await git.log({ fs, dir, depth: 1 })
    if (commits.length > 0) ahead = 1
  } catch {}

  return { modified, added, deleted, ahead, behind }
}

export async function addAll() {
  const matrix = await git.statusMatrix({ fs, dir })
  for (const [filepath] of matrix) {
    if (filepath.startsWith('.')) continue
    if (filepath === '.gpg-key.asc') continue
    await git.add({ fs, dir, filepath })
  }
}

export async function commit(message: string) {
  await git.commit({
    fs, dir, message,
    author: { name: 'password-store', email: 'store@local' }
  })
}

export async function pull() {
  await git.pull({
    fs, http, dir,
    author: { name: 'password-store', email: 'store@local' },
    fastForwardOnly: true,
    singleBranch: true,
    onAuth: auth()
  })
}

export async function push() {
  await git.push({
    fs, http, dir,
    onAuth: auth(),
    onAuthFailure: () => { setToken(''); return { cancel: true } }
  })
}

export async function hasRemote() {
  try {
    const remotes = await git.listRemotes({ fs, dir })
    return remotes.length > 0
  } catch {
    return false
  }
}

export async function getRemote() {
  try {
    const remotes = await git.listRemotes({ fs, dir })
    return remotes.find((r) => r.remote === 'origin')?.url ?? null
  } catch {
    return null
  }
}

export async function currentBranch() {
  try {
    return await git.currentBranch({ fs, dir })
  } catch {
    return null
  }
}
