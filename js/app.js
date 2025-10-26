if ('serviceWorker' in navigator) {
  /*window.addEventListener('load', () => {
    navigator.serviceWorker.register('./js/sw.js')
      .then(reg => console.log('Service Worker registrato', reg))
      .catch(err => console.error('Service Worker errore', err));
  });*/
}

const { createApp, ref, reactive, computed, onMounted } = Vue;

createApp({
  setup() {

    const db = new Dexie("SmartCheckListDB");
    db.version(1).stores({
      worksites: 'id, nome, descr, version, data, progress, status',
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

    // Gestione checklist test
    const checklist = ref([
      { icon: "engineering", text: "Il preposto ai lavori nel cantiere è individuato...", value: null },
      { icon: "recent_actors", text: "Il personale presente ha i profili Enel adeguati...", value: null },
      { icon: "bolt", text: "In caso di lavori sotto tensione in BT...", value: null },
      { icon: "medical_services", text: "Il personale presente ha la formazione adeguata...", value: null },
      { icon: "precision_manufacturing", text: "Il personale presente ha la formazione adeguata all’utilizzo delle macchine...", value: null },
      { icon: "signpost", text: "Il personale presente ha la formazione adeguata per addetti e preposti alla segnaletica...", value: null }
    ]);

    // ---- Gestione sezioni
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
        currentSectionIndex.value = 0; // resetto indice
      }
      else if (currentSection.value === "worksite") currentSection.value = "home";
    }

    function openWorksite(w) {
      selectedWorksite.value = w;
      currentSection.value = "worksite";
      currentSectionIndex.value = 0; // reset indice checklist
    }

    function openChecklist() {
      currentSection.value = "checklist";
      currentSectionIndex.value = 0;
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
      checklist,
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
      prevSection
    }
  },
}).mount("#app");
