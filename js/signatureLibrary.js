/**
 * Signature Library Manager
 * Manages saved signatures in IndexedDB
 */

class SignatureLibrary {
    constructor() {
        this.dbName = 'PDFReaderSignatures';
        this.dbVersion = 1;
        this.storeName = 'signatures';
        this.maxSignatures = 10;
        this.db = null;
    }

    /**
     * Initialize the IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open Signature DB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Signature Library initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    objectStore.createIndex('name', 'name', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('Signature store created');
                }
            };
        });
    }

    /**
     * Save a signature
     * @param {string} name - Name for the signature
     * @param {string} dataUrl - Signature image as data URL
     * @returns {Promise<number>} The ID of the saved signature
     */
    async saveSignature(name, dataUrl) {
        try {
            if (!this.db) {
                await this.init();
            }

            // Check if we need to remove old signatures
            const signatures = await this.getAllSignatures();
            if (signatures.length >= this.maxSignatures) {
                const oldest = signatures[signatures.length - 1];
                await this.removeSignature(oldest.id);
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            const signature = {
                name: name,
                dataUrl: dataUrl,
                timestamp: Date.now()
            };

            return new Promise((resolve, reject) => {
                const request = objectStore.add(signature);

                request.onsuccess = () => {
                    console.log(`Signature "${name}" saved with ID ${request.result}`);
                    resolve(request.result);
                };

                request.onerror = () => {
                    console.error('Failed to save signature:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error saving signature:', error);
            throw error;
        }
    }

    /**
     * Get all signatures, sorted by timestamp (newest first)
     */
    async getAllSignatures() {
        try {
            if (!this.db) {
                await this.init();
            }

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
                            dataUrl: cursor.value.dataUrl,
                            timestamp: cursor.value.timestamp
                        });
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error getting signatures:', error);
            return [];
        }
    }

    /**
     * Get a specific signature by ID
     */
    async getSignature(id) {
        try {
            if (!this.db) {
                await this.init();
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = objectStore.get(id);

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error getting signature:', error);
            throw error;
        }
    }

    /**
     * Remove a signature
     */
    async removeSignature(id) {
        try {
            if (!this.db) {
                await this.init();
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = objectStore.delete(id);

                request.onsuccess = () => {
                    console.log(`Signature with ID ${id} removed`);
                    resolve();
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error removing signature:', error);
            throw error;
        }
    }

    /**
     * Clear all signatures
     */
    async clearAll() {
        try {
            if (!this.db) {
                await this.init();
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = objectStore.clear();

                request.onsuccess = () => {
                    console.log('All signatures cleared');
                    resolve();
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error clearing signatures:', error);
            throw error;
        }
    }

    /**
     * Format timestamp to human-readable date
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
}

// Create global instance
const signatureLibrary = new SignatureLibrary();
