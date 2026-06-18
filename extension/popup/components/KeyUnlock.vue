<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../lib/api'

const emit = defineEmits<{ done: []; reset: [] }>()

const passphrase = ref('')
const error = ref('')
const loading = ref(false)

async function handleUnlock() {
  error.value = ''
  loading.value = true
  try {
    const ok = await api.key.unlock(passphrase.value)
    if (ok) {
      emit('done')
    } else {
      error.value = 'Incompatible key detected. Use "Delete key and start over" below, then generate a new RSA key.'
    }
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex-1 flex items-center justify-center p-8">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center">
        <h1 class="text-2xl font-bold">password-store</h1>
        <p class="text-gray-400 mt-1">Enter your master passphrase</p>
      </div>

      <form class="space-y-4" @submit.prevent="handleUnlock">
        <input
          v-model="passphrase"
          type="password"
          placeholder="Master passphrase"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 outline-none"
          autofocus
        />
        <button
          type="submit"
          class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition disabled:opacity-50"
          :disabled="loading || !passphrase"
        >
          {{ loading ? 'Unlocking...' : 'Unlock' }}
        </button>
      </form>

      <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>

      <div class="text-center">
        <button class="text-xs text-gray-500 hover:text-gray-300 underline" @click="emit('reset')">
          Delete key and start over
        </button>
      </div>
    </div>
  </div>
</template>
