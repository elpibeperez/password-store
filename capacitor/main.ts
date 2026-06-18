import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { nativeApi } from './android-api'
import App from '../extension/popup/App.vue'

// Set global API for the web app
;(window as any).api = {
  store: nativeApi.store,
  key: nativeApi.key,
  git: nativeApi.git
}

console.log('password-store: Android native API loaded')

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
