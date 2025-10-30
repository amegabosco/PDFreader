/**
 * Annotation Library - Manage saved text annotations
 */

class AnnotationLibrary {
    constructor() {
        this.dbName = 'PDFReaderAnnotations';
        this.dbVersion = 1;
        this.storeName = 'annotations';
        this.maxAnnotations = 20;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open Annotation DB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Annotation Library initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    objectStore.createIndex('name', 'name', { unique: false });
                    objectStore.createIndex('text', 'text', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async saveAnnotation(name, text, fontSize, color) {
        if (!this.db) await this.init();

        const annotations = await this.getAllAnnotations();
        if (annotations.length >= this.maxAnnotations) {
            const oldest = annotations[annotations.length - 1];
            await this.removeAnnotation(oldest.id);
        }

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);

        const annotation = {
            name: name,
            text: text,
            fontSize: fontSize,
            color: color,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const request = objectStore.add(annotation);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllAnnotations() {
        if (!this.db) await this.init();

        const transaction = this.db.transaction([this.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.storeName);
        const index = objectStore.index('timestamp');

        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, 'prev');
            const results = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    results.push({
                        id: cursor.value.id,
                        name: cursor.value.name,
                        text: cursor.value.text,
                        fontSize: cursor.value.fontSize,
                        color: cursor.value.color,
                        timestamp: cursor.value.timestamp
                    });
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getAnnotation(id) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction([this.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = objectStore.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removeAnnotation(id) {
        if (!this.db) await this.init();

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = objectStore.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll() {
        if (!this.db) await this.init();

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = objectStore.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

const annotationLibrary = new AnnotationLibrary();
