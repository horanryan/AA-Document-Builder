'use strict';

const DB_NAME = 'absolute-precon-offline-v2';
const DB_VERSION = 1;
let dbPromise;
let dbConnection;
/* Open IndexedDB and create the job and photo stores on first use. */
async function initDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('jobs')) db.createObjectStore('jobs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const connection = req.result;
        dbConnection = connection;
        connection.onclose = () => {
          if (dbConnection !== connection) return;
          dbConnection = null;
          dbPromise = null;
        };
        connection.onversionchange = () => connection.close();
        resolve(connection);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  await dbPromise;
}

/* Small helper wrapper for IndexedDB transactions */
async function txStore(storeName, mode, callback) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await initDb();
      const db = await dbPromise;
      return await new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction(storeName, mode);
          const store = tx.objectStore(storeName);
          let result;
          tx.oncomplete = () => resolve(result);
          tx.onabort = tx.onerror = () => reject(tx.error || new Error(`IndexedDB transaction failed for ${storeName}`));
          result = callback(store);
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      if (attempt === 0 && (err.name === 'InvalidStateError' || /connection is closing/i.test(err.message || ''))) {
        dbConnection = null;
        dbPromise = null;
        continue;
      }
      throw err;
    }
  }
}

/* Insert or replace one record in a named store. */
async function putStore(storeName, value) { return txStore(storeName, 'readwrite', store => store.put(value)); }

/* Delete one record by primary key from a named store. */
async function deleteStore(storeName, id) { return txStore(storeName, 'readwrite', store => store.delete(id)); }

/* Read every record from a named store. */
async function getAll(storeName) {
  return readStore(storeName, store => store.getAll(), result => result || []);
}
/* Retrieve one saved job, returning null when it no longer exists. */
async function getJob(id) {
  return readStore('jobs', store => store.get(id));
}

/* Read from IndexedDB with the same closed-connection recovery as writes. */
async function readStore(storeName, createRequest, normalize = value => value) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await initDb();
      const db = await dbPromise;
      return await new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(storeName, 'readonly');
          const req = createRequest(tx.objectStore(storeName));
          req.onsuccess = () => resolve(normalize(req.result));
          req.onerror = () => reject(req.error);
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      if (attempt === 0 && (err.name === 'InvalidStateError' || /connection is closing/i.test(err.message || ''))) {
        dbConnection = null;
        dbPromise = null;
        continue;
      }
      throw err;
    }
  }
}
