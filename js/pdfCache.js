/**
 * PDF Cache Manager
 * Manages PDF storage in IndexedDB for recent documents
 */

class PDFCache {
    constructor() {
        this.dbName = 'PDFReaderCache';
        this.dbVersion = 1;
        this.storeName = 'recentPDFs';
        this.maxCacheSize = 5; // Maximum number of PDFs to cache
        this.db = null;
    }

    /**
     * Initialize the IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    objectStore.createIndex('fileName', 'fileName', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('Object store created');
                }
            };
        });
    }

    /**
     * Save a PDF to the cache
     * @param {string} fileName - Name of the PDF file
     * @param {ArrayBuffer} data - PDF data
     * @param {number} size - File size in bytes
     * @returns {Promise<number>} The ID of the saved PDF
     */
    async savePDF(fileName, data, size) {
        try {
            if (!this.db) {
                await this.init();
            }

            // Check if we need to remove old PDFs
            const recentPDFs = await this.getRecentPDFs();
            if (recentPDFs.length >= this.maxCacheSize) {
                // Remove the oldest PDF
                const oldest = recentPDFs[recentPDFs.length - 1];
                await this.removePDF(oldest.id);
            }

            // Save the new PDF
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            const pdfRecord = {
                fileName: fileName,
                data: data,
                size: size,
                timestamp: Date.now()
            };

            return new Promise((resolve, reject) => {
                const request = objectStore.add(pdfRecord);

                request.onsuccess = () => {
                    console.log(`PDF "${fileName}" saved to cache with ID ${request.result}`);
                    resolve(request.result);
                };

                request.onerror = () => {
                    console.error('Failed to save PDF:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error saving PDF to cache:', error);
            throw error;
        }
    }

    /**
     * Update an existing PDF in the cache
     * @param {number} id - PDF record ID
     * @param {ArrayBuffer} data - Updated PDF data
     * @param {number} size - Updated file size in bytes
     */
    async updatePDF(id, data, size) {
        try {
            if (!this.db) {
                await this.init();
            }

            // Get existing record to preserve fileName
            const existingRecord = await this.getPDF(id);
            if (!existingRecord) {
                console.warn(`PDF with ID ${id} not found, cannot update`);
                return null;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            const updatedRecord = {
                id: id,
                fileName: existingRecord.fileName,
                data: data,
                size: size,
                timestamp: Date.now() // Update timestamp
            };

            return new Promise((resolve, reject) => {
                const request = objectStore.put(updatedRecord);

                request.onsuccess = () => {
                    console.log(`PDF with ID ${id} updated in cache`);
                    resolve(request.result);
                };

                request.onerror = () => {
                    console.error('Failed to update PDF:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error updating PDF in cache:', error);
            throw error;
        }
    }

    /**
     * Get all recent PDFs, sorted by timestamp (newest first)
     */
    async getRecentPDFs() {
        try {
            if (!this.db) {
                await this.init();
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const index = objectStore.index('timestamp');

            return new Promise((resolve, reject) => {
                const request = index.openCursor(null, 'prev'); // 'prev' for descending order
                const results = [];

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        results.push({
                            id: cursor.value.id,
                            fileName: cursor.value.fileName,
                            size: cursor.value.size,
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
            console.error('Error getting recent PDFs:', error);
            return [];
        }
    }

    /**
     * Get a specific PDF by ID
     * @param {number} id - PDF record ID
     */
    async getPDF(id) {
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
            console.error('Error getting PDF:', error);
            throw error;
        }
    }

    /**
     * Remove a PDF from the cache
     * @param {number} id - PDF record ID
     */
    async removePDF(id) {
        try {
            if (!this.db) {
                await this.init();
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = objectStore.delete(id);

                request.onsuccess = () => {
                    console.log(`PDF with ID ${id} removed from cache`);
                    resolve();
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error removing PDF:', error);
            throw error;
        }
    }

    /**
     * Clear all cached PDFs
     */
    async clearCache() {
        try {
            if (!this.db) {
                await this.init();
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = objectStore.clear();

                request.onsuccess = () => {
                    console.log('Cache cleared successfully');
                    resolve();
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error clearing cache:', error);
            throw error;
        }
    }

    /**
     * Get total cache size in bytes
     */
    async getCacheSize() {
        try {
            const recentPDFs = await this.getRecentPDFs();
            const fullPDFs = await Promise.all(recentPDFs.map(pdf => this.getPDF(pdf.id)));
            return fullPDFs.reduce((total, pdf) => total + (pdf?.size || 0), 0);
        } catch (error) {
            console.error('Error calculating cache size:', error);
            return 0;
        }
    }

    /**
     * Format bytes to human-readable format
     * @param {number} bytes
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Format timestamp to human-readable date
     * @param {number} timestamp
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    }
}

// Create global instance
const pdfCache = new PDFCache();
