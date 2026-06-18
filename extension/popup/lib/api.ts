import type { ListEntry, EntryMeta, GitStatus, KeyInfo } from '../../lib/types'

function createChromeApi() {
  async function send(cmd: string, payload: Record<string, any> = {}): Promise<any> {
    const resp = await chrome.runtime.sendMessage({ cmd, ...payload })
    if (!resp.ok) throw new Error(resp.error || 'Request failed')
    return resp.data
  }
  return {
    store: {
      list: (dir?: string) => send('store:list', { dir }),
      read: (path: string) => send('store:read', { path }),
      write: (path: string, content: string) => send('store:write', { path, content }),
      remove: (path: string) => send('store:remove', { path }),
      mkdir: (dirPath: string) => send('store:mkdir', { dirPath }),
      rmdir: (dirPath: string) => send('store:rmdir', { dirPath }),
      readMeta: (path: string) => send('store:readMeta', { path }),
      writeMeta: (path: string, data: EntryMeta) => send('store:writeMeta', { path, data })
    },
    key: {
      generate: (name: string, email: string, passphrase: string) => send('key:generate', { name, email, passphrase }),
      importKey: (armored: string) => send('key:import', { armored }),
      unlock: (passphrase: string) => send('key:unlock', { passphrase }),
      isSetup: () => send('key:isSetup'),
      isUnlocked: () => send('key:isUnlocked'),
      getKeyInfo: () => send('key:getKeyInfo'),
      reset: () => send('key:reset')
    },
    git: {
      clone: (url: string, token: string) => send('git:clone', { url, token }),
      status: () => send('git:status'),
      pull: () => send('git:pull'),
      push: () => send('git:push'),
      commit: (message: string) => send('git:commit', { message }),
      getRemote: () => send('git:getRemote'),
      branch: () => send('git:branch'),
      hasRemote: () => send('git:hasRemote'),
      setToken: (token: string) => send('git:setToken', { token })
    }
  }
}

// Lazy initialization: detect at call time which backend to use
let chromeApi: any = null

export const api = new Proxy({} as any, {
  get(_, moduleName: string) {
    const target = () => {
      if ((window as any).api) return (window as any).api
      if (!chromeApi) chromeApi = createChromeApi()
      return chromeApi
    }
    const mod = target()
    return mod[moduleName]
  }
})
