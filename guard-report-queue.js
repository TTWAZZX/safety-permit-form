'use strict';

const guardReportQueue = (() => {
    const legacyKey = 'tsh_violation_report_queue_v1';
    const databaseName = 'tsh-guard-report-queue';
    const storeName = 'reports';
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(databaseName) : null;
    const events = new EventTarget();
    let connection;

    function open() {
        if (connection) return connection;
        connection = new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "id" });
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => { db.close(); connection = null; };
                db.onclose = () => { connection = null; };
                resolve(db);
            };
            request.onerror = () => reject(request.error);
        }).catch(error => { connection = null; throw error; });
        return connection;
    }

    async function transact(mode, operation) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, mode);
            const request = operation(transaction.objectStore(storeName));
            transaction.oncomplete = () => resolve(request.result);
            transaction.onabort = () => reject(request.error || transaction.error);
        });
    }

    function readLegacy() {
        const rows = JSON.parse(localStorage.getItem(legacyKey) || '[]');
        if (!Array.isArray(rows)) throw new Error('Invalid legacy report queue');
        return rows.filter(row => row?.id && row.payload);
    }

    async function list() {
        let entries = [];
        let unavailable = false;
        try {
            entries = await transact('readonly', store => store.getAll());
        } catch {
            unavailable = true;
        }
        try {
            const ids = new Set(entries.map(entry => entry.id));
            entries.push(...readLegacy().filter(row => !ids.has(row.id)).map(row => ({ ...row, legacy: true })));
        } catch {
            unavailable = true;
        }
        entries.sort((a, b) => String(a.queued_at).localeCompare(String(b.queued_at)));
        return { entries, unavailable };
    }

    function signalChange() { events.dispatchEvent(new Event('change')); }
    if (channel) channel.onmessage = signalChange;
    window.addEventListener('storage', event => {
        if (event.key === legacyKey || event.key === null) signalChange();
    });
    function notify() {
        signalChange();
        channel?.postMessage('change');
    }

    return {
        list,
        watch: callback => events.addEventListener('change', callback),
        async add(entry) {
            try {
                await transact('readwrite', store => store.put(entry));
            } catch (error) {
                if (entry.attachment) throw error;
                const remaining = readLegacy().filter(row => row.id !== entry.id);
                localStorage.setItem(legacyKey, JSON.stringify([...remaining, entry]));
            }
            notify();
        },
        async remove(entry) {
            if (entry.legacy) {
                const remaining = readLegacy().filter(row => row.id !== entry.id);
                localStorage.setItem(legacyKey, JSON.stringify(remaining));
            } else {
                await transact('readwrite', store => store.delete(entry.id));
            }
            notify();
        }
    };
})();
