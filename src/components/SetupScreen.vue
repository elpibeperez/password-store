<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  clone: [url: string]
  fresh: []
}>()

const repoUrl = ref('')
const mode = ref<'choose' | 'clone-form'>('choose')
const loading = ref(false)
const error = ref('')

async function handleClone() {
  if (!repoUrl.value.trim()) return
  error.value = ''
  loading.value = true
  emit('clone', repoUrl.value.trim())
}
</script>

<template>
  <div class="flex-1 flex items-center justify-center p-8">
    <div class="w-full max-w-md space-y-6">
      <div class="text-center">
        <h1 class="text-2xl font-bold">password-store</h1>
        <p class="text-gray-400 mt-1">No password store found</p>
      </div>

      <div v-if="mode === 'choose'" class="space-y-3">
        <button
          class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
          @click="emit('fresh')"
        >
          Start fresh — generate new key
        </button>
        <button
          class="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
          @click="mode = 'clone-form'"
        >
          Clone from remote repository
        </button>
      </div>

      <div v-if="mode === 'clone-form'" class="space-y-4">
        <p class="text-sm text-gray-400">
          Enter the git URL of an existing password store:
        </p>
        <input
          v-model="repoUrl"
          placeholder="https://github.com/user/passwords.git"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-blue-500 outline-none"
          @keyup.enter="handleClone"
        />
        <button
          class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition disabled:opacity-50"
          :disabled="loading || !repoUrl"
          @click="handleClone"
        >
          {{ loading ? 'Cloning...' : 'Clone' }}
        </button>
        <button class="text-sm text-gray-400 hover:text-white" @click="mode = 'choose'">
          Back
        </button>
        <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
      </div>
    </div>
  </div>
</template>
