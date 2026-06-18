<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { usePassStore } from '../stores/pass'
import { useSettingsStore } from '../stores/settings'
import { generatePassword } from '../lib/password'
import TreeView from './TreeView.vue'
import SettingsDialog from './SettingsDialog.vue'

const store = usePassStore()
const settings = useSettingsStore()

const isEditing = ref(false)
const editContent = ref('')
const editUrl = ref('')
const editUser = ref('')
const editNotes = ref('')
const showPassword = ref(false)
const newName = ref('')
const newPassword = ref('')
const newUrl = ref('')
const newUser = ref('')
const newNotes = ref('')
const showNewEntry = ref(false)
const showNewFolder = ref(false)
const newFolderName = ref('')
const showDelete = ref(false)
const showGitPanel = ref(false)
const showSettings = ref(false)
const commitMessage = ref('')
const nameError = ref('')
const commitSuccess = ref(false)
const sidebarOpen = ref(false)
let commitSuccessTimer = 0

function startEdit() {
  editContent.value = store.content
  editUrl.value = store.meta.url ?? ''
  editUser.value = store.meta.user ?? ''
  editNotes.value = store.meta.notes ?? ''
  isEditing.value = true
}

async function saveEdit() {
  if (!store.selectedPath) return
  const gpgPath = store.selectedPath.endsWith('.gpg') ? store.selectedPath : `${store.selectedPath}.gpg`
  await store.saveEntry(gpgPath, editContent.value)
  await store.saveMeta({ url: editUrl.value || undefined, user: editUser.value || undefined, notes: editNotes.value || undefined })
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
  editContent.value = ''
  editUrl.value = ''
  editUser.value = ''
  editNotes.value = ''
}

async function confirmDelete() {
  if (!store.selectedPath) return
  await store.deleteEntry(store.selectedPath)
  showDelete.value = false
}

async function addEntry() {
  nameError.value = ''
  if (!newName.value.trim()) { nameError.value = 'Entry path is required'; return }
  if (!newPassword.value) { nameError.value = 'Password is required'; return }
  const path = newName.value.endsWith('.gpg') ? newName.value : `${newName.value}.gpg`
  await store.saveEntry(path, newPassword.value + '\n')
  await store.saveMeta({ url: newUrl.value || undefined, user: newUser.value || undefined, notes: newNotes.value || undefined })
  newName.value = ''; newPassword.value = ''; newUrl.value = ''; newUser.value = ''; newNotes.value = ''
  nameError.value = ''; showNewEntry.value = false
}

async function handleCreateFolder() {
  if (!newFolderName.value) return
  const dir = newFolderName.value.replace(/\.gpg$/, '')
  await store.mkdir(dir)
  newFolderName.value = ''
  showNewFolder.value = false
  await store.loadEntries()
}

function generateForEdit() { editContent.value = generatePassword(settings.password) }
function generateForNew() { newPassword.value = generatePassword(settings.password) }

async function copyPassword() {
  const firstLine = store.content.split('\n')[0]
  if (firstLine) await store.copyToClipboard(firstLine)
}

async function handleCommit() {
  store.gitError = ''
  commitSuccess.value = false
  clearTimeout(commitSuccessTimer)
  try {
    const ok = await store.gitCommit(commitMessage.value || 'Update passwords')
    if (ok) {
      commitMessage.value = ''
      commitSuccess.value = true
      commitSuccessTimer = window.setTimeout(() => { commitSuccess.value = false }, 3000)
    }
  } catch (e) { store.gitError = String(e) }
}

onMounted(async () => {
  await store.loadEntries()
  await store.refreshGitStatus()
  await store.refreshGitRemote()
  await store.loadKeyInfo()
})

watch(() => store.selectedPath, () => { isEditing.value = false; sidebarOpen.value = false })
</script>

