<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from './lib/api'
import SetupScreen from './components/SetupScreen.vue'
import KeySetup from './components/KeySetup.vue'
import KeyUnlock from './components/KeyUnlock.vue'
import MainLayout from './components/MainLayout.vue'

const phase = ref<'loading' | 'setup-screen' | 'setup' | 'unlock' | 'ready'>('loading')

onMounted(async () => {
  // 1. Check if already unlocked (session active)
  const unlocked = await api.key.isUnlocked()
  if (unlocked) {
    phase.value = 'ready'
    return
  }
  // 2. Check if key file exists
  const hasKey = await api.key.isSetup()
  phase.value = hasKey ? 'unlock' : 'setup-screen'
})

function handleReady() {
  phase.value = 'unlock'
}

function onGenerated() {
  phase.value = 'ready'
}

function onImported() {
  phase.value = 'unlock'
}

function onUnlocked() {
  phase.value = 'ready'
}

async function onReset() {
  await api.key.reset()
  phase.value = 'setup-screen'
}
</script>

<template>
  <div class="w-full h-full md:w-[700px] md:h-[550px] flex flex-col overflow-hidden max-h-screen">
    <SetupScreen v-if="phase === 'setup-screen'" @ready="handleReady" />
    <KeySetup v-else-if="phase === 'setup'" @generated="onGenerated" @imported="onImported" />
    <KeyUnlock v-else-if="phase === 'unlock'" @done="onUnlocked" @reset="onReset" />
    <MainLayout v-else-if="phase === 'ready'" />
  </div>
</template>
