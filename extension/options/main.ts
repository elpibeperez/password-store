import { createApp } from 'vue'
import { createPinia } from 'pinia'
import OptionsApp from './OptionsApp.vue'
import '../assets/main.css'

const app = createApp(OptionsApp)
app.use(createPinia())
app.mount('#app')
