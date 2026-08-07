const DB_NAME = "cvfinance-cache-v1";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "key" });
      if (!db.objectStoreNames.contains("mutations")) db.createObjectStore("mutations", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function useStore(name, mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export const cacheGet = key => useStore("cache", "readonly", store => store.get(key)).then(value => value?.value || null);
export const cachePut = (key, value) => useStore("cache", "readwrite", store => store.put({ key, value }));
export const mutationPut = mutation => useStore("mutations", "readwrite", store => store.put(mutation));
export const mutationDelete = key => useStore("mutations", "readwrite", store => store.delete(key));
export const mutationList = () => useStore("mutations", "readonly", store => store.getAll());
export const mutationCount = () => useStore("mutations", "readonly", store => store.count());
export async function mutationClear() {
  return useStore("mutations", "readwrite", store => store.clear());
}
