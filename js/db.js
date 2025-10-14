// js/db.js
// IndexedDB helper for Check List Cantieri
const DB_NAME = "checklist_levratti_db";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("worksites")) {
        const s = db.createObjectStore("worksites", { keyPath: "id", autoIncrement: true });
        s.createIndex("status", "status", { unique: false });
        s.createIndex("name", "name", { unique: false });
      }
      if (!db.objectStoreNames.contains("photos")) {
        const p = db.createObjectStore("photos", { keyPath: "id", autoIncrement: true });
        p.createIndex("siteId", "siteId", { unique: false });
      }
      if (!db.objectStoreNames.contains("signatures")) {
        const sg = db.createObjectStore("signatures", { keyPath: "id", autoIncrement: true });
        sg.createIndex("siteId", "siteId", { unique: false });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = callback(store);
    } catch (err) {
      reject(err);
    }
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = (ev) => reject(ev.target.error);
  });
}

// Worksites
export async function getAllWorksites() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("worksites", "readonly");
    const store = tx.objectStore("worksites");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e);
  });
}

export async function getWorksite(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("worksites", "readonly");
    const store = tx.objectStore("worksites");
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e);
  });
}

export async function addWorksite(site) {
  // site: { name, descr, created, status, checklist: [boolean*7], verificatore?, meta? }
  return withStore("worksites", "readwrite", (store) => store.add(site));
}

export async function updateWorksite(site) {
  return withStore("worksites", "readwrite", (store) => store.put(site));
}

export async function deleteWorksite(id) {
  return withStore("worksites", "readwrite", (store) => store.delete(id));
}

// Photos
export async function addPhoto(siteId, blobOrDataUrl, meta = {}) {
  return withStore("photos", "readwrite", (store) =>
    store.add({ siteId, data: blobOrDataUrl, meta, created: new Date().toISOString() })
  );
}

export async function getPhotosBySite(siteId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readonly");
    const idx = tx.objectStore("photos").index("siteId");
    const req = idx.getAll(siteId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e);
  });
}

export async function deletePhoto(id) {
  return withStore("photos", "readwrite", (store) => store.delete(id));
}

// Signatures
export async function addSignature(siteId, role, dataUrl) {
  return withStore("signatures", "readwrite", (store) =>
    store.add({ siteId, role, dataUrl, created: new Date().toISOString() })
  );
}

export async function getSignaturesBySite(siteId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("signatures", "readonly");
    const idx = tx.objectStore("signatures").index("siteId");
    const req = idx.getAll(siteId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e);
  });
}

// Settings
export async function setSetting(key, value) {
  return withStore("settings", "readwrite", (store) => store.put({ key, value }));
}
export async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readonly");
    const store = tx.objectStore("settings");
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = (e) => reject(e);
  });
}
