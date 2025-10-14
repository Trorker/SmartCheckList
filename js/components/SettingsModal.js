import SignaturePad from "https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js";

export default {
  template: `
  <dialog open class="active" style="max-width:500px">
    <h5>Impostazioni Verificatore</h5>
    <div class="field label border">
      <input v-model="settings.name" placeholder="Nome verificatore">
      <label>Nome verificatore</label>
    </div>

    <div class="field label border">
      <input v-model="settings.company" placeholder="Azienda">
      <label>Azienda</label>
    </div>

    <div>
      <label style="display:block; margin-bottom:4px;">Firma:</label>
      <canvas ref="canvas" style="border:1px solid var(--outline); width:100%; height:150px;"></canvas>
      <nav class="right-align no-space mt">
        <button class="transparent small" @click="clearSignature">Pulisci</button>
      </nav>
    </div>

    <nav class="right-align no-space mt">
      <button class="transparent link" @click="$emit('close')">Chiudi</button>
      <button class="primary" @click="save">Salva</button>
    </nav>
  </dialog>
  `,
  setup(_, { emit }) {
    const settings = Vue.reactive({
      name: localStorage.getItem("verificatore") || "",
      company: localStorage.getItem("azienda") || "",
      signature: localStorage.getItem("firma") || ""
    });

    const canvas = Vue.ref(null);
    let pad;

    Vue.onMounted(() => {
      pad = new SignaturePad(canvas.value);
      if (settings.signature) {
        const img = new Image();
        img.src = settings.signature;
        img.onload = () => {
          const ctx = canvas.value.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.value.width, canvas.value.height);
        };
      }
    });

    function clearSignature() { pad.clear(); }
    function save() {
      settings.signature = pad.toDataURL();
      localStorage.setItem("verificatore", settings.name);
      localStorage.setItem("azienda", settings.company);
      localStorage.setItem("firma", settings.signature);
      emit("close");
    }

    return { settings, canvas, clearSignature, save };
  }
};
