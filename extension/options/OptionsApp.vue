<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../popup/lib/api'
import { useSettingsStore } from '../popup/stores/settings'
import SettingsDialog from '../popup/components/SettingsDialog.vue'

const settings = useSettingsStore()

const remoteUrl = ref('')
const gitToken = ref('')
const keyInfo = ref<string>('')
const statusText = ref('')

onMounted(async () => {
  try {
    remoteUrl.value = await api.git.getRemote() ?? ''
    const info = await api.key.getKeyInfo()
    if (info) {
      keyInfo.value = `${info.userIds[0]?.email || 'unknown'} — ${info.fingerprint.slice(0, 16)}…`
    }
  } catch {}
})

async function saveRemote() {
  statusText.value = ''
  try {
    await chrome.storage.sync.set({ gitRemote: remoteUrl.value, gitToken: gitToken.value || undefined })
    statusText.value = 'Saved'
  } catch (e) {
    statusText.value = String(e)
  }
}

async function clearStore() {
  if (!confirm('Delete all password data from IndexedDB?')) return
  await api.key.reset()
  indexedDB.deleteDatabase('pass-store')
  statusText.value = 'Store cleared. Reload the extension.'
}
</script>

<template>
  <div class="max-w-xl mx-auto p-6 space-y-8">
    <h1 class="text-2xl font-bold">password-store Settings</h1>

    <section class="space-y-3">
      <h2 class="text-lg font-semibold">Git remote</h2>
      <input v-model="remoteUrl" placeholder="https://github.com/user/passwords.git"
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none" />
      <p class="text-xs text-gray-500">The remote is stored in the repo. Changing it here also changes the remote URL.</p>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-semibold">Access token</h2>
      <input v-model="gitToken" type="password" placeholder="GitHub/GitLab personal access token"
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none" />
      <p class="text-xs text-gray-500">The token is stored in chrome.storage.sync and passed to isomorphic-git for push/pull.</p>
    </section>

    <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm" @click="saveRemote">
      Save
    </button>
    <p v-if="statusText" class="text-green-400 text-sm">{{ statusText }}</p>

    <section class="space-y-3 pt-4 border-t border-gray-700">
      <h2 class="text-lg font-semibold">Password generator</h2>
      <SettingsDialog />
    </section>

    <section class="space-y-3 pt-4 border-t border-gray-700">
      <h2 class="text-lg font-semibold">Key info</h2>
      <p v-if="keyInfo" class="text-sm text-gray-400">{{ keyInfo }}</p>
      <p v-else class="text-sm text-gray-500">No key unlocked</p>
    </section>

    <section class="space-y-3 pt-4 border-t border-gray-700">
      <h2 class="text-lg font-semibold text-red-400">Danger zone</h2>
      <button class="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm" @click="clearStore">
        Clear all data
      </button>
    </section>
  </div>
</template>
