import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nativeApi } from '../api'
import type { ListEntry, GitStatus, EntryMeta } from '../../extension/lib/types'

function buildTree(entries: ListEntry[]): any[] {
  const nodes = new Map<string, any>()
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
  const roots: any[] = []
  for (const [path, node] of nodes) {
    const slash = path.lastIndexOf('/')
    if (slash === -1) roots.push(node)
    else { const p = nodes.get(path.slice(0, slash)); if (p) p.children.push(node) }
  }
  roots.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
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
  const gitError = ref('')

  const tree = computed(() => buildTree(entries.value))

  const filteredEntries = computed(() => {
    if (!search.value) return []
    const q = search.value.toLowerCase()
    return entries.value.filter((e) => !e.isDir && e.name.toLowerCase().includes(q))
  })

  const isSearching = computed(() => search.value.length > 0)

  async function loadEntries() {
    loading.value = true
    try { entries.value = await nativeApi.store.list() } finally { loading.value = false }
  }

  async function selectEntry(path: string) {
    selectedPath.value = path
    loading.value = true
    try {
      const [decrypted, entryMeta] = await Promise.all([
        nativeApi.store.read(path),
        nativeApi.store.readMeta(path)
      ])
      content.value = decrypted
      meta.value = entryMeta ?? {}
    } catch (e) {
      content.value = `Error: could not decrypt entry\n${e}`
      meta.value = {}
    } finally { loading.value = false }
  }

  async function saveEntry(path: string, text: string) {
    const gpgPath = path.endsWith('.gpg') ? path : `${path}.gpg`
    await nativeApi.store.write(gpgPath, text)
    await loadEntries()
    if (selectedPath.value === gpgPath) content.value = text
  }

  async function saveMeta(data: EntryMeta) {
    if (!selectedPath.value) return
    const gpgPath = selectedPath.value.endsWith('.gpg') ? selectedPath.value : `${selectedPath.value}.gpg`
    await nativeApi.store.writeMeta(gpgPath, data)
    meta.value = { ...meta.value, ...data }
  }

  async function deleteEntry(path: string) {
    const gpgPath = path.endsWith('.gpg') ? path : `${path}.gpg`
    await nativeApi.store.remove(gpgPath)
    if (selectedPath.value === gpgPath || selectedPath.value === path) {
      selectedPath.value = null; content.value = ''; meta.value = {}
    }
    await loadEntries()
  }

  async function deleteFolder(path: string) {
    await nativeApi.store.rmdir(path)
    if (selectedPath.value?.startsWith(path)) {
      selectedPath.value = null; content.value = ''; meta.value = {}
    }
    await loadEntries()
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
  }

  async function refreshGitStatus() {
    gitError.value = ''
    try { gitStatus.value = await nativeApi.git.status() } catch {
      gitStatus.value = { modified: [], added: [], deleted: [], ahead: 0, behind: 0 }
    }
  }

  async function gitCommit(message: string) {
    gitError.value = ''
    try {
      await nativeApi.git.commit(message)
      await refreshGitStatus()
      return true
    } catch (e) { gitError.value = String(e); return false }
  }

  async function gitPull() {
    gitError.value = ''
    try { await nativeApi.git.pull(); await loadEntries(); await refreshGitStatus(); return true }
    catch (e) { gitError.value = String(e); return false }
  }

  async function gitPush() {
    gitError.value = ''
    try { await nativeApi.git.push(); await refreshGitStatus(); return true }
    catch (e) { gitError.value = String(e); return false }
  }

  return {
    entries, search, selectedPath, activeFolder,
    content, meta, loading, gitStatus, gitError,
    tree, filteredEntries, isSearching,
    loadEntries, selectEntry, saveEntry, saveMeta,
    deleteEntry, deleteFolder, copyToClipboard,
    refreshGitStatus, gitCommit, gitPull, gitPush
  }
})
