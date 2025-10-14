export default {
  template: `
    <div>
      <div v-if="activeModal" class="overlay blur active"></div>

      <dialog v-if="activeModal === 'info'" open class="active">
        <h5>Informazioni</h5>
        <div>Finestra modale informativa.</div>
        <nav class="right-align no-space mt">
          <button class="transparent link" @click="close">Chiudi</button>
        </nav>
      </dialog>

      <SettingsModal v-if="activeModal === 'settings'" @close="close" />
    </div>
  `,
  components: {
    SettingsModal: (await import('./SettingsModal.js')).default
  },
  setup() {
    const activeModal = Vue.ref(null);
    function open(name) { activeModal.value = name; }
    function close() { activeModal.value = null; }
    return { activeModal, open, close };
  }
};
