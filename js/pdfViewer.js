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

        // Navigator panel state
        this.navPanelOpen = false;
        this.thumbnails = [];

        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

        this.initializeControls();
        this.initializeNavigator();
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

        // Additional navigation buttons
        document.getElementById('prevPageBtn').addEventListener('click', () => {
            if (this.viewMode === 'single') {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderPage(this.currentPage);
                }
            } else {
                // In scroll mode, scroll up one page height
                this.scrollToPreviousPage();
            }
        });

        document.getElementById('nextPageBtn').addEventListener('click', () => {
            if (this.viewMode === 'single') {
                if (this.currentPage < this.totalPages) {
                    this.currentPage++;
                    this.renderPage(this.currentPage);
                }
            } else {
                // In scroll mode, scroll down one page height
                this.scrollToNextPage();
            }
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

            // Clear thumbnails array so they regenerate for new document
            this.thumbnails = [];

            // Clear thumbnails container
            const navThumbnails = document.getElementById('navThumbnails');
            if (navThumbnails) {
                navThumbnails.innerHTML = '';
            }

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
            showNotification('Failed to load PDF. Please try another file.', 'error');
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
                // Preserve the insertion overlay
                const insertionOverlay = document.getElementById('insertionOverlay');

                container.innerHTML = '';
                container.appendChild(this.canvas);

                // Re-add the overlay
                if (insertionOverlay) {
                    container.appendChild(insertionOverlay);
                }
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

            // Update active thumbnail if navigator is open
            if (this.navPanelOpen) {
                this.updateActiveThumbnail(pageNum);
            }

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

            // Scroll to top of document when entering scroll mode
            // Use requestAnimationFrame to ensure DOM is fully updated
            const container = document.querySelector('.pdf-canvas-container');
            requestAnimationFrame(() => {
                container.scrollTop = 0;
            });
        }

        console.log(`View mode changed to: ${mode}`);
    }

    /**
     * Render all pages in continuous scroll view
     */
    async renderScrollView() {
        if (!this.pdfDoc) return;

        const container = document.querySelector('.pdf-canvas-container');

        // Preserve the insertion overlay
        const insertionOverlay = document.getElementById('insertionOverlay');

        // Clear existing content but keep overlay
        container.innerHTML = '';
        this.allPageCanvases = [];

        // Re-add the overlay
        if (insertionOverlay) {
            container.appendChild(insertionOverlay);
        }

        // Create a wrapper for all pages
        const pagesWrapper = document.createElement('div');
        pagesWrapper.id = 'scrollViewWrapper';
        pagesWrapper.style.display = 'flex';
        pagesWrapper.style.flexDirection = 'column';
        pagesWrapper.style.alignItems = 'center';
        pagesWrapper.style.gap = '1rem';
        pagesWrapper.style.padding = '2rem 0';
        pagesWrapper.style.width = '100%';
        pagesWrapper.style.minHeight = '100%';

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

                        // Update active thumbnail if navigator is open
                        if (this.navPanelOpen) {
                            this.updateActiveThumbnail(pageNum);
                        }
                    }
                    break;
                }
            }
        };

        container.addEventListener('scroll', this.handleScrollTracking);
    }

    /**
     * Scroll to previous page in scroll view
     */
    scrollToPreviousPage() {
        if (this.viewMode !== 'scroll' || this.allPageCanvases.length === 0) return;

        const container = document.querySelector('.pdf-canvas-container');
        const currentPageIndex = this.currentPage - 1;

        if (currentPageIndex > 0) {
            const targetCanvas = this.allPageCanvases[currentPageIndex - 1];
            const targetWrapper = targetCanvas.parentElement;

            targetWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // Already at first page, scroll to top
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * Scroll to next page in scroll view
     */
    scrollToNextPage() {
        if (this.viewMode !== 'scroll' || this.allPageCanvases.length === 0) return;

        const container = document.querySelector('.pdf-canvas-container');
        const currentPageIndex = this.currentPage - 1;

        if (currentPageIndex < this.allPageCanvases.length - 1) {
            const targetCanvas = this.allPageCanvases[currentPageIndex + 1];
            const targetWrapper = targetCanvas.parentElement;

            targetWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            // Already at last page, scroll to bottom
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
    }

    /**
     * Initialize document navigator panel
     */
    initializeNavigator() {
        const toggleBtn = document.getElementById('toggleNavPanel');
        const closeBtn = document.getElementById('closeNavPanel');
        const navPanel = document.getElementById('navPanel');

        toggleBtn.addEventListener('click', () => this.toggleNavigator());
        closeBtn.addEventListener('click', () => this.closeNavigator());
    }

    /**
     * Toggle navigator panel
     */
    toggleNavigator() {
        if (this.navPanelOpen) {
            this.closeNavigator();
        } else {
            this.openNavigator();
        }
    }

    /**
     * Open navigator panel
     */
    async openNavigator() {
        console.log('Opening navigator...');
        if (!this.pdfDoc) {
            console.error('No PDF document loaded');
            return;
        }

        const navPanel = document.getElementById('navPanel');
        const container = document.querySelector('.container');
        const toggleBtn = document.getElementById('toggleNavPanel');

        console.log('Navigator elements:', { navPanel, container, toggleBtn });

        navPanel.style.display = 'flex';
        this.navPanelOpen = true;
        container.classList.add('nav-open');
        toggleBtn.classList.add('active');

        console.log('Navigator panel opened, generating thumbnails...');
        // Generate thumbnails if not already generated
        await this.generateThumbnails();
    }

    /**
     * Close navigator panel
     */
    closeNavigator() {
        const navPanel = document.getElementById('navPanel');
        const container = document.querySelector('.container');
        const toggleBtn = document.getElementById('toggleNavPanel');

        navPanel.style.display = 'none';
        this.navPanelOpen = false;
        container.classList.remove('nav-open');
        toggleBtn.classList.remove('active');
    }

    /**
     * Generate thumbnails for all pages
     */
    async generateThumbnails() {
        if (!this.pdfDoc) return;

        const navThumbnails = document.getElementById('navThumbnails');

        // Only generate if empty
        if (this.thumbnails.length > 0) {
            console.log('Thumbnails already generated');
            return;
        }

        navThumbnails.innerHTML = ''; // Clear existing thumbnails
        this.thumbnails = [];

        const thumbnailScale = 0.5; // Increased scale for better quality

        console.log(`Generating ${this.totalPages} thumbnails...`);

        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            console.log(`Rendering thumbnail for page ${pageNum}`);
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: thumbnailScale });
            console.log(`Page ${pageNum} viewport:`, viewport.width, 'x', viewport.height);

            // Create thumbnail container
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'nav-thumbnail';
            thumbDiv.dataset.pageNum = pageNum;
            if (pageNum === this.currentPage) {
                thumbDiv.classList.add('active');
            }

            // Create thumbnail wrapper (for positioning)
            const thumbWrapper = document.createElement('div');
            thumbWrapper.className = 'nav-thumbnail-wrapper';

            // Create canvas for thumbnail
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            console.log(`Canvas created: ${canvas.width}x${canvas.height}`);

            const ctx = canvas.getContext('2d');
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            console.log(`Starting render for page ${pageNum}...`);
            await page.render(renderContext).promise;
            console.log(`Page ${pageNum} rendered successfully`);

            // Create page number overlay badge
            const badge = document.createElement('div');
            badge.className = 'nav-thumbnail-badge';
            badge.textContent = pageNum;

            thumbWrapper.appendChild(canvas);
            thumbWrapper.appendChild(badge);

            // Create label
            const label = document.createElement('div');
            label.className = 'nav-thumbnail-label';
            label.textContent = `Page ${pageNum}`;

            thumbDiv.appendChild(thumbWrapper);
            thumbDiv.appendChild(label);

            // Click handler to navigate to page
            thumbDiv.addEventListener('click', () => {
                this.goToPage(pageNum);
            });

            navThumbnails.appendChild(thumbDiv);
            this.thumbnails.push(thumbDiv);
        }

        console.log(`Generated ${this.thumbnails.length} thumbnails successfully`);
    }

    /**
     * Go to specific page
     */
    async goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) return;

        this.currentPage = pageNum;

        if (this.viewMode === 'single') {
            await this.renderPage(pageNum);
        } else {
            // In scroll mode, scroll to the page
            if (this.allPageCanvases[pageNum - 1]) {
                const targetCanvas = this.allPageCanvases[pageNum - 1];
                const targetWrapper = targetCanvas.parentElement;
                targetWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        // Update active thumbnail
        this.updateActiveThumbnail(pageNum);
    }

    /**
     * Update active thumbnail
     */
    updateActiveThumbnail(pageNum) {
        this.thumbnails.forEach((thumb, index) => {
            if (index + 1 === pageNum) {
                thumb.classList.add('active');
            } else {
                thumb.classList.remove('active');
            }
        });
    }
}
