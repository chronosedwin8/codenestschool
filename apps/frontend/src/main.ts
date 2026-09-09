import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { router } from './router';
import { useAudioStore } from './stores/audio';

import './styles/tokens.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);

// El audio necesita el manifest y la preferencia de silencio antes de sonar.
const audio = useAudioStore();
audio.restaurarPreferencias();
void audio.cargarManifest();

// Los navegadores exigen un gesto del usuario antes de reproducir sonido.
const desbloquear = (): void => {
  audio.desbloquear();
  window.removeEventListener('pointerdown', desbloquear);
  window.removeEventListener('keydown', desbloquear);
};
window.addEventListener('pointerdown', desbloquear, { once: true });
window.addEventListener('keydown', desbloquear, { once: true });

app.mount('#app');
