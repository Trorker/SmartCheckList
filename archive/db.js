// db.js — gestione IndexedDB per CheckList Levratti
// Compatibile con Composition API (Vue 3)

const DB_NAME = "levratti_checklist_db";
const DB_VERSION = 2; // incrementa se modifichi schema

let dbPromise = null;

// 🔹 Apertura o creazione del DB
export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 🔸 Tabella CANTIERI
      if (!db.objectStoreNames.contains("sites")) {
        const store = db.createObjectStore("sites", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("status", "status", { unique: false });
      }

      // 🔸 Tabella SEZIONI
      if (!db.objectStoreNames.contains("sections")) {
        const store = db.createObjectStore("sections", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("siteId", "siteId", { unique: false });
      }

      // 🔸 Tabella FOTO
      if (!db.objectStoreNames.contains("photos")) {
        const store = db.createObjectStore("photos", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("sectionId", "sectionId", { unique: false });
      }

      // 🔸 Tabella AUDIO (note vocali)
      if (!db.objectStoreNames.contains("audio")) {
        const store = db.createObjectStore("audio", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("sectionId", "sectionId", { unique: false });
      }

      // 🔸 Tabella FIRME
      if (!db.objectStoreNames.contains("signatures")) {
        const store = db.createObjectStore("signatures", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("siteId", "siteId", { unique: false });
      }

      // 🔸 Tabella SETTINGS
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });

  return dbPromise;
}

// ==================================================
// 🔹 Helper CRUD generici
// ==================================================

async function tx(store, mode = "readonly") {
  const db = await openDB();
  return db.transaction(store, mode).objectStore(store);
}

export async function addItem(store, item) {
  const storeObj = await tx(store, "readwrite");
  return new Promise((resolve, reject) => {
    const req = storeObj.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

export async function updateItem(store, item) {
  const storeObj = await tx(store, "readwrite");
  return new Promise((resolve, reject) => {
    const req = storeObj.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

export async function deleteItem(store, id) {
  const storeObj = await tx(store, "readwrite");
  return new Promise((resolve, reject) => {
    const req = storeObj.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e);
  });
}

export async function getItem(store, id) {
  const storeObj = await tx(store, "readonly");
  return new Promise((resolve, reject) => {
    const req = storeObj.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

export async function getAll(store, indexKey = null, value = null) {
  const storeObj = await tx(store, "readonly");
  return new Promise((resolve, reject) => {
    let req;
    if (indexKey && value !== null) {
      const index = storeObj.index(indexKey);
      req = index.getAll(value);
    } else {
      req = storeObj.getAll();
    }
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

// ==================================================
// 🔹 API SPECIFICHE PER IL PROGETTO
// ==================================================

// 🏗️ Cantieri
export async function getAllSites() {
  return getAll("sites");
}

export async function addSite(site) {
  site.created = site.created || new Date().toISOString();
  site.status = site.status || "in_progress";
  return addItem("sites", site);
}

export async function updateSite(site) {
  return updateItem("sites", site);
}

// 📋 Sezioni
export async function getSectionsBySite(siteId) {
  return getAll("sections", "siteId", siteId);
}

export async function addSection(section) {
  return addItem("sections", section);
}

// 📸 Foto
export async function addPhoto(sectionId, blob) {
  return addItem("photos", {
    sectionId,
    blob,
    created: new Date().toISOString(),
  });
}

export async function getPhotosBySection(sectionId) {
  return getAll("photos", "sectionId", sectionId);
}

// 🎙️ Audio
export async function addAudio(sectionId, blob) {
  return addItem("audio", {
    sectionId,
    blob,
    created: new Date().toISOString(),
  });
}

export async function getAudioBySection(sectionId) {
  return getAll("audio", "sectionId", sectionId);
}

// ✍️ Firme
export async function addSignature(siteId, role, dataUrl) {
  return addItem("signatures", {
    siteId,
    role,
    dataUrl,
    created: new Date().toISOString(),
  });
}

export async function getSignatures(siteId) {
  return getAll("signatures", "siteId", siteId);
}

// ⚙️ Impostazioni
export async function setSetting(key, value) {
  return updateItem("settings", { key, value });
}

export async function getSetting(key) {
  const storeObj = await tx("settings", "readonly");
  return new Promise((resolve, reject) => {
    const req = storeObj.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = (e) => reject(e);
  });
}
