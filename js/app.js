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

    const checklistProgress = computed(() => {
      if (!selectedWorksite.value || !selectedWorksite.value.sections) return 0;

      const sezioni = selectedWorksite.value.sections.filter(s => s.type === 'checklist');
      let totDomande = 0;
      let risposteDate = 0;

      sezioni.forEach(sezione => {
        if (!sezione.items) return;
        sezione.items.forEach(item => {
          totDomande++;
          // consideriamo risposta data se ha un valore true/false/testo o note
          if (
            item.value !== undefined && item.value !== null && item.value !== '' ||
            (item.note && item.note.trim() !== '')
          ) {
            risposteDate++;
          }
        });
      });

      return totDomande > 0 ? Math.round((risposteDate / totDomande) * 100) : 0;
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

    watch(checklistProgress, async (newVal) => {
      if (selectedWorksite.value) {
        selectedWorksite.value.progress = newVal;
        try {
          const data = JSON.parse(JSON.stringify(selectedWorksite.value));
          await db.worksites.put(data);
        } catch (err) {
          console.error("Errore aggiornando il progresso:", err);
        }
      }
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
      };

      await db.worksites.put(cantiere);
      worksites.value.push(cantiere);

      newCantiere.value = { nome: '', descr: '', file: '' };
      showDialogNewWorksite.value = false;
      addToast(`Nuovo cantiere "${cantiere.nome}" aggiunto`, "primary");
    }

    // --- Scarica cantiere ---
    const downloadWorksite = (worksite) => {
      const dataStr = JSON.stringify(worksite, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${worksite.nome.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // stato del dialogo generico
    const dialog = Vue.reactive({
      visible: false,
      title: '',
      message: '',
      onConfirm: null
    });

    // apre il dialog
    const openDialog = (title, message, onConfirm) => {
      dialog.title = title;
      dialog.message = message;
      dialog.onConfirm = onConfirm;
      dialog.visible = true;
    };

    // chiude il dialog
    const closeDialog = () => {
      dialog.visible = false;
      dialog.title = '';
      dialog.message = '';
      dialog.onConfirm = null;
    };

    // conferma azione
    const confirmDialog = async () => {
      if (dialog.onConfirm) await dialog.onConfirm();
      closeDialog();
    };

    // funzione per eliminare cantiere
    const deleteWorksite = (worksite) => {
      if (!worksite || !worksite.id) return;

      // apri dialog di conferma
      openDialog(
        'Elimina cantiere',
        `Sei sicuro di voler eliminare il cantiere "${worksite.nome}"?`,
        async () => {
          const backup = JSON.parse(JSON.stringify(worksite));

          try {
            await db.worksites.delete(worksite.id);
            await loadWorksites();

            addToast(`Cantiere "${worksite.nome}" eliminato`, 'error', {
              label: 'Annulla',
              callback: async () => {
                await db.worksites.put(backup);
                await loadWorksites();
                addToast('Eliminazione annullata', 'primary');
              }
            });
          } catch (err) {
            console.error('Errore eliminazione cantiere:', err);
            addToast('Errore durante l\'eliminazione', 'error');
          }
        }
      );
    };

    // funzione per rendere leggibili le chiavi
    const formatLabel = (key) => {
      return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    };

    // debounce per evitare troppi salvataggi continui
    let saveTimeout = null;
    const autoSaveWorksite = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => saveWorksite(), 800);
    };

    // salva nel DB l'intero cantiere corrente
    const saveWorksite = async () => {
      if (!selectedWorksite.value) return;
      try {
        // 🔹 crea una copia JSON pura (senza Proxy Vue)
        const data = JSON.parse(JSON.stringify(selectedWorksite.value));

        await db.worksites.put(data);
        addToast('Cantiere salvato', 'success');
      } catch (err) {
        console.error('Errore salvataggio cantiere:', err);
        addToast('Errore nel salvataggio', 'error');
      }
    };



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
      if (!section || !section.attachments || !section.attachments[index]) return;

      const att = section.attachments[index];
      const backup = JSON.parse(JSON.stringify(att));

      // apri dialog di conferma
      openDialog(
        "Elimina allegato",
        `Vuoi davvero eliminare l'allegato "${att.name}"?`,
        async () => {
          try {
            // rimuovi l'allegato
            section.attachments.splice(index, 1);
            await updateSection(section);

            addToast(`Allegato "${att.name}" eliminato`, "error", {
              label: "Annulla",
              callback: async () => {
                section.attachments.splice(index, 0, backup); // ripristina
                await updateSection(section);
                addToast("Eliminazione annullata", "primary");
              },
            });
          } catch (err) {
            console.error("Errore eliminazione allegato:", err);
            addToast("Errore durante l'eliminazione", "error");
          }
        }
      );
    }



    return {
      // refs
      title, isDark, showDialog, showDialogNewWorksite, newCantiere, prototypes,
      worksites, loading, currentSection, selectedWorksite,
      activeTab, tabs, currentSectionIndex, currentChecklistSections, checklistProgress,
      toast, dialogImage, photoDialog, dialog,

      // functions
      addCantiere, toggleTheme, addToast,
      goBack, openWorksite, openChecklist, nextSection, prevSection,
      updateChecklistItem, handleFileChange, removeAttachment, openAttachment,
      openDialog, closeDialog, downloadWorksite, deleteWorksite, confirmDialog, formatLabel,
      autoSaveWorksite, saveWorksite,
    }
  },
}).mount("#app");
