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

let commitSuccessTimer = 0
const remoteUrl = ref('')
const showSetRemote = ref(false)
const showExportGpg = ref(false)

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
  if (!newName.value.trim()) {
    nameError.value = 'Entry path is required'
    return
  }
  if (!newPassword.value) {
    nameError.value = 'Password is required'
    return
  }
  const path = newName.value.endsWith('.gpg') ? newName.value : `${newName.value}.gpg`
  await store.saveEntry(path, newPassword.value + '\n')
  await window.api.store.writeMeta(path, {
    url: newUrl.value || undefined,
    user: newUser.value || undefined,
    notes: newNotes.value || undefined
  })
  newName.value = ''
  newPassword.value = ''
  newUrl.value = ''
  newUser.value = ''
  newNotes.value = ''
  nameError.value = ''
  showNewEntry.value = false
}

async function handleCreateFolder() {
  if (!newFolderName.value) return
  const dir = newFolderName.value.replace(/\.gpg$/, '')
  await window.api.store.mkdir(dir)
  newFolderName.value = ''
  showNewFolder.value = false
  await store.loadEntries()
}

function generateForEdit() {
  editContent.value = generatePassword(settings.password)
}

function generateForNew() {
  newPassword.value = generatePassword(settings.password)
}

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
  } catch (e) {
    store.gitError = String(e)
  }
}

async function handleSetRemote() {
  if (!remoteUrl.value) return
  await store.setGitRemote(remoteUrl.value)
  remoteUrl.value = ''
  showSetRemote.value = false
}

async function handleExportGpg() {
  await window.api.key.exportToGnuPG()
  showExportGpg.value = false
}

onMounted(async () => {
  await store.loadEntries()
  await store.refreshGitStatus()
  await store.refreshGitRemote()
  await store.loadKeyInfo()
})

watch(() => store.selectedPath, () => { isEditing.value = false })
</script>

