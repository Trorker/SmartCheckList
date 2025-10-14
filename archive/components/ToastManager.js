export default {
  template: `
    <div class="toast-container">
      <div v-for="(t, i) in toasts"
           :key="i"
           class="snackbar"
           :class="[t.type, { active: t.active }]"
           style="margin-bottom: 8px">
        <div class="max">{{ t.text }}</div>
        <a v-if="t.action" class="inverse-link" @click="t.action.callback">
          {{ t.action.label }}
        </a>
      </div>
    </div>
  `,
  setup() {
    const toasts = Vue.reactive([]);

    function addToast(text, type = "default", action = null) {
      const t = { text, type, action, active: true };
      toasts.push(t);

      // Limita a 3 toast
      if (toasts.length > 3) toasts.shift();

      // Auto-hide dopo 5s
      setTimeout(() => (t.active = false), 5000);
    }

    return { toasts, addToast };
  }
};
