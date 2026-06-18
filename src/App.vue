<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SetupScreen from './components/SetupScreen.vue'
import KeySetup from './components/KeySetup.vue'
import KeyUnlock from './components/KeyUnlock.vue'
import MainLayout from './components/MainLayout.vue'

const phase = ref<'loading' | 'setup-screen' | 'setup' | 'unlock' | 'ready' | 'cloning'>('loading')
const cloneError = ref('')
const store = ref<typeof import('./stores/pass').usePassStore | null>(null)

onMounted(async () => {
  const { usePassStore } = await import('./stores/pass')
  const s = usePassStore()
  store.value = s
  await s.checkStore()
  const hasKey = await window.api.key.isSetup()
  if (!hasKey) {
    phase.value = 'setup-screen'
  } else {
    phase.value = 'unlock'
  }
})

async function handleFresh() {
  phase.value = 'setup'
}

async function handleClone(url: string) {
  if (!store.value) return
  phase.value = 'cloning'
  try {
    await store.value.cloneRemote(url)
    const hasKey = await window.api.key.isSetup()
    phase.value = hasKey ? 'unlock' : 'setup'
  } catch (e) {
    cloneError.value = String(e)
    phase.value = 'setup-screen'
  }
}

function onGenerated() { phase.value = 'ready' }
function onImported() { phase.value = 'unlock' }
function onUnlocked() { phase.value = 'ready' }
async function onReset() {
  await window.api.key.reset()
  phase.value = 'setup'
}
</script>

<template>
  <div class="h-screen flex flex-col">
    <SetupScreen
      v-if="phase === 'setup-screen'"
      @fresh="handleFresh"
      @clone="handleClone"
    />
    <div v-else-if="phase === 'cloning'" class="flex-1 flex items-center justify-center">
      <p class="text-gray-400">Cloning repository...</p>
    </div>
    <KeySetup v-else-if="phase === 'setup'" @generated="onGenerated" @imported="onImported" />
    <KeyUnlock v-else-if="phase === 'unlock'" @done="onUnlocked" @reset="onReset" />
    <MainLayout v-else-if="phase === 'ready'" />
  </div>
</template>
