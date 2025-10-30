/**
 * PDF Viewer Module
 * Handles PDF rendering using PDF.js
 */

class PDFViewer {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.5;
        this.canvas = document.getElementById('pdfCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasContainer = null;

        // Hand tool state
        this.handToolActive = false;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.scrollLeft = 0;
        this.scrollTop = 0;

        // View mode state
        this.viewMode = 'single'; // 'single' or 'scroll'
        this.allPageCanvases = [];

        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

        this.initializeControls();
    }

    /**
     * Initialize viewer controls
     */
    initializeControls() {
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderPage(this.currentPage);
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
                this.renderPage(this.currentPage);
            }
        });

        document.getElementById('zoomIn').addEventListener('click', () => {
            this.scale += 0.25;
            if (this.viewMode === 'single') {
                this.renderPage(this.currentPage);
            } else {
                this.renderScrollView();
            }
            this.updateZoomLevel();
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            if (this.scale > 0.5) {
                this.scale -= 0.25;
                if (this.viewMode === 'single') {
                    this.renderPage(this.currentPage);
                } else {
                    this.renderScrollView();
                }
                this.updateZoomLevel();
            }
        });

        // View mode controls
        document.getElementById('singlePageView').addEventListener('click', () => {
            this.setViewMode('single');
        });

        document.getElementById('scrollView').addEventListener('click', () => {
            this.setViewMode('scroll');
        });
    }

    /**
     * Initialize hand tool (pan) functionality
     */
    initializeHandTool() {
        this.canvasContainer = document.querySelector('.pdf-canvas-container');

        this.canvasContainer.addEventListener('mousedown', (e) => {
            if (!this.handToolActive) return;

            this.isPanning = true;
            this.startX = e.pageX - this.canvasContainer.offsetLeft;
            this.startY = e.pageY - this.canvasContainer.offsetTop;
            this.scrollLeft = this.canvasContainer.scrollLeft;
            this.scrollTop = this.canvasContainer.scrollTop;

            this.canvasContainer.style.cursor = 'grabbing';
            e.preventDefault();
        });

        this.canvasContainer.addEventListener('mousemove', (e) => {
            if (!this.isPanning || !this.handToolActive) return;

            e.preventDefault();
            const x = e.pageX - this.canvasContainer.offsetLeft;
            const y = e.pageY - this.canvasContainer.offsetTop;
            const walkX = (x - this.startX) * 2; // Multiply for faster scrolling
            const walkY = (y - this.startY) * 2;

            this.canvasContainer.scrollLeft = this.scrollLeft - walkX;
            this.canvasContainer.scrollTop = this.scrollTop - walkY;
        });

        this.canvasContainer.addEventListener('mouseup', () => {
            if (!this.handToolActive) return;
            this.isPanning = false;
            this.canvasContainer.style.cursor = 'grab';
        });

        this.canvasContainer.addEventListener('mouseleave', () => {
            if (!this.handToolActive) return;
            this.isPanning = false;
            this.canvasContainer.style.cursor = 'grab';
        });

        // Touch support for mobile
        this.canvasContainer.addEventListener('touchstart', (e) => {
            if (!this.handToolActive) return;

            this.isPanning = true;
            const touch = e.touches[0];
            this.startX = touch.pageX - this.canvasContainer.offsetLeft;
            this.startY = touch.pageY - this.canvasContainer.offsetTop;
            this.scrollLeft = this.canvasContainer.scrollLeft;
            this.scrollTop = this.canvasContainer.scrollTop;
            e.preventDefault();
        });

        this.canvasContainer.addEventListener('touchmove', (e) => {
            if (!this.isPanning || !this.handToolActive) return;

            e.preventDefault();
            const touch = e.touches[0];
            const x = touch.pageX - this.canvasContainer.offsetLeft;
            const y = touch.pageY - this.canvasContainer.offsetTop;
            const walkX = (x - this.startX) * 2;
            const walkY = (y - this.startY) * 2;

            this.canvasContainer.scrollLeft = this.scrollLeft - walkX;
            this.canvasContainer.scrollTop = this.scrollTop - walkY;
        });

        this.canvasContainer.addEventListener('touchend', () => {
            if (!this.handToolActive) return;
            this.isPanning = false;
        });
    }

    /**
     * Enable hand tool
     */
    enableHandTool() {
        this.handToolActive = true;
        if (this.canvasContainer) {
            this.canvasContainer.style.cursor = 'grab';
            this.canvasContainer.classList.add('hand-tool-active');
        }
    }

    /**
     * Disable hand tool
     */
    disableHandTool() {
        this.handToolActive = false;
        this.isPanning = false;
        if (this.canvasContainer) {
            this.canvasContainer.style.cursor = 'default';
            this.canvasContainer.classList.remove('hand-tool-active');
        }
    }

    /**
     * Toggle hand tool
     */
    toggleHandTool() {
        if (this.handToolActive) {
            this.disableHandTool();
            return false;
        } else {
            this.enableHandTool();
            return true;
        }
    }

    /**
     * Load a PDF file from ArrayBuffer
     * @param {ArrayBuffer} arrayBuffer - PDF file data
     */
    async loadPDF(arrayBuffer) {
        try {
            // Load the PDF document
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;

            // Update UI
            document.getElementById('totalPages').textContent = this.totalPages;
            document.getElementById('currentPage').textContent = this.currentPage;

            // Render first page
            await this.renderPage(this.currentPage);

            // Show viewer area, hide upload area
            document.getElementById('uploadArea').style.display = 'none';
            document.getElementById('viewerArea').style.display = 'flex';

            // Initialize hand tool (only once)
            if (!this.canvasContainer) {
                this.initializeHandTool();
            }

            // Enable tool buttons
            this.enableTools();

            console.log('PDF loaded successfully:', this.totalPages, 'pages');
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Failed to load PDF. Please try another file.');
        }
    }

    /**
     * Render a specific page
     * @param {number} pageNum - Page number to render
     */
    async renderPage(pageNum) {
        try {
            // If switching from scroll view to single page, restore the main canvas
            const container = document.querySelector('.pdf-canvas-container');
            if (this.viewMode === 'single' && !container.contains(this.canvas)) {
                container.innerHTML = '';
                container.appendChild(this.canvas);
            }

            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            // Set canvas dimensions
            this.canvas.height = viewport.height;
            this.canvas.width = viewport.width;

            // Render the page
            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Update page info
            document.getElementById('currentPage').textContent = pageNum;

            console.log('Rendered page:', pageNum);
        } catch (error) {
            console.error('Error rendering page:', error);
        }
    }

    /**
     * Update zoom level display
     */
    updateZoomLevel() {
        const percentage = Math.round((this.scale / 1.5) * 100);
        document.getElementById('zoomLevel').textContent = percentage + '%';
    }

    /**
     * Enable tool buttons after PDF is loaded
     */
    enableTools() {
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            // Always keep upload button enabled
            if (btn.dataset.tool === 'upload') {
                btn.removeAttribute('disabled');
            } else if (btn.hasAttribute('disabled')) {
                btn.removeAttribute('disabled');
            }
        });
    }

    /**
     * Get current PDF document
     */
    getPDFDocument() {
        return this.pdfDoc;
    }

    /**
     * Reset viewer
     */
    reset() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.5;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Disable hand tool
        this.disableHandTool();

        // Reset UI
        document.getElementById('uploadArea').style.display = 'flex';
        document.getElementById('viewerArea').style.display = 'none';

        // Disable tool buttons (except upload and download)
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(btn => {
            if (btn.dataset.tool !== 'upload' && btn.dataset.tool !== 'download') {
                btn.setAttribute('disabled', 'true');
            }
            btn.classList.remove('active');
        });
    }

    /**
     * Set view mode (single page or continuous scroll)
     * @param {string} mode - 'single' or 'scroll'
     */
    async setViewMode(mode) {
        if (this.viewMode === mode || !this.pdfDoc) return;

        this.viewMode = mode;

        // Update button states
        const singleBtn = document.getElementById('singlePageView');
        const scrollBtn = document.getElementById('scrollView');

        if (mode === 'single') {
            singleBtn.classList.add('active');
            scrollBtn.classList.remove('active');

            // Show page navigation controls
            document.getElementById('prevPage').style.display = '';
            document.getElementById('nextPage').style.display = '';

            // Render current page
            await this.renderPage(this.currentPage);
        } else {
            scrollBtn.classList.add('active');
            singleBtn.classList.remove('active');

            // Hide prev/next buttons in scroll mode (keep page info visible)
            document.getElementById('prevPage').style.display = 'none';
            document.getElementById('nextPage').style.display = 'none';

            // Render all pages in scroll mode
            await this.renderScrollView();
        }

        console.log(`View mode changed to: ${mode}`);
    }

    /**
     * Render all pages in continuous scroll view
     */
    async renderScrollView() {
        if (!this.pdfDoc) return;

        const container = document.querySelector('.pdf-canvas-container');

        // Clear existing content
        container.innerHTML = '';
        this.allPageCanvases = [];

        // Create a wrapper for all pages
        const pagesWrapper = document.createElement('div');
        pagesWrapper.id = 'scrollViewWrapper';
        pagesWrapper.style.display = 'flex';
        pagesWrapper.style.flexDirection = 'column';
        pagesWrapper.style.alignItems = 'center';
        pagesWrapper.style.gap = '1rem';
        pagesWrapper.style.padding = '2rem 0';

        // Render each page
        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'scroll-page-wrapper';
            pageWrapper.style.boxShadow = '0 4px 12px var(--shadow)';
            pageWrapper.style.border = '1px solid var(--border)';
            pageWrapper.style.backgroundColor = 'white';

            const pageCanvas = document.createElement('canvas');
            pageCanvas.id = `page-${pageNum}`;
            pageCanvas.dataset.pageNum = pageNum;

            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            pageCanvas.width = viewport.width;
            pageCanvas.height = viewport.height;

            const ctx = pageCanvas.getContext('2d');
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            pageWrapper.appendChild(pageCanvas);
            pagesWrapper.appendChild(pageWrapper);
            this.allPageCanvases.push(pageCanvas);
        }

        container.appendChild(pagesWrapper);

        // Setup scroll listener to update current page indicator
        this.setupScrollPageTracking();

        console.log(`Rendered ${this.totalPages} pages in scroll view`);
    }

    /**
     * Track which page is currently visible during scrolling
     */
    setupScrollPageTracking() {
        const container = document.querySelector('.pdf-canvas-container');

        // Remove existing listener
        container.removeEventListener('scroll', this.handleScrollTracking);

        // Add new listener
        this.handleScrollTracking = () => {
            if (this.viewMode !== 'scroll') return;

            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.top + containerRect.height / 2;

            // Find which page is currently in the center of viewport
            for (let i = 0; i < this.allPageCanvases.length; i++) {
                const canvas = this.allPageCanvases[i];
                const rect = canvas.getBoundingClientRect();

                if (rect.top <= containerCenter && rect.bottom >= containerCenter) {
                    const pageNum = i + 1;
                    if (this.currentPage !== pageNum) {
                        this.currentPage = pageNum;
                        document.getElementById('currentPage').textContent = pageNum;
                    }
                    break;
                }
            }
        };

        container.addEventListener('scroll', this.handleScrollTracking);
    }
}
