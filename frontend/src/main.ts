import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { MotionPlugin } from '@vueuse/motion';
import App from './App.vue';
import './index.css';

const app = createApp(App);

// ── State management ──────────────────────────────────────────────────────────
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);

// ── Animations ────────────────────────────────────────────────────────────────
app.use(MotionPlugin);

app.mount('#root');
