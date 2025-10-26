//import { genPDF } from './genPDF.js';
import { downloadWorksite } from './pdf/worksiteHandler.js';

if ('serviceWorker' in navigator) {
  /*window.addEventListener('load', () => {
    navigator.serviceWorker.register('./js/sw.js')
      .then(reg => console.log('Service Worker registrato', reg))
      .catch(err => console.error('Service Worker errore', err));
  });*/
}

const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

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
      { nome: 'ENEL Precompilato', version: '1.0', file: 'cantiere_enel_pre_filled.json' },
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

    /*const currentChecklistSections = computed(() => {
      if (!selectedWorksite.value || !selectedWorksite.value.sections) return [];
      return selectedWorksite.value.sections.filter(s => s.type === 'checklist');
    });*/
    const currentChecklistSections = computed(() => {
      if (!selectedWorksite.value || !selectedWorksite.value.sections) return [];

      // Includiamo checklist, table e signature
      return selectedWorksite.value.sections.filter(s =>
        ['checklist', 'table', 'signature'].includes(s.type)
      );
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
    /*const downloadWorksite = (worksite) => {


      genPDF(worksite);


      /*const dataStr = JSON.stringify(worksite, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${worksite.nome.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);*/
    //}



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

      await guardEdit(
        // come “sezione” possiamo passare l’intero worksite
        selectedWorksite.value,
        async () => {
          // callback → salva effettivamente il worksite
          try {
            const data = JSON.parse(JSON.stringify(selectedWorksite.value));
            await db.worksites.put(data);
            addToast("Cantiere salvato", "success");
          } catch (err) {
            console.error("Errore salvataggio cantiere:", err);
            addToast("Errore nel salvataggio", "error");
          }
        }
      );
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

    // wrapper generico per modifiche a sezioni
    async function modifySection(section, modifyCallback) {
      await guardEdit(section, async () => {
        await modifyCallback(section);
      });
    }

    // aggiornamento singolo item checklist
    function updateChecklistItem(section, item) {
      modifySection(section, async (sec) => {
        const updatedSection = { ...sec };
        updatedSection.items = sec.items.map(i =>
          i.text === item.text ? { ...item } : i
        );
        await updateSection(updatedSection);
      });
    }

    // gestione file allegati
    function handleFileChange(e, section) {
      modifySection(section, async (sec) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
          if (!sec.attachments) sec.attachments = [];
          sec.attachments.push({
            id: crypto.randomUUID(),
            name: file.name,
            data: reader.result
          });
          await updateSection(sec);
        };
        reader.readAsDataURL(file);
      });
    }

    function openAttachment(att) {
      dialogImage.value = att.data;
      photoDialog.value = true;
    }

    // rimozione allegati
    function removeAttachment(index) {
      const section = currentChecklistSections.value[currentSectionIndex.value];
      if (!section || !section.attachments || !section.attachments[index]) return;

      const att = section.attachments[index];

      modifySection(section, async (sec) => {
        const backup = JSON.parse(JSON.stringify(att));
        sec.attachments.splice(index, 1);
        await updateSection(sec);

        addToast(`Allegato "${att.name}" eliminato`, "error", {
          label: "Annulla",
          callback: async () => {
            sec.attachments.splice(index, 0, backup);
            await updateSection(sec);
            addToast("Eliminazione annullata", "primary");
          },
        });
      });
    }



    // ===== SignaturePad =====
    const sigOpen = ref(false);
    const signCanvas = ref(null);
    let signaturePad = null; // istanza SignaturePad
    const currentSig = ref(null);
    const currentSigIndex = ref(null);

    function openSigDlg(sig, index) {


      // Controllo progresso checklist
      if (checklistProgress.value < 100) {
        addToast("Non puoi firmare: tutte le domande della checklist devono essere completate", "error");
        return;
      }


      currentSig.value = sig;
      currentSigIndex.value = index;
      sigOpen.value = true;

      nextTick(() => {
        if (!signCanvas.value) return;

        // 🔹 Ridimensiona il canvas per la risoluzione del dispositivo
        const canvas = signCanvas.value;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        const ctx = canvas.getContext('2d');
        ctx.scale(ratio, ratio);

        // 🔹 Inizializza SignaturePad
        signaturePad = new SignaturePad(canvas, {
          penColor: "blue",
          minWidth: 0.5,
          maxWidth: 2.5,
          throttle: 16,
          smoothing: 0.5,
        });

        // 🔹 Carica firma esistente
        if (currentSig.value.signature) {
          const img = new Image();
          img.onload = () => signaturePad.fromDataURL(currentSig.value.signature);
          img.src = currentSig.value.signature;
        }
      });
    }

    function sigClear() {
      if (signaturePad) signaturePad.clear();
      if (currentSig.value) currentSig.value.signature = '';
    }

    async function sigSave() {
      if (!signaturePad || !currentSig.value) return;
      if (signaturePad.isEmpty()) {
        addToast("Firma vuota, nulla da salvare", "error");
        return;
      }

      const dataUrl = signaturePad.toDataURL("image/png");
      currentSig.value.signature = dataUrl;

      const section = currentChecklistSections.value[currentSectionIndex.value];
      if (section && section.signatures && currentSigIndex.value !== null) {
        section.signatures[currentSigIndex.value] = currentSig.value;
        await updateSection(section);
      }

      sigOpen.value = false;
    }

    function closeSigDlg() { sigOpen.value = false; }


    function goToSignatureSection() {
      if (!selectedWorksite.value || !currentChecklistSections.value.length) return;

      // trova l'indice della sezione signature
      const sigIndex = currentChecklistSections.value.findIndex(s => s.type === 'signature');

      if (sigIndex === -1) {
        addToast("Nessuna sezione firma disponibile", "error");
        return;
      }

      // cambia sezione corrente e vai alla checklist
      currentSection.value = 'checklist';
      currentSectionIndex.value = sigIndex;

      // opzionale: scroll automatico o focus sul canvas firma
      nextTick(() => {
        const canvas = document.querySelector('canvas[ref="signCanvas"]');
        if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }



    const allSignaturesDone = computed(() => {
      if (!selectedWorksite.value || !selectedWorksite.value.sections) return false;

      const sigSection = selectedWorksite.value.sections.find(s => s.type === 'signature');
      if (!sigSection || !sigSection.signatures) return false;

      return sigSection.signatures.every(sig => sig.signature && sig.signature.trim() !== '');
    });

    async function guardEdit(section, callback) {
      if (allSignaturesDone.value) {
        const backupSection = JSON.parse(JSON.stringify(section));

        openDialog(
          "Attenzione!",
          "Se modifichi questo contenuto, tutte le firme presenti saranno eliminate e dovranno essere rifatte.",
          async () => {
            const sigSection = selectedWorksite.value.sections.find(s => s.type === 'signature');
            if (sigSection && sigSection.signatures) {
              sigSection.signatures.forEach(sig => sig.signature = '');
              await updateSection(sigSection);
              addToast("Firme eliminate. Devi rifirmare tutto.", "primary");
            }

            await callback();
          },
          async () => {
            //const ws = await db.worksites.get(selectedWorksite.value.id);
            //selectedWorksite.value.sections = ws.sections; // cambia reference delle sezioni

            restoreWorksiteFromDB();

            addToast("Modifica annullata, firme intatte.", "error");
          }
        );
      } else {
        await callback();
      }
    }

    async function restoreWorksiteFromDB() {
      if (!selectedWorksite.value) return;

      // recupera l'ultimo stato salvato sul DB
      const ws = await db.worksites.get(selectedWorksite.value.id);
      if (!ws) return;

      // aggiorna tutte le proprietà del reactive object
      Object.keys(ws).forEach(key => {
        selectedWorksite.value[key] = JSON.parse(JSON.stringify(ws[key]));
      });
    }



    const dialog = Vue.reactive({
      visible: false,
      title: '',
      message: '',
      onConfirm: null,
      onCancel: null
    });

    const openDialog = (title, message, onConfirm, onCancel = null) => {
      dialog.title = title;
      dialog.message = message;
      dialog.onConfirm = onConfirm;
      dialog.onCancel = onCancel;
      dialog.visible = true;
    };

    const closeDialog = () => {
      dialog.visible = false;
      dialog.title = '';
      dialog.message = '';
      dialog.onConfirm = null;
      dialog.onCancel = null;
    };

    // funzione conferma
    const confirmDialog = async () => {
      if (dialog.onConfirm) await dialog.onConfirm();
      closeDialog();
    };

    // funzione annulla
    const cancelDialog = async () => {
      if (dialog.onCancel) await dialog.onCancel();
      closeDialog();
    };







    return {
      // refs
      title, isDark, showDialog, showDialogNewWorksite, newCantiere, prototypes,
      worksites, loading, currentSection, selectedWorksite,
      activeTab, tabs, currentSectionIndex, currentChecklistSections, checklistProgress,
      toast, dialogImage, photoDialog, dialog,

      sigOpen, signCanvas, currentSig,

      // functions
      addCantiere, toggleTheme, addToast,
      goBack, openWorksite, openChecklist, nextSection, prevSection,
      updateChecklistItem, handleFileChange, removeAttachment, openAttachment,
      openDialog, closeDialog, cancelDialog, downloadWorksite, deleteWorksite, confirmDialog, formatLabel,
      autoSaveWorksite, saveWorksite,

      openSigDlg, sigClear, sigSave, closeSigDlg, goToSignatureSection,
    }
  },
}).mount("#app");
