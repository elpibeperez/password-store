<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  generated: []
  imported: []
}>()

const mode = ref<'generate' | 'import' | null>(null)
const name = ref('')
const email = ref('')
const passphrase = ref('')
const confirmPassphrase = ref('')
const armoredKey = ref('')
const error = ref('')
const loading = ref(false)

async function handleGenerate() {
  if (passphrase.value !== confirmPassphrase.value) {
    error.value = 'Passphrases do not match'
    return
  }
  if (passphrase.value.length < 8) {
    error.value = 'Passphrase must be at least 8 characters'
    return
  }
  if (!name.value || !email.value) {
    error.value = 'Name and email are required'
    return
  }
  error.value = ''
  loading.value = true
  try {
    await window.api.key.generate(name.value, email.value, passphrase.value)
    emit('generated')
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

async function handleImport() {
  if (!armoredKey.value.trim()) {
    error.value = 'Paste your exported GPG private key'
    return
  }
  error.value = ''
  loading.value = true
  try {
    await window.api.key.importKey(armoredKey.value)
    emit('imported')
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex-1 flex items-center justify-center p-8">
    <div class="w-full max-w-md space-y-6">
      <div class="text-center">
        <h1 class="text-2xl font-bold">password-store</h1>
        <p class="text-gray-400 mt-1">Set up your GPG key</p>
      </div>

      <div v-if="!mode" class="space-y-3">
        <button
          class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
          @click="mode = 'generate'"
        >
          Generate new key
        </button>
        <button
          class="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
          @click="mode = 'import'"
        >
          Import existing key
        </button>
      </div>

      <div v-if="mode === 'generate'" class="space-y-4">
        <input
          v-model="name"
          placeholder="Your name"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 outline-none"
        />
        <input
          v-model="email"
          type="email"
          placeholder="Your email"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 outline-none"
        />
        <input
          v-model="passphrase"
          type="password"
          placeholder="Master passphrase (min 8 chars)"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 outline-none"
        />
        <input
          v-model="confirmPassphrase"
          type="password"
          placeholder="Confirm passphrase"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 outline-none"
        />
        <button
          class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition disabled:opacity-50"
          :disabled="loading"
          @click="handleGenerate"
        >
          {{ loading ? 'Generating...' : 'Generate & save' }}
        </button>
        <button class="text-sm text-gray-400 hover:text-white" @click="mode = null">
          Back
        </button>
        <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
      </div>

      <div v-if="mode === 'import'" class="space-y-4">
        <p class="text-sm text-gray-400">
          Export your key with:
          <code class="block mt-1 p-2 bg-gray-800 rounded text-xs">
            gpg --export-secret-keys --armor your@email.com
          </code>
        </p>
        <textarea
          v-model="armoredKey"
          rows="6"
          placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----..."
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 outline-none font-mono text-xs"
        ></textarea>
        <button
          class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition disabled:opacity-50"
          :disabled="loading"
          @click="handleImport"
        >
          {{ loading ? 'Importing...' : 'Import & save' }}
        </button>
        <button class="text-sm text-gray-400 hover:text-white" @click="mode = null">
          Back
        </button>
        <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
      </div>
    </div>
  </div>
</template>
