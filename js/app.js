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
    // ===== Dexie DB =====
    const db = new Dexie("SmartCheckListDB");
    db.version(1).stores({
      worksites: 'id, nome, descr, version, data, progress, status, sections',
    });

    // ===== Refs =====
    const title = ref('Levratti');
    const isDark = ref(false);
    const showDialog = ref(false);
    const showDialogNewWorksite = ref(false);
    const newCantiere = ref({ nome: '', descr: '', file: '' });
    const prototypes = ref([
      { nome: 'Prototipo ENEL', version: '1.0', file: 'cantiere_enel.json' },
      { nome: 'Prototipo TERNA', version: '1.1', file: 'cantiere_terna.json' },
    ]);

    const worksites = ref([]);
    const loading = ref(true);
    const currentSection = ref("home"); // home | worksite | checklist
    const selectedWorksite = ref(null);

    const activeTab = ref("tutti");
    const tabs = [
      { id: "tutti", icon: "radio_button_unchecked", label: "Tutti" },
      { id: "completati", icon: "check_box", label: "Completati" },
      { id: "ncompleti", icon: "indeterminate_check_box", label: "Incompleti" }
    ];

    const dialogImage = ref(null);
    const photoDialog = ref(false);

    const currentSectionIndex = ref(0);

    const currentChecklistSections = computed(() => {
      if (!selectedWorksite.value || !selectedWorksite.value.sections) return [];
      return selectedWorksite.value.sections.filter(s => s.type === 'checklist');
    });

    // ===== Toast =====
    const toast = reactive({
      active: false,
      text: "",
      type: "default",
      action: null,
      timer: null,
    });

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

    // ===== Load worksites =====
    const loadWorksites = async () => {
      loading.value = true;
      worksites.value = await db.worksites.toArray();
      loading.value = false;
    }

    // ===== Theme =====
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

    // ===== Navigation =====
    function goBack() {
      if (currentSection.value === "checklist") {
        currentSection.value = "worksite";
        currentSectionIndex.value = 0;
      } else if (currentSection.value === "worksite") currentSection.value = "home";
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

    // ===== Worksite management =====
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
        sections: []
      };

      await db.worksites.put(cantiere);
      worksites.value.push(cantiere);

      newCantiere.value = { nome: '', descr: '', file: '' };
      showDialogNewWorksite.value = false;
      addToast(`Nuovo cantiere "${cantiere.nome}" aggiunto`, "primary");
    }

    // ===== Checklist update =====
    async function updateSection(section) {
      // Recupero il cantiere dal DB
      const ws = await db.worksites.get(selectedWorksite.value.id);

      if (!ws.sections) ws.sections = [];

      const idx = ws.sections.findIndex(s => s.id === section.id);

      // Trasformo section in oggetto normale prima di salvare
      const plainSection = JSON.parse(JSON.stringify(section));

      if (idx >= 0) ws.sections[idx] = plainSection;
      else ws.sections.push(plainSection);

      // Salvo in DB
      await db.worksites.put(ws);

      // Aggiorno reactive
      selectedWorksite.value = ws;
      const wsIndex = worksites.value.findIndex(w => w.id === ws.id);
      if (wsIndex >= 0) worksites.value[wsIndex] = ws;
    }

    function updateChecklistItem(section, item) {
      const updatedSection = { ...section };
      updatedSection.items = section.items.map(i =>
        i.text === item.text ? { ...item } : i
      );
      updateSection(updatedSection);
    }

    function handleFileChange(e, section) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        // Se non esiste, creo l'array attachments
        if (!section.attachments) section.attachments = [];

        // Aggiungo la foto come base64 all'array attachments
        section.attachments.push({
          id: crypto.randomUUID(), // id univoco per ogni attachment
          name: file.name,
          data: reader.result
        });

        // Salvo la sezione aggiornata nel DB
        updateSection(section);
      };
      reader.readAsDataURL(file);
    }

    function openAttachment(att) {      
      dialogImage.value = att.data;
      photoDialog.value = true;
    }

    function removeAttachment(index) {
      const section = currentChecklistSections.value[currentSectionIndex.value];
      section.attachments.splice(index, 1);
      updateSection(section); // salva su DB
    }


    // ===== Dialog =====
    function openDialog() { showDialog.value = true; }
    function closeDialog() { showDialog.value = false; }
    function confirmAction() {
      showDialog.value = false;
      addToast("Azione confermata", "primary");
    }

    return {
      // refs
      title, isDark, showDialog, showDialogNewWorksite, newCantiere, prototypes,
      worksites, loading, currentSection, selectedWorksite,
      activeTab, tabs, currentSectionIndex, currentChecklistSections,
      toast, dialogImage, photoDialog,

      // functions
      addCantiere, toggleTheme, addToast,
      goBack, openWorksite, openChecklist, nextSection, prevSection,
      updateChecklistItem, handleFileChange, removeAttachment, openAttachment,
      openDialog, closeDialog, confirmAction
    }
  },
}).mount("#app");