<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div class="p-3 border-b border-gray-800 flex items-center justify-between">
        <h1 class="text-lg font-bold">pass</h1>
        <div class="flex gap-1">
          <button class="p-1.5 hover:bg-gray-700 rounded text-sm" title="New entry" @click="newName = store.activeFolder ? store.activeFolder + '/' : ''; showNewEntry = true">
            &#128221;
          </button>
          <button class="p-1.5 hover:bg-gray-700 rounded text-sm" title="New folder" @click="newFolderName = store.activeFolder ? store.activeFolder + '/' : ''; showNewFolder = true">
            &#128193;
          </button>
          <button class="p-1.5 bg-green-700 hover:bg-green-600 rounded-full text-sm w-7 h-7 flex items-center justify-center" title="Pull (sync)" @click="store.gitPull()">
            &#x21bb;
          </button>
          <button class="p-1.5 hover:bg-gray-700 rounded text-sm" title="Git sync" @click="showGitPanel = !showGitPanel">
            &#128190;
          </button>
          <button class="p-1.5 hover:bg-gray-700 rounded text-sm" title="Settings" @click="showSettings = true">
            &#9881;
          </button>
        </div>
      </div>

      <div class="p-3">
        <input v-model="store.search" placeholder="Search..." class="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:border-blue-500 outline-none" />
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-1">
        <div v-if="store.isSearching">
          <div v-for="entry in store.filteredEntries" :key="entry.path"
            class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm hover:bg-gray-800"
            :class="{ 'bg-gray-800 text-blue-400': store.selectedPath === entry.path }"
            @click="store.selectEntry(entry.path)">
            <span class="text-gray-500">&#128269;</span>
            <span class="truncate">{{ entry.path.replace('.gpg', '') }}</span>
          </div>
          <div v-if="store.filteredEntries.length === 0" class="text-gray-500 text-sm text-center mt-4">No results</div>
        </div>
        <div v-else>
          <TreeView :nodes="store.tree" :selectedPath="store.selectedPath"
            @select="(p) => { const i = p.lastIndexOf('/'); store.activeFolder = i > 0 ? p.slice(0, i) : ''; store.selectEntry(p) }"
            @selectFolder="(p) => store.activeFolder = p"
            @deleteFolder="store.deleteFolder" />
          <div v-if="store.tree.length === 0" class="text-gray-500 text-sm text-center mt-4">Empty store</div>
        </div>
      </nav>

      <div v-if="store.keyInfo" class="p-3 border-t border-gray-800 text-xs text-gray-500 truncate">
        {{ store.keyInfo.userIds[0]?.email }}
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 flex flex-col">
      <div v-if="store.selectedPath && !showNewEntry && !showNewFolder" class="flex-1 flex flex-col p-6 overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold truncate">{{ store.selectedPath.replace('.gpg', '') }}</h2>
          <div class="flex gap-2">
            <button v-if="!isEditing" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm" @click="startEdit">Edit</button>
            <button v-if="!isEditing" class="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm" @click="showDelete = true">Delete</button>
          </div>
        </div>

        <!-- View mode -->
        <div v-if="!isEditing" class="space-y-4">
          <div v-if="store.meta.url" class="flex items-center gap-2">
            <span class="text-gray-400 text-sm w-16">URL:</span>
            <a :href="store.meta.url" target="_blank" class="text-blue-400 hover:underline text-sm truncate">{{ store.meta.url }}</a>
          </div>
          <div v-if="store.meta.user" class="flex items-center gap-2">
            <span class="text-gray-400 text-sm w-16">User:</span>
            <span class="text-sm">{{ store.meta.user }}</span>
          </div>
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-gray-400 text-sm">Password:</span>
              <button class="p-1 hover:bg-gray-700 rounded text-xs" title="Toggle visibility" @click="showPassword = !showPassword">
                {{ showPassword ? '&#128065;' : '&#128064;' }}
              </button>
              <button class="p-1 hover:bg-gray-700 rounded text-xs" title="Copy password" @click="copyPassword">&#128203;</button>
            </div>
            <pre v-if="showPassword" class="bg-gray-900 rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap">{{ store.content }}</pre>
            <pre v-else class="bg-gray-900 rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap select-none text-gray-500">&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</pre>
          </div>
          <div v-if="store.meta.notes">
            <span class="text-gray-400 text-sm">Notes:</span>
            <div class="bg-gray-900 rounded-lg p-4 mt-1 text-sm whitespace-pre-wrap">{{ store.meta.notes }}</div>
          </div>
        </div>

        <!-- Edit mode -->
        <div v-if="isEditing" class="flex-1 flex flex-col gap-4">
          <div>
            <label class="text-gray-400 text-sm">URL</label>
            <input v-model="editUrl" placeholder="https://..." class="w-full px-3 py-2 mt-1 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label class="text-gray-400 text-sm">User</label>
            <input v-model="editUser" placeholder="Username" class="w-full px-3 py-2 mt-1 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none" />
          </div>
          <div class="flex-1 flex flex-col">
            <div class="flex items-center justify-between">
              <label class="text-gray-400 text-sm">Password</label>
              <button class="text-xs text-blue-400 hover:text-blue-300" @click="generateForEdit">&#9889; Generate</button>
            </div>
            <textarea v-model="editContent" class="flex-1 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-4 font-mono text-sm outline-none focus:border-blue-500 resize-none"></textarea>
          </div>
          <div>
            <label class="text-gray-400 text-sm">Notes</label>
            <textarea v-model="editNotes" rows="3" placeholder="Optional notes" class="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none resize-none"></textarea>
          </div>
          <div class="flex gap-2">
            <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" @click="saveEdit">Save</button>
            <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="cancelEdit">Cancel</button>
          </div>
        </div>
      </div>

      <div v-else class="flex-1 flex items-center justify-center text-gray-500">
        Select an entry or create a new one
      </div>
    </main>
  </div>

  <!-- New entry dialog -->
  <div v-if="showNewEntry" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showNewEntry = false">
    <div class="bg-gray-900 rounded-xl p-6 w-full max-w-md space-y-4">
      <h2 class="text-lg font-bold">New entry</h2>
      <input v-model="newName" placeholder="Path (e.g. websites/github)"
        class="w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm focus:outline-none"
        :class="nameError ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-blue-500'"
        @input="nameError = ''" />
      <input v-model="newUrl" placeholder="URL (optional)" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none" />
      <input v-model="newUser" placeholder="Username (optional)" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none" />
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-gray-400 text-xs">Password</label>
          <button class="text-xs text-blue-400 hover:text-blue-300" @click="generateForNew">&#9889; Generate</button>
        </div>
        <textarea v-model="newPassword" rows="2" placeholder="Password" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none font-mono"></textarea>
      </div>
      <textarea v-model="newNotes" rows="2" placeholder="Notes (optional)" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none"></textarea>
      <p v-if="nameError" class="text-red-400 text-sm">{{ nameError }}</p>
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showNewEntry = false">Cancel</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" @click="addEntry">Create</button>
      </div>
    </div>
  </div>

  <!-- New folder dialog -->
  <div v-if="showNewFolder" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showNewFolder = false">
    <div class="bg-gray-900 rounded-xl p-6 w-full max-w-sm space-y-4">
      <h2 class="text-lg font-bold">New folder</h2>
      <input v-model="newFolderName" placeholder="Folder name (e.g. websites)" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none" @keyup.enter="handleCreateFolder" />
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showNewFolder = false">Cancel</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" @click="handleCreateFolder">Create</button>
      </div>
    </div>
  </div>

  <!-- Delete dialog -->
  <div v-if="showDelete" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showDelete = false">
    <div class="bg-gray-900 rounded-xl p-6 w-full max-w-sm space-y-4">
      <h2 class="text-lg font-bold">Delete entry?</h2>
      <p class="text-sm text-gray-400">{{ store.selectedPath?.replace('.gpg', '') }}</p>
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showDelete = false">Cancel</button>
        <button class="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm" @click="confirmDelete">Delete</button>
      </div>
    </div>
  </div>

  <!-- Settings dialog -->
  <div v-if="showSettings" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showSettings = false">
    <div class="bg-gray-900 rounded-xl p-6 w-full max-w-sm space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">Settings</h2>
        <button class="text-gray-400 hover:text-white" @click="showSettings = false">&#10005;</button>
      </div>
      <SettingsDialog />
    </div>
  </div>

  <!-- Git panel -->
  <div v-if="showGitPanel" class="fixed inset-0 bg-black/50 flex justify-end z-50" @click.self="showGitPanel = false">
    <div class="w-80 bg-gray-900 h-full p-4 overflow-y-auto space-y-4" @click.stop>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">Git sync</h2>
        <button class="text-gray-400 hover:text-white" @click="showGitPanel = false">&#10005;</button>
      </div>
      <div class="text-sm space-y-1">
        <div class="flex justify-between"><span class="text-gray-400">Branch:</span><span class="text-gray-200">{{ store.gitBranch || '—' }}</span></div>
        <div class="flex justify-between"><span class="text-gray-400">Remote:</span><span class="text-gray-200 truncate max-w-[180px]">{{ store.gitRemote || '—' }}</span></div>
      </div>
      <div class="text-sm text-gray-400 space-y-1">
        <div>Modified: {{ store.gitStatus.modified.length }}</div>
        <div>Added: {{ store.gitStatus.added.length }}</div>
        <div>Deleted: {{ store.gitStatus.deleted.length }}</div>
        <div>Ahead: {{ store.gitStatus.ahead }} / Behind: {{ store.gitStatus.behind }}</div>
      </div>
      <div v-if="!store.hasGitRepo" class="space-y-2">
        <button class="w-full px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm" @click="store.initGit()">Initialize git repo</button>
      </div>
      <div v-if="!store.gitRemote && store.hasGitRepo" class="space-y-2">
        <button class="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showSetRemote = true">Set remote</button>
      </div>
      <div class="flex gap-1">
        <input v-model="commitMessage" placeholder="Commit message" class="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:border-blue-500 outline-none" @keyup.enter="handleCommit" />
        <button class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm disabled:opacity-50" :disabled="!commitMessage" @click="handleCommit">&#10003;</button>
      </div>
      <div class="flex gap-1">
        <button class="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="store.gitPull()">&#9664; Pull</button>
        <button class="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="store.gitPush()">Push &#9654;</button>
        <button class="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="store.refreshGitStatus(); store.refreshGitRemote()">Refresh</button>
      </div>
      <hr class="border-gray-700" />
      <div>
        <button class="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showExportGpg = true">Export key to ~/.gnupg/ (for pass CLI)</button>
      </div>
      <p v-if="commitSuccess" class="text-green-400 text-xs">&#10003; Committed & pushed successfully</p>
      <p v-if="store.gitError" class="text-red-400 text-xs">{{ store.gitError }}</p>
    </div>
  </div>

  <!-- Set remote dialog -->
  <div v-if="showSetRemote" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showSetRemote = false">
    <div class="bg-gray-900 rounded-xl p-6 w-full max-w-sm space-y-4">
      <h2 class="text-lg font-bold">Set remote</h2>
      <input v-model="remoteUrl" placeholder="https://github.com/user/repo.git" class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none" @keyup.enter="handleSetRemote" />
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showSetRemote = false">Cancel</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" @click="handleSetRemote">Save</button>
      </div>
    </div>
  </div>

  <!-- Export GPG dialog -->
  <div v-if="showExportGpg" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showExportGpg = false">
    <div class="bg-gray-900 rounded-xl p-6 w-full max-w-sm space-y-4">
      <h2 class="text-lg font-bold">Export key to GPG</h2>
      <p class="text-sm text-gray-400">This will import your private key into ~/.gnupg/ so you can use <code class="text-gray-200">pass</code> from the terminal.</p>
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm" @click="showExportGpg = false">Cancel</button>
        <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm" @click="handleExportGpg">Export</button>
      </div>
    </div>
  </div>
</template>
