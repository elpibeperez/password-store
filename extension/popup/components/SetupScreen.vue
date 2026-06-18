<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../lib/api'

const emit = defineEmits<{
  ready: []
}>()

const repoUrl = ref('')
const gitToken = ref('')
const mode = ref<'choose' | 'clone-form' | 'cloning'>('choose')
const error = ref('')


async function handleClone() {
  if (!repoUrl.value.trim()) return
  error.value = ''
  mode.value = 'cloning'
  try {
    await api.git.clone(repoUrl.value.trim(), gitToken.value.trim())
    const hasKey = await api.key.isSetup()
    if (hasKey) {
      emit('ready')
    } else {
      error.value = 'Repo cloned, but no .gpg-key.asc found. Generate a new key to continue.'
      mode.value = 'clone-form'
    }
  } catch (e) {
    error.value = String(e)
    mode.value = 'clone-form'
  }
}

</script>

<template>
  <div class="flex-1 flex items-center justify-center p-6">
    <div class="w-full max-w-sm space-y-5">
      <div class="text-center">
        <h1 class="text-xl font-bold">password-store</h1>
        <p class="text-gray-400 text-sm mt-1">No password store found</p>
      </div>

      <div v-if="mode === 'choose'" class="space-y-3">
        <button class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition text-sm" @click="emit('ready')">
          Start fresh — generate new key
        </button>
        <button class="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition text-sm" @click="mode = 'clone-form'">
          Clone from remote repository
        </button>
      </div>

      <div v-if="mode === 'clone-form'" class="space-y-3">
        <p class="text-xs text-gray-400">HTTPS repo URL and access token:</p>
        <input v-model="repoUrl" placeholder="https://github.com/user/passwords.git"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs focus:border-blue-500 outline-none" />
        <input v-model="gitToken" type="password" placeholder="Git token (classic PAT)"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs focus:border-blue-500 outline-none" />
        <button class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-sm disabled:opacity-50"
          :disabled="!repoUrl" @click="handleClone">
          Clone
        </button>
        <button class="text-xs text-gray-400 hover:text-white" @click="mode = 'choose'">Back</button>
        <p v-if="error" class="text-red-400 text-xs">{{ error }}</p>
      </div>

      <div v-if="mode === 'cloning'" class="text-center text-gray-400 text-sm">
        Cloning repository...
      </div>
    </div>
  </div>
</template>
