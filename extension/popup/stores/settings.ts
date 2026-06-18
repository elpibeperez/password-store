import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { defaultOptions, type PasswordOptions } from '../lib/password'

const STORAGE_KEY = 'password-store-settings'

async function loadSettings(): Promise<PasswordOptions> {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY)
    if (result[STORAGE_KEY]) return { ...defaultOptions, ...result[STORAGE_KEY] }
  } catch {}
  return { ...defaultOptions }
}

async function saveSettings(val: PasswordOptions) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: val })
}

export const useSettingsStore = defineStore('settings', () => {
  const password = ref<PasswordOptions>({ ...defaultOptions })

  loadSettings().then((s) => { password.value = s })

  watch(() => ({ ...password.value }), (val) => {
    saveSettings(val)
  }, { deep: true })

  function update(partial: Partial<PasswordOptions>) {
    Object.assign(password.value, partial)
    saveSettings({ ...password.value })
  }

  async function reset() {
    password.value = { ...defaultOptions }
    await saveSettings({ ...defaultOptions })
  }

  return { password, update, reset }
})
