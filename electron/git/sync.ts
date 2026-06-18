import { execFile } from 'child_process'
import fs from 'fs'

export interface GitStatus {
  modified: string[]
  added: string[]
  deleted: string[]
  ahead: number
  behind: number
}

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'pass-manager',
  GIT_AUTHOR_EMAIL: 'pass@local',
  GIT_COMMITTER_NAME: 'pass-manager',
  GIT_COMMITTER_EMAIL: 'pass@local'
}

function git(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, ...GIT_ENV } }, (err, stdout, stderr) => {
      if (err) {
        const details = (stderr?.trim() || stdout?.trim() || err.stderr?.trim() || err.stdout?.trim() || err.message || String(err)).slice(0, 500)
        reject(new Error(details))
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

export async function initRepo(dir: string) {
  await git(['init', dir], dir)
}

export async function cloneRepo(url: string, dir: string) {
  await git(['clone', url, dir], process.cwd())
}

export async function getStatus(dir: string): Promise<GitStatus> {
  const modified: string[] = []
  const added: string[] = []
  const deleted: string[] = []
  let ahead = 0
  let behind = 0

  try {
    const out = await git(['status', '--porcelain'], dir)
    for (const line of out.split('\n')) {
      if (!line.trim()) continue
      const status = line.slice(0, 2)
      const filepath = line.slice(3)
      if (filepath === '.gpg-key.asc') continue
      if (status.includes('?')) added.push(filepath)
      else if (status.startsWith('D') || status[1] === 'D') deleted.push(filepath)
      else modified.push(filepath)
    }
  } catch {}

  try {
    // Use git rev-list to count ahead/behind
    const local = await git(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], dir)
    const parts = local.split('\t')
    if (parts.length === 2) {
      behind = parseInt(parts[0]) || 0
      ahead = parseInt(parts[1]) || 0
    }
  } catch {}

  return { modified, added, deleted, ahead, behind }
}

export async function addAll(dir: string) {
  await git(['add', '-A'], dir)
}

export async function commit(dir: string, message: string) {
  await git(['commit', '-m', message], dir)
}

export async function pull(dir: string) {
  await git(['pull', '--ff-only', '--rebase=false'], dir)
}

export async function push(dir: string) {
  await git(['push'], dir)
}

export async function getRemotes(dir: string) {
  try {
    const out = await git(['remote', '-v'], dir)
    const remotes: { remote: string; url: string }[] = []
    for (const line of out.split('\n')) {
      const parts = line.match(/^(\S+)\s+(\S+)/)
      if (parts) {
        const exists = remotes.find((r) => r.remote === parts[1])
        if (!exists) {
          remotes.push({ remote: parts[1], url: parts[2] })
        }
      }
    }
    return remotes
  } catch {
    return []
  }
}

export async function addRemote(dir: string, url: string) {
  await git(['remote', 'add', 'origin', url], dir)
}

export async function setRemoteUrl(dir: string, url: string) {
  const existing = await getRemotes(dir)
  if (existing.find((r) => r.remote === 'origin')) {
    await git(['remote', 'set-url', 'origin', url], dir)
  } else {
    await git(['remote', 'add', 'origin', url], dir)
  }
}

export async function hasGitRepo(dir: string) {
  try {
    await git(['rev-parse', '--git-dir'], dir)
    return true
  } catch {
    return false
  }
}

export async function currentBranch(dir: string) {
  try {
    return await git(['rev-parse', '--abbrev-ref', 'HEAD'], dir)
  } catch {
    return null
  }
}
