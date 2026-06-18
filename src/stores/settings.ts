import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { defaultOptions, type PasswordOptions } from '../lib/password'

const STORAGE_KEY = 'password-store-settings'

function loadSettings(): PasswordOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultOptions, ...JSON.parse(raw) }
  } catch {}
  return { ...defaultOptions }
}

export const useSettingsStore = defineStore('settings', () => {
  const password = ref<PasswordOptions>(loadSettings())

  watch(password.value, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  function update(partial: Partial<PasswordOptions>) {
    Object.assign(password.value, partial)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(password.value))
  }

  function reset() {
    Object.assign(password.value, defaultOptions)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultOptions))
  }

  return { password, update, reset }
})
