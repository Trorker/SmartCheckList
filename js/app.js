import {
  getAllSites,
  addSite,
  deleteItem,
  updateSite
} from "../archive/db.js";



const { createApp, ref, reactive, computed, onMounted } = Vue;

createApp({
  setup() {
    const isDark = ref(false);
    const showDialog = ref(false);
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

    const worksites = reactive([
      { id: 1, nome: "Mirandola ENEL", descr: "Linea BT 12kV - tratto A", progress: 70 },
      { id: 2, nome: "Carpi - Via Fossa", descr: "Sostituzione quadro MT", progress: 40 },
      { id: 3, nome: "Modena Nord", descr: "Manutenzione pali", progress: 100 },
      { id: 4, nome: "Camposanto", descr: "Ispezione cabine ENEL", progress: 20 },
    ]);




    // ---- Gestione sezioni
    function goBack() {
      if (currentSection.value === "checklist") currentSection.value = "worksite";
      else if (currentSection.value === "worksite") currentSection.value = "home";
    }

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

      isDark,
      showDialog,
      toast,
      currentSection,
      selectedWorksite,
      worksites,
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
