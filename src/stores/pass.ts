import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ListEntry, GitStatus, KeyInfo, TreeNode, EntryMeta } from '../types'

function buildTree(entries: ListEntry[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  for (const e of entries) {
    const parts = e.path.split('/')
    for (let i = 0; i < parts.length; i++) {
      const itemPath = parts.slice(0, i + 1).join('/')
      if (nodes.has(itemPath)) continue
      if (i < parts.length - 1 || e.isDir) {
        nodes.set(itemPath, { name: parts[i], path: itemPath, isDir: true, children: [] })
      }
    }
    if (!e.isDir) {
      nodes.set(e.path, { name: parts[parts.length - 1], path: e.path, isDir: false, children: [] })
    }
  }
  const roots: TreeNode[] = []
  for (const [path, node] of nodes) {
    const slash = path.lastIndexOf('/')
    if (slash === -1) {
      roots.push(node)
    } else {
      const parent = nodes.get(path.slice(0, slash))
      if (parent) parent.children.push(node)
    }
  }
  function sortNodes(ns: TreeNode[]) {
    ns.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of ns) if (n.isDir) sortNodes(n.children)
  }
  sortNodes(roots)
  return roots
}

export const usePassStore = defineStore('pass', () => {
  const entries = ref<ListEntry[]>([])
  const search = ref('')
  const selectedPath = ref<string | null>(null)
  const activeFolder = ref<string>('')
  const content = ref('')
  const meta = ref<EntryMeta>({})
  const loading = ref(false)
  const gitStatus = ref<GitStatus>({ modified: [], added: [], deleted: [], ahead: 0, behind: 0 })
  const gitRemote = ref<string | null>(null)
  const gitBranch = ref<string | null>(null)
  const hasGitRepo = ref(false)
  const storeExists = ref(false)
  const keyInfo = ref<KeyInfo | null>(null)

  const tree = computed(() => buildTree(entries.value))

  const allEntryNames = computed(() => {
    const names = new Set<string>()
    for (const e of entries.value) {
      if (!e.isDir) names.add(e.name.toLowerCase())
    }
    return names
  })

  const filteredEntries = computed(() => {
    if (!search.value) return []
    const q = search.value.toLowerCase()
    return entries.value.filter((e) => {
      if (e.isDir) return false
      if (e.name.toLowerCase().includes(q)) return true
      return false
    })
  })

  const isSearching = computed(() => search.value.length > 0)

  async function loadEntries() {
    loading.value = true
    try {
      entries.value = await window.api.store.list('')
    } finally {
      loading.value = false
    }
  }

  async function selectEntry(path: string) {
    selectedPath.value = path
    loading.value = true
    try {
      const [encryptedContent, entryMeta] = await Promise.all([
        window.api.store.read(path),
        window.api.store.readMeta(path)
      ])
      content.value = encryptedContent
      meta.value = entryMeta ?? {}
    } catch (e) {
      content.value = `Error: could not decrypt entry\n${e}`
      meta.value = {}
    } finally {
      loading.value = false
    }
  }

  async function saveEntry(path: string, text: string) {
    const gpgPath = path.endsWith('.gpg') ? path : `${path}.gpg`
    await window.api.store.write(gpgPath, text)
    await loadEntries()
    if (selectedPath.value === gpgPath) {
      content.value = text
    }
  }

  async function saveMeta(data: EntryMeta) {
    if (!selectedPath.value) return
    const gpgPath = selectedPath.value.endsWith('.gpg') ? selectedPath.value : `${selectedPath.value}.gpg`
    await window.api.store.writeMeta(gpgPath, data)
    meta.value = { ...meta.value, ...data }
  }

  async function deleteEntry(path: string) {
    const gpgPath = path.endsWith('.gpg') ? path : `${path}.gpg`
    await window.api.store.remove(gpgPath)
    if (selectedPath.value === gpgPath || selectedPath.value === path) {
      selectedPath.value = null
      content.value = ''
      meta.value = {}
    }
    await loadEntries()
  }

  async function deleteFolder(path: string) {
    await window.api.store.rmdir(path)
    if (selectedPath.value?.startsWith(path)) {
      selectedPath.value = null
      content.value = ''
      meta.value = {}
    }
    await loadEntries()
  }

  function searchMatches(e: ListEntry, q: string): boolean {
    if (e.isDir) return false
    if (e.name.toLowerCase().includes(q)) return true
    return false
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
  }

  async function checkStore() {
    const hasStore = await window.api.store.list('')
    storeExists.value = hasStore.length > 0 || true
    const keySetup = await window.api.key.isSetup()
    return { hasStore: storeExists.value, hasKey: keySetup }
  }

  async function cloneRemote(url: string) {
    const result = await window.api.git.clone(url)
    if (!result.success) throw new Error(result.error || 'Clone failed')
    return true
  }

  async function refreshGitRemote() {
    hasGitRepo.value = await window.api.git.hasRepo()
    gitRemote.value = await window.api.git.getRemote()
    gitBranch.value = await window.api.git.branch()
  }

  async function initGit() {
    gitError.value = ''
    const result = await window.api.git.init('')
    if (!result.success) {
      gitError.value = result.error || 'Failed to init git'
      return false
    }
    await refreshGitRemote()
    await refreshGitStatus()
    return true
  }

  async function setGitRemote(url: string) {
    const result = await window.api.git.setRemote(url)
    if (!result.success) throw new Error(result.error || 'Failed to set remote')
    await refreshGitRemote()
  }

  async function refreshGitStatus() {
    try {
      gitStatus.value = await window.api.git.status()
    } catch {
      gitStatus.value = { modified: [], added: [], deleted: [], ahead: 0, behind: 0 }
    }
  }

  async function gitCommit(message: string) {
    gitError.value = ''
    const result = await window.api.git.commit(message)
    if (!result.success) {
      gitError.value = result.error || 'Commit failed'
      return false
    }
    // Also push after commit
    const pushResult = await window.api.git.push()
    if (!pushResult.success) {
      gitError.value = pushResult.error || 'Commit OK, but push failed'
      return false
    }
    await refreshGitStatus()
    return true
  }

  const gitError = ref('')

  async function gitPull() {
    gitError.value = ''
    const result = await window.api.git.pull()
    if (!result.success) {
      gitError.value = result.error || 'Pull failed'
      return false
    }
    await loadEntries()
    await refreshGitStatus()
    return true
  }

  async function gitPush() {
    gitError.value = ''
    const result = await window.api.git.push()
    if (!result.success) {
      gitError.value = result.error || 'Push failed'
      return false
    }
    await refreshGitStatus()
    return true
  }



  async function loadKeyInfo() {
    keyInfo.value = await window.api.key.getKeyInfo()
  }

  return {
    entries, search, selectedPath, activeFolder,
    content, meta, loading, gitStatus, keyInfo,
    tree, filteredEntries, isSearching,
    storeExists, gitRemote, gitBranch, hasGitRepo,
    loadEntries, selectEntry,
    checkStore, cloneRemote,
    refreshGitRemote, setGitRemote, initGit,
    saveEntry, saveMeta,
    deleteEntry, deleteFolder,
    searchMatches,
    copyToClipboard,
    refreshGitStatus, gitCommit, gitPull, gitPush,
    gitError,
    loadKeyInfo
  }
})
