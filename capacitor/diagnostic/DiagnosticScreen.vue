<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface TestResult {
  name: string
  status: 'running' | 'ok' | 'fail'
  detail: string
}

const tests = ref<TestResult[]>([
  { name: 'Origin', status: 'running', detail: '' },
  { name: 'NativeHttpBridge', status: 'running', detail: '' },
  { name: 'XHR to github.com', status: 'running', detail: '' },
  { name: 'XHR git-smart protocol', status: 'running', detail: '' },
  { name: 'fetch to github.com', status: 'running', detail: '' },
  { name: 'Capacitor.isNativePlatform', status: 'running', detail: '' },
  { name: 'Capacitor.Plugins.CapacitorHttp', status: 'running', detail: '' }
])

function setTest(idx: number, status: 'ok' | 'fail', detail: string) {
  tests.value[idx].status = status
  tests.value[idx].detail = detail
}

async function runTests() {
  // Test 0: Origin
  tests.value[0].name = `Origin: ${window.location.origin}`
  setTest(0, 'ok', window.location.origin)

  // Test 1: NativeHttpBridge
  const bridge = (window as any).NativeHttpBridge
  if (bridge?.request) {
    setTest(1, 'ok', 'NativeHttpBridge.request available')
  } else {
    setTest(1, 'fail', 'NativeHttpBridge not found')
  }

  // Test 2: Capacitor native check
  const cap = (window as any).Capacitor
  if (cap?.isNativePlatform) {
    const native = cap.isNativePlatform()
    setTest(5, native ? 'ok' : 'fail', `isNativePlatform() = ${native}`)
  } else {
    setTest(5, 'fail', 'Capacitor not found')
  }

  // Test 3: CapacitorHttp plugin
  const httpPlugin = cap?.Plugins?.CapacitorHttp
  if (httpPlugin?.request) {
    setTest(6, 'ok', 'CapacitorHttp.request available')
  } else {
    setTest(6, 'fail', 'CapacitorHttp not in Plugins')
  }

  // Test 4: XHR to GitHub (simple GET)
  try {
    await doXhr('https://github.com', (result) => {
      setTest(2, result.ok ? 'ok' : 'fail', result.detail)
    })
  } catch (e: any) {
    setTest(2, 'fail', String(e))
  }

  // Test 5: XHR to git-smart protocol
  try {
    await doXhr(
      'https://github.com/elpibeperez/.password-store/info/refs?service=git-upload-pack',
      (result) => {
        setTest(3, result.ok ? 'ok' : 'fail', result.detail)
      }
    )
  } catch (e: any) {
    setTest(3, 'fail', String(e))
  }

  // Test 6: fetch to GitHub
  try {
    const resp = await fetch('https://github.com', { method: 'HEAD' })
    setTest(4, 'ok', `Status: ${resp.status} ${resp.statusText}`)
  } catch (e: any) {
    setTest(4, 'fail', String(e))
  }
}

function doXhr(url: string, cb: (r: { ok: boolean; detail: string }) => void): Promise<void> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.timeout = 15000

    xhr.onload = () => {
      cb({ ok: xhr.status < 400, detail: `Status: ${xhr.status} ${xhr.statusText} (${xhr.responseText?.length || 0} bytes)` })
      resolve()
    }

    xhr.onerror = () => {
      cb({ ok: false, detail: `Network error (status: ${xhr.status})` })
      resolve()
    }

    xhr.ontimeout = () => {
      cb({ ok: false, detail: 'Timeout' })
      resolve()
    }

    xhr.send()
  })
}

function testNativeBridge() {
  if ((window as any).NativeHttpBridge?.request) {
    try {
      const result = (window as any).NativeHttpBridge.request('GET', 'https://github.com', '[]', '')
      const parsed = JSON.parse(result)
      if (parsed.status === 200 || parsed.status === 301 || parsed.status === 302) {
        setTest(7, 'ok', `NativeHttpBridge: ${parsed.status}`)
      } else {
        setTest(7, 'fail', `NativeHttpBridge: ${parsed.status} ${parsed.statusMessage}`)
      }
    } catch (e: any) {
      setTest(7, 'fail', `NativeHttpBridge error: ${String(e).slice(0, 100)}`)
    }
  }
}

onMounted(() => {
  runTests()
  setTimeout(testNativeBridge, 2000)
})
</script>

<template>
  <div class="p-4 space-y-2 text-sm font-mono">
    <h1 class="text-lg font-bold mb-3">password-store Diagnostic</h1>

    <div v-for="(test, i) in tests" :key="i"
      class="flex items-start gap-2 p-2 rounded"
      :class="test.status === 'ok' ? 'bg-green-900/30' : test.status === 'fail' ? 'bg-red-900/30' : 'bg-gray-800'"
    >
      <span class="mt-0.5">
        <span v-if="test.status === 'ok'" class="text-green-400">&#10003;</span>
        <span v-else-if="test.status === 'fail'" class="text-red-400">&#10007;</span>
        <span v-else class="text-yellow-400">&#8987;</span>
      </span>
      <div class="flex-1 min-w-0">
        <div class="truncate">{{ test.name }}</div>
        <div v-if="test.detail" class="text-xs text-gray-400 break-all mt-0.5">{{ test.detail }}</div>
      </div>
    </div>

    <div class="text-xs text-gray-500 mt-4">
      User-Agent: {{ navigator.userAgent?.slice(0, 80) }}...
    </div>
  </div>
</template>
