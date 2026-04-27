/**
 * Worker Manager - Pool de Web Workers pour les operations PDF
 * Caporal DJOSSOU Yves - Transformation single worker -> pool de workers
 */

class WorkerManager {
    constructor() {
        this.poolSize = Math.min(navigator.hardwareConcurrency || 4, 4);
        this.workers = [];
        this.available = [];
        this.queue = [];
        this.pendingOperations = new Map();
        this.nextId = 1;
        this.workersAvailable = false;
    }

    /**
     * Initialize worker pool
     */
    init() {
        if (this.workers.length > 0) return;

        try {
            for (let i = 0; i < this.poolSize; i++) {
                const worker = new Worker('js/pdfWorker.js');

                worker.addEventListener('message', (e) => {
                    this.handleMessage(e, worker);
                });

                worker.addEventListener('error', (e) => {
                    console.error(`Worker ${i} error:`, e);
                    // Remove worker from available pool on error
                    const idx = this.available.indexOf(worker);
                    if (idx !== -1) {
                        this.available.splice(idx, 1);
                    }
                    // Reject all pending operations assigned to this worker
                    for (const [id, op] of this.pendingOperations.entries()) {
                        if (op.worker === worker) {
                            op.reject(new Error('Worker crashed'));
                            this.pendingOperations.delete(id);
                            this.hideProgress(id);
                        }
                    }
                    // Try to replace the crashed worker
                    try {
                        const replacement = new Worker('js/pdfWorker.js');
                        replacement.addEventListener('message', (ev) => {
                            this.handleMessage(ev, replacement);
                        });
                        replacement.addEventListener('error', (ev) => {
                            console.error('Replacement worker error:', ev);
                            const rIdx = this.available.indexOf(replacement);
                            if (rIdx !== -1) this.available.splice(rIdx, 1);
                        });
                        const wIdx = this.workers.indexOf(worker);
                        if (wIdx !== -1) this.workers[wIdx] = replacement;
                        this.available.push(replacement);
                        this.processQueue();
                    } catch (err) {
                        console.warn('Could not replace crashed worker:', err.message);
                    }
                });

                this.workers.push(worker);
                this.available.push(worker);
            }

            this.workersAvailable = true;
            console.log(`Worker pool initialized: ${this.poolSize} workers`);
        } catch (error) {
            console.warn('Workers not available (file:// protocol?), using fallback:', error.message);
            this.workersAvailable = false;
            this.workers = [];
            this.available = [];
        }
    }

    /**
     * Handle message from a specific worker
     */
    handleMessage(e, worker) {
        const data = e.data;
        const { id, success, result, error, progress, message } = data;

        // Handle progress updates — worker stays busy
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

        // Return worker to available pool and process queue
        this.available.push(worker);
        this.processQueue();
    }

    /**
     * Execute operation in worker pool (or fallback to sync)
     */
    async execute(operation, data) {
        if (this.workers.length === 0) {
            this.init();
        }

        // Fallback to synchronous operations if workers not available
        if (!this.workersAvailable) {
            return this.executeFallback(operation, data);
        }

        const id = this.nextId++;

        return new Promise((resolve, reject) => {
            const task = { id, operation, data, resolve, reject };

            if (this.available.length > 0) {
                this.dispatch(task);
            } else {
                // All workers busy — enqueue
                this.queue.push(task);
            }
        });
    }

    /**
     * Dispatch a task to an available worker
     */
    dispatch(task) {
        const { id, operation, data, resolve, reject } = task;
        const worker = this.available.pop();

        this.pendingOperations.set(id, { resolve, reject, operation, worker });

        // Show progress
        this.showProgress(id, operation);

        // Send to worker with Transferable Objects for zero-copy performance
        const transferables = [];
        if (data && data.pdfData instanceof ArrayBuffer) {
            transferables.push(data.pdfData);
        }
        worker.postMessage({ id, operation, data }, transferables);

        // Timeout after 2 minutes
        setTimeout(() => {
            if (this.pendingOperations.has(id)) {
                const op = this.pendingOperations.get(id);
                this.pendingOperations.delete(id);
                this.hideProgress(id);
                op.reject(new Error('Operation timeout'));

                // Return the worker to available pool even on timeout
                if (op.worker && !this.available.includes(op.worker)) {
                    this.available.push(op.worker);
                    this.processQueue();
                }
            }
        }, 120000);
    }

    /**
     * Process the queue — dispatch pending tasks to available workers
     */
    processQueue() {
        while (this.queue.length > 0 && this.available.length > 0) {
            const task = this.queue.shift();
            this.dispatch(task);
        }
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
        const title = this.getOperationTitle(operation);

        // Create progress element using safe DOM methods
        const progressEl = document.createElement('div');
        progressEl.id = progressId;
        progressEl.className = 'worker-progress';

        const content = document.createElement('div');
        content.className = 'worker-progress-content';

        const spinner = document.createElement('div');
        spinner.className = 'worker-progress-spinner';
        const icon = document.createElement('i');
        icon.className = 'ti ti-loader-2';
        spinner.appendChild(icon);

        const textWrapper = document.createElement('div');
        textWrapper.className = 'worker-progress-text';

        const titleEl = document.createElement('div');
        titleEl.className = 'worker-progress-title';
        titleEl.textContent = title;

        const messageEl = document.createElement('div');
        messageEl.className = 'worker-progress-message';
        messageEl.id = `${progressId}-message`;
        messageEl.textContent = 'Processing...';

        const barContainer = document.createElement('div');
        barContainer.className = 'worker-progress-bar';

        const barFill = document.createElement('div');
        barFill.className = 'worker-progress-bar-fill';
        barFill.id = `${progressId}-bar`;
        barFill.style.width = '0%';

        barContainer.appendChild(barFill);
        textWrapper.appendChild(titleEl);
        textWrapper.appendChild(messageEl);
        textWrapper.appendChild(barContainer);

        content.appendChild(spinner);
        content.appendChild(textWrapper);
        progressEl.appendChild(content);

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
            compress: 'Compressing PDF',
            insertObjects: 'Inserting Objects'
        };
        return titles[operation] || 'Processing';
    }

    /**
     * Terminate all workers and clear state
     */
    terminate() {
        for (const worker of this.workers) {
            worker.terminate();
        }
        this.workers = [];
        this.available = [];
        this.queue = [];
        // Reject any pending operations
        for (const [id, op] of this.pendingOperations.entries()) {
            op.reject(new Error('Worker pool terminated'));
            this.hideProgress(id);
        }
        this.pendingOperations.clear();
        this.workersAvailable = false;
    }
}

// Global worker manager instance
const workerManager = new WorkerManager();