<template>
  <div class="flex-1 flex overflow-hidden relative">
    <!-- Sidebar overlay backdrop (mobile) -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/50 z-30 md:hidden" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside
      class="w-52 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 transition-transform duration-200 md:relative fixed z-40 h-full md:h-auto"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
    >
      <div class="p-2 border-b border-gray-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button class="md:hidden p-1 hover:bg-gray-700 rounded text-xs" @click="sidebarOpen = false">&#10005;</button>
          <h1 class="text-base font-bold">pass</h1>
        </div>
        <div class="flex gap-0.5">
          <button class="p-1 hover:bg-gray-700 rounded text-xs" title="New entry" @click="newName = store.activeFolder ? store.activeFolder + '/' : ''; showNewEntry = true">&#128221;</button>
          <button class="p-1 hover:bg-gray-700 rounded text-xs" title="New folder" @click="newFolderName = store.activeFolder ? store.activeFolder + '/' : ''; showNewFolder = true">&#128193;</button>
          <button class="p-1 bg-green-700 hover:bg-green-600 rounded-full text-xs w-6 h-6 flex items-center justify-center" title="Pull" @click="store.gitPull()">&#x21bb;</button>
          <button class="p-1 hover:bg-gray-700 rounded text-xs" title="Git sync" @click="showGitPanel = !showGitPanel">&#128190;</button>
          <button class="p-1 hover:bg-gray-700 rounded text-xs" title="Settings" @click="showSettings = true">&#9881;</button>
        </div>
      </div>
      <div class="p-2">
        <input v-model="store.search" placeholder="Search..." class="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs focus:border-blue-500 outline-none" />
      </div>
      <nav class="flex-1 overflow-y-auto px-1 py-1">
        <div v-if="store.isSearching">
          <div v-for="entry in store.filteredEntries" :key="entry.path"
            class="flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs hover:bg-gray-800"
            :class="{ 'bg-gray-800 text-blue-400': store.selectedPath === entry.path }"
            @click="store.selectEntry(entry.path)">
            <span class="text-gray-500">&#128269;</span>
            <span class="truncate">{{ entry.path.replace('.gpg', '') }}</span>
          </div>
          <div v-if="store.filteredEntries.length === 0" class="text-gray-500 text-xs text-center mt-3">No results</div>
        </div>
        <div v-else>
          <TreeView :nodes="store.tree" :selectedPath="store.selectedPath"
            @select="(p) => { const i = p.lastIndexOf('/'); store.activeFolder = i > 0 ? p.slice(0, i) : ''; store.selectEntry(p); sidebarOpen = false }"
            @selectFolder="(p) => store.activeFolder = p"
            @deleteFolder="(p) => store.deleteFolder(p)" />
          <div v-if="store.tree.length === 0" class="text-gray-500 text-xs text-center mt-3">Empty store</div>
        </div>
      </nav>
    </aside>

    <!-- Main -->
    <main class="flex-1 flex flex-col overflow-hidden">
      <!-- Mobile header with hamburger -->
      <div class="md:hidden p-2 border-b border-gray-800 flex items-center gap-2 bg-gray-900">
        <button class="p-1 hover:bg-gray-700 rounded text-sm" @click="sidebarOpen = true">&#9776;</button>
        <h1 class="text-sm font-bold flex-1 truncate">{{ store.selectedPath?.replace('.gpg', '') || 'pass' }}</h1>
        <button class="p-1 hover:bg-gray-700 rounded text-xs" @click="showGitPanel = !showGitPanel">&#128190;</button>
      </div>

      <!-- Content -->
      <div v-if="store.selectedPath && !showNewEntry && !showNewFolder" class="flex-1 flex flex-col p-3 overflow-y-auto">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-bold truncate hidden md:block">{{ store.selectedPath.replace('.gpg', '') }}</h2>
          <div class="flex gap-1">
            <button v-if="!isEditing" class="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-xs" @click="startEdit">Edit</button>
            <button v-if="!isEditing" class="px-2 py-0.5 bg-red-700 hover:bg-red-600 rounded text-xs" @click="showDelete = true">Delete</button>
          </div>
        </div>

        <div v-if="!isEditing" class="space-y-2 text-xs">
          <div v-if="store.meta.url" class="flex gap-1">
            <span class="text-gray-400 shrink-0">URL:</span>
            <a :href="store.meta.url" target="_blank" class="text-blue-400 hover:underline truncate">{{ store.meta.url }}</a>
          </div>
          <div v-if="store.meta.user" class="flex gap-1">
            <span class="text-gray-400 shrink-0">User:</span>
            <span class="truncate">{{ store.meta.user }}</span>
          </div>
          <div>
            <div class="flex items-center gap-1 mb-0.5">
              <span class="text-gray-400">Password:</span>
              <button class="p-0.5 hover:bg-gray-700 rounded" title="Toggle" @click="showPassword = !showPassword">{{ showPassword ? '&#128065;' : '&#128064;' }}</button>
              <button class="p-0.5 hover:bg-gray-700 rounded" title="Copy" @click="copyPassword">&#128203;</button>
            </div>
            <pre v-if="showPassword" class="bg-gray-900 rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap">{{ store.content }}</pre>
            <pre v-else class="bg-gray-900 rounded p-2 text-xs select-none text-gray-500">&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</pre>
          </div>
          <div v-if="store.meta.notes">
            <span class="text-gray-400">Notes:</span>
            <div class="bg-gray-900 rounded p-2 mt-0.5 text-xs whitespace-pre-wrap">{{ store.meta.notes }}</div>
          </div>
        </div>

        <div v-if="isEditing" class="flex-1 flex flex-col gap-2 text-xs">
          <div><label class="text-gray-400">URL</label><input v-model="editUrl" class="w-full px-2 py-1 mt-0.5 bg-gray-800 border border-gray-700 rounded focus:border-blue-500 outline-none" /></div>
          <div><label class="text-gray-400">User</label><input v-model="editUser" class="w-full px-2 py-1 mt-0.5 bg-gray-800 border border-gray-700 rounded focus:border-blue-500 outline-none" /></div>
          <div class="flex-1 flex flex-col">
            <div class="flex justify-between"><label class="text-gray-400">Password</label><button class="text-blue-400 hover:text-blue-300" @click="generateForEdit">&#9889; Generate</button></div>
            <textarea v-model="editContent" class="flex-1 w-full mt-0.5 bg-gray-800 border border-gray-700 rounded p-2 font-mono text-xs outline-none focus:border-blue-500 resize-none"></textarea>
          </div>
          <div><label class="text-gray-400">Notes</label><textarea v-model="editNotes" rows="2" class="w-full mt-0.5 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs outline-none focus:border-blue-500 resize-none"></textarea></div>
          <div class="flex gap-2">
            <button class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs" @click="saveEdit">Save</button>
            <button class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs" @click="cancelEdit">Cancel</button>
          </div>
        </div>
      </div>
      <div v-else class="flex-1 flex items-center justify-center text-gray-500 text-xs">Select an entry</div>
    </main>
  </div>

  <!-- Dialogs adapted for mobile -->
  <div v-if="showNewEntry" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2" @click.self="showNewEntry = false">
    <div class="bg-gray-900 rounded-xl p-4 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
      <h2 class="text-sm font-bold">New entry</h2>
      <input v-model="newName" placeholder="Path (e.g. websites/github)" class="w-full px-3 py-2 bg-gray-800 border rounded text-sm outline-none"
        :class="nameError ? 'border-red-500' : 'border-gray-700 focus:border-blue-500'" @input="nameError = ''" />
      <input v-model="newUrl" placeholder="URL" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm outline-none focus:border-blue-500" />
      <input v-model="newUser" placeholder="Username" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm outline-none focus:border-blue-500" />
      <div><div class="flex justify-between mb-0.5"><label class="text-gray-400 text-sm">Password</label><button class="text-blue-400 text-sm" @click="generateForNew">&#9889; Generate</button></div>
      <textarea v-model="newPassword" rows="2" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm outline-none font-mono focus:border-blue-500"></textarea></div>
      <textarea v-model="newNotes" rows="2" placeholder="Notes" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm outline-none"></textarea>
      <p v-if="nameError" class="text-red-400 text-sm">{{ nameError }}</p>
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showNewEntry = false">Cancel</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" @click="addEntry">Create</button>
      </div>
    </div>
  </div>

  <div v-if="showNewFolder" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2" @click.self="showNewFolder = false">
    <div class="bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3">
      <h2 class="text-sm font-bold">New folder</h2>
      <input v-model="newFolderName" placeholder="Folder name" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm outline-none focus:border-blue-500" @keyup.enter="handleCreateFolder" />
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showNewFolder = false">Cancel</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" @click="handleCreateFolder">Create</button>
      </div>
    </div>
  </div>

  <div v-if="showDelete" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2" @click.self="showDelete = false">
    <div class="bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3">
      <h2 class="text-sm font-bold">Delete entry?</h2>
      <p class="text-sm text-gray-400">{{ store.selectedPath?.replace('.gpg', '') }}</p>
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showDelete = false">Cancel</button>
        <button class="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm" @click="confirmDelete">Delete</button>
      </div>
    </div>
  </div>

  <!-- Settings dialog -->
  <div v-if="showSettings" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2" @click.self="showSettings = false">
    <div class="bg-gray-900 rounded-xl p-4 w-full max-w-md max-h-[85vh] overflow-y-auto space-y-3">
      <div class="flex items-center justify-between"><h2 class="text-sm font-bold">Settings</h2><button class="text-gray-400 hover:text-white text-sm" @click="showSettings = false">&#10005;</button></div>
      <SettingsDialog />
    </div>
  </div>

  <!-- Git panel (full screen on mobile) -->
  <div v-if="showGitPanel" class="fixed inset-0 z-50" @click.self="showGitPanel = false">
    <div class="bg-gray-900 h-full p-3 overflow-y-auto space-y-3 text-xs md:w-72 md:ml-auto" @click.stop>
      <div class="flex justify-between items-center"><h2 class="text-sm font-bold">Git sync</h2><button class="text-gray-400 hover:text-white" @click="showGitPanel = false">&#10005;</button></div>
      <div class="space-y-0.5"><div class="flex justify-between"><span class="text-gray-400">Branch:</span><span>{{ store.gitBranch || '—' }}</span></div>
      <div class="flex justify-between"><span class="text-gray-400">Remote:</span><span class="truncate max-w-[160px]">{{ store.gitRemote || '—' }}</span></div></div>
      <div class="text-gray-400 space-y-0.5">
        <div>Modified: {{ store.gitStatus.modified.length }}</div>
        <div>Added: {{ store.gitStatus.added.length }}</div>
        <div>Deleted: {{ store.gitStatus.deleted.length }}</div>
      </div>
      <div class="flex gap-1">
        <input v-model="commitMessage" placeholder="Commit message" class="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs focus:border-blue-500 outline-none" @keyup.enter="handleCommit" />
        <button class="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs disabled:opacity-50" :disabled="!commitMessage" @click="handleCommit">&#10003;</button>
      </div>
      <div class="flex gap-1">
        <button class="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs" @click="store.gitPull()">&#9664; Pull</button>
        <button class="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs" @click="store.gitPush()">Push &#9654;</button>
      </div>
      <p v-if="commitSuccess" class="text-green-400 text-xs">&#10003; Committed & pushed</p>
      <p v-if="store.gitError" class="text-red-400 text-xs">{{ store.gitError }}</p>
    </div>
  </div>
</template>
