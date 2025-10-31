/**
 * Worker Manager - Manages Web Workers for PDF operations
 */

class WorkerManager {
    constructor() {
        this.worker = null;
        this.pendingOperations = new Map();
        this.nextId = 1;
        this.workerAvailable = false;
    }

    /**
     * Initialize worker
     */
    init() {
        if (this.worker) return;

        try {
            this.worker = new Worker('js/pdfWorker.js');

            this.worker.addEventListener('message', (e) => {
                this.handleWorkerMessage(e.data);
            });

            this.worker.addEventListener('error', (e) => {
                console.error('Worker error:', e);
                this.workerAvailable = false;
            });

            this.workerAvailable = true;
            console.log('Worker Manager initialized');
        } catch (error) {
            console.warn('Workers not available (file:// protocol?), using fallback:', error.message);
            this.workerAvailable = false;
            this.worker = null;
        }
    }

    /**
     * Handle message from worker
     */
    handleWorkerMessage(data) {
        const { id, success, result, error, progress, message } = data;

        // Handle progress updates
        if (progress !== undefined) {
            this.updateProgress(id, progress, message);
            return;
        }

        // Handle operation completion
        const operation = this.pendingOperations.get(id);
        if (!operation) return;

        if (success) {
            operation.resolve(result);
        } else {
            operation.reject(new Error(error));
        }

        this.pendingOperations.delete(id);
        this.hideProgress(id);
    }

    /**
     * Execute operation in worker (or fallback to sync)
     */
    async execute(operation, data) {
        if (!this.worker) {
            this.init();
        }

        // Fallback to synchronous operations if worker not available
        if (!this.workerAvailable) {
            console.log(`Using fallback for ${operation} (workers unavailable)`);
            return this.executeFallback(operation, data);
        }

        const id = this.nextId++;

        return new Promise((resolve, reject) => {
            this.pendingOperations.set(id, { resolve, reject, operation });

            // Show progress
            this.showProgress(id, operation);

            // Send to worker
            this.worker.postMessage({ id, operation, data });

            // Timeout after 2 minutes
            setTimeout(() => {
                if (this.pendingOperations.has(id)) {
                    this.pendingOperations.delete(id);
                    this.hideProgress(id);
                    reject(new Error('Operation timeout'));
                }
            }, 120000);
        });
    }

    /**
     * Fallback to synchronous operations using pdfTools
     */
    async executeFallback(operation, data) {
        showNotification(`Processing ${operation}...`, 'info', 2000);

        try {
            let result;

            switch (operation) {
                case 'merge':
                    result = await tools.mergePDFs(data.pdfs);
                    break;
                case 'split':
                    result = await tools.splitPDF(data.pdfData, data.splitAt);
                    break;
                case 'rotate':
                    result = await tools.rotatePDF(data.pdfData, data.pageIndices, data.rotation);
                    break;
                case 'reorder':
                    result = await tools.reorderPages(data.pdfData, data.fromPage, data.toPage);
                    break;
                case 'compress':
                    result = await tools.compressPDF(data.pdfData);
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }

            return result;
        } catch (error) {
            console.error('Fallback operation failed:', error);
            throw error;
        }
    }

    /**
     * Show progress indicator
     */
    showProgress(id, operation) {
        const progressId = `worker-progress-${id}`;

        // Create progress element
        const progressEl = document.createElement('div');
        progressEl.id = progressId;
        progressEl.className = 'worker-progress';
        progressEl.innerHTML = `
            <div class="worker-progress-content">
                <div class="worker-progress-spinner">
                    <i class="ti ti-loader-2"></i>
                </div>
                <div class="worker-progress-text">
                    <div class="worker-progress-title">${this.getOperationTitle(operation)}</div>
                    <div class="worker-progress-message" id="${progressId}-message">Processing...</div>
                    <div class="worker-progress-bar">
                        <div class="worker-progress-bar-fill" id="${progressId}-bar" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(progressEl);
        setTimeout(() => progressEl.classList.add('show'), 10);
    }

    /**
     * Update progress
     */
    updateProgress(id, progress, message) {
        const progressId = `worker-progress-${id}`;
        const barEl = document.getElementById(`${progressId}-bar`);
        const messageEl = document.getElementById(`${progressId}-message`);

        if (barEl) {
            barEl.style.width = progress + '%';
        }
        if (messageEl && message) {
            messageEl.textContent = message;
        }
    }

    /**
     * Hide progress indicator
     */
    hideProgress(id) {
        const progressId = `worker-progress-${id}`;
        const progressEl = document.getElementById(progressId);

        if (progressEl) {
            progressEl.classList.remove('show');
            setTimeout(() => progressEl.remove(), 300);
        }
    }

    /**
     * Get operation title
     */
    getOperationTitle(operation) {
        const titles = {
            merge: 'Merging PDFs',
            split: 'Splitting PDF',
            rotate: 'Rotating Pages',
            reorder: 'Reordering Pages',
            compress: 'Compressing PDF'
        };
        return titles[operation] || 'Processing';
    }

    /**
     * Terminate worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.pendingOperations.clear();
        }
    }
}

// Global worker manager instance
const workerManager = new WorkerManager();
