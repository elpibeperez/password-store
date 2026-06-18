<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <div class="space-y-5">
    <div>
      <label class="text-gray-400 text-sm">Password length: <span class="text-white font-mono">{{ settings.password.length }}</span></label>
      <input
        type="range"
        min="4"
        max="128"
        :value="settings.password.length"
        class="w-full mt-1 accent-blue-500"
        @input="settings.update({ length: parseInt(($event.target as HTMLInputElement).value) })"
      />
      <div class="flex justify-between text-xs text-gray-500">
        <span>4</span><span>128</span>
      </div>
    </div>

    <label class="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" :checked="settings.password.uppercase" class="accent-blue-500" @change="settings.update({ uppercase: ($event.target as HTMLInputElement).checked })" />
      <span class="text-sm">Uppercase (A-Z)</span>
    </label>

    <label class="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" :checked="settings.password.lowercase" class="accent-blue-500" @change="settings.update({ lowercase: ($event.target as HTMLInputElement).checked })" />
      <span class="text-sm">Lowercase (a-z)</span>
    </label>

    <label class="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" :checked="settings.password.numbers" class="accent-blue-500" @change="settings.update({ numbers: ($event.target as HTMLInputElement).checked })" />
      <span class="text-sm">Numbers (0-9)</span>
    </label>

    <label class="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" :checked="settings.password.symbols" class="accent-blue-500" @change="settings.update({ symbols: ($event.target as HTMLInputElement).checked })" />
      <span class="text-sm">Symbols (!@#$%...)</span>
    </label>

    <label class="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" :checked="settings.password.excludeAmbiguous" class="accent-blue-500" @change="settings.update({ excludeAmbiguous: ($event.target as HTMLInputElement).checked })" />
      <span class="text-sm">Exclude ambiguous (0Oo1lI!|)</span>
    </label>

    <button class="text-xs text-gray-500 hover:text-gray-300 underline" @click="settings.reset">
      Reset to defaults
    </button>
  </div>
</template>
