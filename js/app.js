if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrato', reg))
      .catch(err => console.error('Service Worker errore', err));
  });
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
    // ----- Aggiungi un nuovo cantiere
    async function addCantiere() {
      if (!newCantiere.value.nome.trim()) {
        alert('Il nome del cantiere è obbligatorio!');
        return;
      }

      let prototypeData = {};
      if (newCantiere.value.file) {
        // Cerca il file del prototipo selezionato
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

      // Inserimento DB
      await db.worksites.put(cantiere);

      // Aggiorno reactive
      worksites.value.push(cantiere);

      // Reset form
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


    const cantiere = ref(null);
    const loading = ref(true);

    const loadWorksites = async () => {
      loading.value = true;

      worksites.value = await db.worksites.toArray();

    }

    //test checklist
    const checklist = ref([
      { icon: "engineering", text: "Il preposto ai lavori nel cantiere è individuato e, per i lavori elettrici, in possesso di attestazione PES", value: null },
      { icon: "recent_actors", text: "Il personale presente ha i profili Enel adeguati all’attività che sta svolgendo o che andrà a svolgere", value: null },
      { icon: "bolt", text: "In caso di lavori sotto tensione in BT, il personale è in possesso dell’idoneità a svolgere tali lavori rilasciata dal datore di lavoro", value: null },
      { icon: "medical_services", text: "Il personale presente ha la formazione adeguata per la gestione emergenze (primo soccorso, prevenzione incendi, ecc.)", value: null },
      { icon: "precision_manufacturing", text: "Il personale presente ha la formazione adeguata all’utilizzo delle macchine e attrezzatura (PLE, gru su autocarro, escavatori, ecc.)", value: null },
      { icon: "signpost", text: "Il personale presente ha la formazione adeguata per addetti e preposti alle attività di pianificazione, controllo e apposizione della segnaletica stradale destinata alle attività lavorative che si svolgano in presenza di traffico veicolare", value: null }
    ])

    // ---- Gestione sezioni
    function goBack() {
      if (currentSection.value === "checklist") currentSection.value = "worksite";
      else if (currentSection.value === "worksite") currentSection.value = "home";
    }

    //passagio a worksite
    function openWorksite(w) {
      selectedWorksite.value = w;
      currentSection.value = "worksite";
    }

    function openChecklist() {
      currentSection.value = "checklist";
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
      // Nasconde il toast precedente se presente
      if (toast.timer) {
        clearTimeout(toast.timer);
        toast.timer = null;
      }

      // Mostra il toast
      toast.text = text;
      toast.type = type;
      toast.action = action;
      toast.active = true;

      // Imposta il timer
      toast.timer = setTimeout(() => {
        toast.active = false;
        toast.timer = null;
      }, 5000);
    }

    // 🔹 Dialog
    function openDialog() {
      showDialog.value = true;
    }

    function closeDialog() {
      showDialog.value = false;
    }

    function confirmAction() {
      showDialog.value = false;
      addToast("Azione confermata", "primary");
    }
    const random = computed(() => {
      return Math.floor(Math.random() * 100);
    });

    const Random = () => {
      return Math.floor(Math.random() * 100);
    };

    return {
      activeTab, tabs,

      title,

      isDark,
      showDialog,

      showDialogNewWorksite,
      addCantiere,
      newCantiere,
      prototypes,


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
      Random,
      random
    }
  },
}).mount("#app");
