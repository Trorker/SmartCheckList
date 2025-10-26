if ('serviceWorker' in navigator) {
  /*window.addEventListener('load', () => {
    navigator.serviceWorker.register('./js/sw.js')
      .then(reg => console.log('Service Worker registrato', reg))
      .catch(err => console.error('Service Worker errore', err));
  });*/
}

const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

createApp({
  setup() {

    const db = new Dexie("SmartCheckListDB");
    db.version(1).stores({
      worksites: 'id, nome, descr, version, data, progress, status, sections',
    });

    const title = ref('Levratti');
    const isDark = ref(false);
    const showDialog = ref(false);

    const showDialogNewWorksite = ref(false);
    const newCantiere = ref({ nome: '', descr: '', file: '' });
    const prototypes = ref([
      { nome: 'Prototipo ENEL', version: '1.0', file: 'cantiere_enel.json' },
      { nome: 'Prototipo TERNA', version: '1.1', file: 'cantiere_terna.json' },
    ]);

    async function addCantiere() {
      if (!newCantiere.value.nome.trim()) {
        alert('Il nome del cantiere è obbligatorio!');
        return;
      }

      let prototypeData = {};
      if (newCantiere.value.file) {
        const proto = prototypes.value.find(p => p.file === newCantiere.value.file);
        if (proto) {
          const res = await fetch(`./prototypes/${proto.file}`);
          if (res.ok) prototypeData = await res.json();
        }
      }

      const cantiere = {
        ...prototypeData,
        id: crypto.randomUUID(),
        nome: newCantiere.value.nome,
        descr: newCantiere.value.descr || '',
        version: newCantiere.value.file || '',
        data: new Date().toISOString().slice(0, 10),
        progress: 0,
        sections: [] // <- inizializzo le sezioni vuote
      };

      await db.worksites.put(cantiere);
      worksites.value.push(cantiere);
      newCantiere.value = { nome: '', descr: '', version: '' };
      showDialogNewWorksite.value = false;
      console.log("Nuovo cantiere aggiunto:", cantiere);
    }

    const toast = reactive({
      active: false,
      text: "",
      type: "default",
      action: null,
      timer: null,
    });

    const currentSection = ref("home"); // home | worksite | checklist
    const selectedWorksite = ref(null);

    const activeTab = ref("tutti");
    const tabs = [
      { id: "tutti", icon: "radio_button_unchecked", label: "Tutti" },
      { id: "completati", icon: "check_box", label: "Completati" },
      { id: "ncompleti", icon: "indeterminate_check_box", label: "Incompleti" }
    ];

    const worksites = ref([]);
    const loading = ref(true);

    const loadWorksites = async () => {
      loading.value = true;
      worksites.value = await db.worksites.toArray();
      loading.value = false;
    }

    // ---- Gestione checklist
    const currentSectionIndex = ref(0);

    const currentChecklistSections = computed(() => {
      if (!selectedWorksite.value || !selectedWorksite.value.sections) return [];
      return selectedWorksite.value.sections.filter(s => s.type === 'checklist');
    });

    function nextSection() {
      if (currentSectionIndex.value < currentChecklistSections.value.length - 1) {
        currentSectionIndex.value++;
      }
    }

    function prevSection() {
      if (currentSectionIndex.value > 0) {
        currentSectionIndex.value--;
      }
    }

    function goBack() {
      if (currentSection.value === "checklist") {
        currentSection.value = "worksite";
        currentSectionIndex.value = 0;
      }
      else if (currentSection.value === "worksite") currentSection.value = "home";
    }

    function openWorksite(w) {
      selectedWorksite.value = w;
      currentSection.value = "worksite";
      currentSectionIndex.value = 0;
    }

    function openChecklist() {
      currentSection.value = "checklist";
      currentSectionIndex.value = 0;
    }

    // ---- Salvataggio checklist + foto
    async function updateSection(section) {
      // Aggiorno DB
      const ws = await db.worksites.get(selectedWorksite.value.id);
      if (!ws.sections) ws.sections = [];
      const idx = ws.sections.findIndex(s => s.id === section.id);
      if (idx >= 0) ws.sections[idx] = section;
      else ws.sections.push(section);

      await db.worksites.put(ws);

      // Aggiorno reactive
      selectedWorksite.value = ws;
      const wsIndex = worksites.value.findIndex(w => w.id === ws.id);
      if (wsIndex >= 0) worksites.value[wsIndex] = ws;
    }

    function handleFileChange(e, section) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        section.photo = reader.result; // salva base64
        updateSection(section);
      };
      reader.readAsDataURL(file);
    }

    function updateChecklistItem(section, item) {
      // Aggiorna la risposta della checklist
      const idx = section.items.findIndex(i => i.text === item.text);
      if (idx >= 0) section.items[idx] = item;
      updateSection(section);
    }

    // 🔹 Tema
    onMounted(() => {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") {
        isDark.value = true;
        document.body.classList.add("dark");
      }
      loadWorksites();
    });

    function toggleTheme() {
      isDark.value = !isDark.value;
      document.body.classList.toggle("dark", isDark.value);
      localStorage.setItem("theme", isDark.value ? "dark" : "light");
      addToast(isDark.value ? "Tema scuro attivato" : "Tema chiaro attivato", "primary");
    }

    // 🔹 Toast
    function addToast(text, type = "default", action = null) {
      if (toast.timer) {
        clearTimeout(toast.timer);
        toast.timer = null;
      }
      toast.text = text;
      toast.type = type;
      toast.action = action;
      toast.active = true;
      toast.timer = setTimeout(() => {
        toast.active = false;
        toast.timer = null;
      }, 5000);
    }

    // 🔹 Dialog
    function openDialog() { showDialog.value = true; }
    function closeDialog() { showDialog.value = false; }
    function confirmAction() {
      showDialog.value = false;
      addToast("Azione confermata", "primary");
    }

    return {
      activeTab, tabs,
      title,
      isDark, showDialog,
      loading,
      showDialogNewWorksite,
      addCantiere, newCantiere, prototypes,
      toast,
      currentSection,
      selectedWorksite,
      worksites,
      /*checklist,*/
      toggleTheme,
      addToast,
      openDialog,
      closeDialog,
      confirmAction,
      goBack,
      openWorksite,
      openChecklist,
      currentSectionIndex,
      currentChecklistSections,
      nextSection,
      prevSection,
      handleFileChange,
      updateChecklistItem
    }
  },
}).mount("#app");
