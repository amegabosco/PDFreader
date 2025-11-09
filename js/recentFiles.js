/**
 * Recent Files Manager
 * Manages the list of recently opened PDF files in localStorage
 */

class RecentFilesManager {
    constructor() {
        this.maxFiles = 3; // Maximum number of recent files to store
        this.storageKey = 'unops_recent_files';
    }

    /**
     * Get recent files from localStorage
     * @returns {Array} Array of recent file objects
     */
    getRecentFiles() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load recent files:', error);
            return [];
        }
    }

    /**
     * Add a file to recent files list
     * @param {string} fileName - Name of the file
     * @param {ArrayBuffer} fileData - File data (will be stored in IndexedDB via pdfCache)
     * @param {string} cacheId - Cache ID from pdfCache
     */
    addRecentFile(fileName, cacheId) {
        try {
            let recentFiles = this.getRecentFiles();

            // Remove existing entry if file was already opened
            recentFiles = recentFiles.filter(f => f.name !== fileName);

            // Add new entry at the beginning
            recentFiles.unshift({
                name: fileName,
                cacheId: cacheId,
                timestamp: Date.now()
            });

            // Keep only the most recent files
            recentFiles = recentFiles.slice(0, this.maxFiles);

            // Save to localStorage
            localStorage.setItem(this.storageKey, JSON.stringify(recentFiles));

            console.log(`📁 [Recent Files] Added: ${fileName}`);

            // Update UI
            this.renderRecentFiles();
        } catch (error) {
            console.error('Failed to add recent file:', error);
        }
    }

    /**
     * Remove a file from recent files list
     * @param {string} fileName - Name of the file to remove
     */
    removeRecentFile(fileName) {
        try {
            let recentFiles = this.getRecentFiles();
            recentFiles = recentFiles.filter(f => f.name !== fileName);
            localStorage.setItem(this.storageKey, JSON.stringify(recentFiles));

            console.log(`🗑️ [Recent Files] Removed: ${fileName}`);

            // Update UI
            this.renderRecentFiles();
        } catch (error) {
            console.error('Failed to remove recent file:', error);
        }
    }

    /**
     * Clear all recent files
     */
    clearRecentFiles() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('🗑️ [Recent Files] Cleared all');
            this.renderRecentFiles();
        } catch (error) {
            console.error('Failed to clear recent files:', error);
        }
    }

    /**
     * Load a recent file
     * @param {string} cacheId - Cache ID of the file to load
     */
    async loadRecentFile(cacheId, fileName) {
        try {
            console.log(`📂 [Recent Files] Loading: ${fileName}`);

            // Load from cache
            const pdfData = await pdfCache.getPDF(cacheId);

            if (!pdfData) {
                showNotification(`File "${fileName}" not found in cache`, 'error');
                // Remove from recent files
                this.removeRecentFile(fileName);
                return;
            }

            // Load the PDF
            await viewer.loadPDF(pdfData);

            // Update global variables
            window.currentPDFData = pdfData;
            window.currentCacheId = cacheId;

            // Update metadata
            if (typeof updateMetadataDisplay === 'function') {
                updateMetadataDisplay();
            }

            showNotification(`Loaded: ${fileName}`, 'success');
        } catch (error) {
            console.error('Failed to load recent file:', error);
            showNotification(`Failed to load "${fileName}"`, 'error');
            // Remove from recent files if load failed
            this.removeRecentFile(fileName);
        }
    }

    /**
     * Render recent files in the UI
     */
    renderRecentFiles() {
        const container = document.getElementById('recentFilesPanel');
        if (!container) return;

        const recentFiles = this.getRecentFiles();

        // Always show the panel
        container.style.display = 'block';

        const listContainer = container.querySelector('.recent-files-list');
        if (!listContainer) return;

        // Clear existing items
        listContainer.innerHTML = '';

        // If no files, show empty state
        if (recentFiles.length === 0) {
            listContainer.innerHTML = `
                <div class="recent-files-empty">
                    <i class="ti ti-file-off"></i>
                    <span>No recent files</span>
                </div>
            `;
            return;
        }

        // Render each file
        recentFiles.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'recent-file-item';
            fileItem.title = `Click to open: ${file.name}`;

            fileItem.innerHTML = `
                <i class="ti ti-file-text"></i>
                <span class="recent-file-name">${this.truncateFileName(file.name, 20)}</span>
                <button class="recent-file-remove" data-filename="${file.name}" title="Remove from recent">
                    <i class="ti ti-x"></i>
                </button>
            `;

            // Click handler to load file
            fileItem.addEventListener('click', (e) => {
                if (e.target.closest('.recent-file-remove')) return;
                this.loadRecentFile(file.cacheId, file.name);
            });

            // Remove button handler
            const removeBtn = fileItem.querySelector('.recent-file-remove');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeRecentFile(file.name);
            });

            listContainer.appendChild(fileItem);
        });
    }

    /**
     * Truncate long file names
     * @param {string} fileName - File name to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated file name
     */
    truncateFileName(fileName, maxLength) {
        if (fileName.length <= maxLength) return fileName;
        const ext = fileName.split('.').pop();
        const nameWithoutExt = fileName.slice(0, fileName.length - ext.length - 1);
        const truncated = nameWithoutExt.slice(0, maxLength - ext.length - 4) + '...';
        return `${truncated}.${ext}`;
    }
}

// Create global instance
window.recentFilesManager = new RecentFilesManager();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    recentFilesManager.renderRecentFiles();
});
