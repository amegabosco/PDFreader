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

        // View mode state - always start in scroll mode
        this.viewMode = 'scroll'; // 'scroll' only (single page removed)
        this.allPageCanvases = [];

        // Navigator panel state
        this.navPanelOpen = false;
        this.thumbnails = [];

        // Rendering state for performance
        this.isRendering = false;
        this.pendingRender = null;

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
        // Navigation buttons
        document.getElementById('prevPage').addEventListener('click', () => {
            this.goToPreviousPage();
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            this.goToNextPage();
        });

        // Page input field
        const pageInput = document.getElementById('pageInput');
        pageInput.addEventListener('change', (e) => {
            const pageNum = parseInt(e.target.value);
            if (pageNum >= 1 && pageNum <= this.totalPages) {
                this.goToPage(pageNum);
            } else {
                // Reset to current page if invalid
                pageInput.value = this.currentPage;
            }
        });

        pageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                pageInput.blur(); // Trigger change event
            }
        });

        // Zoom controls with debouncing
        let zoomDebounceTimer = null;
        const debouncedZoom = async () => {
            clearTimeout(zoomDebounceTimer);
            zoomDebounceTimer = setTimeout(async () => {
                await this.renderScrollView();
                if (window.pendingObjects) {
                    window.pendingObjects.syncOverlayWithCanvas();
                }
            }, 150); // Wait 150ms after last zoom action
        };

        document.getElementById('zoomIn').addEventListener('click', async () => {
            this.scale += 0.25;
            this.updateZoomLevel();
            await debouncedZoom();
        });

        document.getElementById('zoomOut').addEventListener('click', async () => {
            if (this.scale > 0.5) {
                this.scale -= 0.25;
                this.updateZoomLevel();
                await debouncedZoom();
            }
        });

        document.getElementById('zoomFit').addEventListener('click', () => {
            this.zoomToFit();
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
     * Initialize mouse wheel navigation for single page view
     */
    initializeWheelNavigation() {
        if (!this.canvasContainer) {
            this.canvasContainer = document.querySelector('.pdf-canvas-container');
        }

        this.canvasContainer.addEventListener('wheel', (e) => {
            // Only handle wheel navigation in single page view
            if (this.viewMode !== 'single') return;

            const container = this.canvasContainer;
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const scrollLeft = container.scrollLeft;
            const scrollWidth = container.scrollWidth;
            const clientWidth = container.clientWidth;

            // Check if scrolling vertically
            const scrollingDown = e.deltaY > 0;
            const scrollingUp = e.deltaY < 0;

            // Check if at bottom of scroll
            const atBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px threshold
            // Check if at top of scroll
            const atTop = scrollTop <= 5; // 5px threshold

            // Check if not scrolling horizontally or horizontal scroll is at edge
            const canScrollHorizontally = scrollWidth > clientWidth;
            const horizontalScrolling = Math.abs(e.deltaX) > Math.abs(e.deltaY);

            // If scrolling horizontally and there's horizontal scroll space, let it scroll
            if (horizontalScrolling && canScrollHorizontally) {
                return; // Let default scroll behavior handle it
            }

            // Navigate to next page if scrolling down at bottom
            if (scrollingDown && atBottom && this.currentPage < this.totalPages) {
                e.preventDefault();
                this.currentPage++;
                this.renderPage(this.currentPage);
                // Scroll to top of new page
                container.scrollTop = 0;
            }
            // Navigate to previous page if scrolling up at top
            else if (scrollingUp && atTop && this.currentPage > 1) {
                e.preventDefault();
                this.currentPage--;
                this.renderPage(this.currentPage);
                // Scroll to bottom of new page
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight - container.clientHeight;
                }, 50); // Small delay to ensure page is rendered
            }
        }, { passive: false }); // passive: false allows preventDefault
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
            const pageInput = document.getElementById('pageInput');
            if (pageInput) {
                pageInput.value = this.currentPage;
                pageInput.max = this.totalPages;
            }

            // Render in scroll view mode (default)
            await this.renderScrollView();

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

            // Create temporary canvas for rendering to avoid flickering
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = viewport.width;
            tempCanvas.height = viewport.height;
            const tempCtx = tempCanvas.getContext('2d');

            // Render to temporary canvas
            const renderContext = {
                canvasContext: tempCtx,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Update main canvas dimensions
            this.canvas.height = viewport.height;
            this.canvas.width = viewport.width;

            // Copy from temp canvas to main canvas (atomic operation, no flicker)
            this.ctx.drawImage(tempCanvas, 0, 0);

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
     * Zoom to fit the entire page in the viewport
     */
    async zoomToFit() {
        if (!this.pdfDoc) return;

        try {
            // Get current page
            const page = await this.pdfDoc.getPage(this.currentPage);

            // Get container dimensions (available space)
            const container = document.querySelector('.pdf-canvas-container');
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            // Get page dimensions at scale 1.0
            const viewport = page.getViewport({ scale: 1.0 });
            const pageWidth = viewport.width;
            const pageHeight = viewport.height;

            // Calculate scale to fit width and height
            const scaleX = (containerWidth - 40) / pageWidth; // 40px padding
            const scaleY = (containerHeight - 40) / pageHeight; // 40px padding

            // Use the smaller scale to ensure entire page fits
            this.scale = Math.min(scaleX, scaleY);

            // Ensure minimum scale
            if (this.scale < 0.5) this.scale = 0.5;

            // Render the page
            if (this.viewMode === 'single') {
                await this.renderPage(this.currentPage);
            } else {
                await this.renderScrollView();
            }

            this.updateZoomLevel();

            // Sync overlay after zoom change
            if (window.pendingObjects) {
                window.pendingObjects.syncOverlayWithCanvas();
            }
        } catch (error) {
            console.error('Error in zoomToFit:', error);
        }
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

        // Prevent concurrent renders
        if (this.isRendering) {
            console.log('Render already in progress, skipping...');
            return;
        }

        this.isRendering = true;

        // Show loading overlay
        const loadingOverlay = document.getElementById('pdfLoadingOverlay');
        const progressFill = document.getElementById('pdfLoadingProgressFill');
        const progressText = document.getElementById('pdfLoadingPercentage');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }

        const container = document.querySelector('.pdf-canvas-container');

        // Preserve the insertion overlay and loading overlay
        const insertionOverlay = document.getElementById('insertionOverlay');
        const loadingOverlayEl = document.getElementById('pdfLoadingOverlay');

        // Clear existing content but keep overlays
        container.innerHTML = '';
        this.allPageCanvases = [];

        // Re-add overlays
        if (insertionOverlay) {
            container.appendChild(insertionOverlay);
        }
        if (loadingOverlayEl) {
            container.appendChild(loadingOverlayEl);
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

        // Render each page with progress updates
        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            // Update progress
            const progress = Math.round((pageNum / this.totalPages) * 100);
            if (progressFill) {
                progressFill.style.width = progress + '%';
            }
            if (progressText) {
                progressText.textContent = progress + '%';
            }

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

        // IMPORTANT: Scroll to top BEFORE setting up tracking to prevent wrong page detection
        container.scrollTop = 0;

        // Force page 1 as current page
        this.currentPage = 1;
        const pageInput = document.getElementById('pageInput');
        if (pageInput) {
            pageInput.value = 1;
        }

        // Now setup scroll listener to update current page indicator
        this.setupScrollPageTracking();

        // Hide loading overlay
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                // Reset progress for next time
                if (progressFill) progressFill.style.width = '0%';
                if (progressText) progressText.textContent = '0%';
            }, 300);
        }

        // Mark rendering as complete
        this.isRendering = false;

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

                        // Update page input field
                        const pageInput = document.getElementById('pageInput');
                        if (pageInput) {
                            pageInput.value = pageNum;
                        }

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
        const container = document.querySelector('.app-container');
        const toggleBtn = document.getElementById('toggleNavPanel');

        console.log('Navigator elements:', { navPanel, container, toggleBtn });

        navPanel.style.display = 'flex';
        this.navPanelOpen = true;
        if (container) {
            container.classList.add('nav-open');
        }
        if (toggleBtn) {
            toggleBtn.classList.add('active');
        }

        console.log('Navigator panel opened, generating thumbnails...');
        // Generate thumbnails if not already generated
        await this.generateThumbnails();
    }

    /**
     * Close navigator panel
     */
    closeNavigator() {
        const navPanel = document.getElementById('navPanel');
        const container = document.querySelector('.app-container');
        const toggleBtn = document.getElementById('toggleNavPanel');

        navPanel.style.display = 'none';
        this.navPanelOpen = false;
        if (container) {
            container.classList.remove('nav-open');
        }
        if (toggleBtn) {
            toggleBtn.classList.remove('active');
        }
    }

    /**
     * Generate thumbnails for all pages
     */
    async generateThumbnails(force = false) {
        console.log('generateThumbnails called, force:', force);

        if (!this.pdfDoc) {
            console.error('Cannot generate thumbnails: no PDF document loaded');
            return;
        }

        const navThumbnails = document.getElementById('navThumbnails');
        if (!navThumbnails) {
            console.error('Cannot generate thumbnails: navThumbnails element not found');
            return;
        }

        // Only generate if empty (unless force is true)
        if (this.thumbnails.length > 0 && !force) {
            console.log('Thumbnails already generated, skipping');
            return;
        }

        console.log(`Starting to generate ${this.totalPages} thumbnails...`);
        navThumbnails.innerHTML = ''; // Clear existing thumbnails
        this.thumbnails = [];

        const thumbnailScale = 0.3; // Reduced scale for better performance

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

            // Drag and drop handlers
            this.setupThumbnailDrag(thumbDiv, pageNum);

            navThumbnails.appendChild(thumbDiv);
            this.thumbnails.push(thumbDiv);
        }

        console.log(`Generated ${this.thumbnails.length} thumbnails successfully`);
    }

    /**
     * Setup drag and drop for thumbnail
     */
    setupThumbnailDrag(thumbDiv, pageNum) {
        // Make thumbnail draggable
        thumbDiv.draggable = true;

        thumbDiv.addEventListener('dragstart', (e) => {
            thumbDiv.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', pageNum.toString());
        });

        thumbDiv.addEventListener('dragend', (e) => {
            thumbDiv.classList.remove('dragging');

            // Remove all drag-over classes
            this.thumbnails.forEach(thumb => {
                thumb.classList.remove('drag-over');
            });
        });

        thumbDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Don't allow dropping on itself
            const draggingThumb = document.querySelector('.dragging');
            if (draggingThumb === thumbDiv) return;

            thumbDiv.classList.add('drag-over');
        });

        thumbDiv.addEventListener('dragleave', (e) => {
            thumbDiv.classList.remove('drag-over');
        });

        thumbDiv.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            thumbDiv.classList.remove('drag-over');

            const fromPage = parseInt(e.dataTransfer.getData('text/plain'));
            const toPage = pageNum;

            if (fromPage !== toPage) {
                console.log(`Moving page ${fromPage} to position ${toPage}`);
                await this.reorderPages(fromPage, toPage);
            }
        });
    }

    /**
     * Reorder pages in the PDF
     * @param {number} fromPage - Source page number (1-indexed)
     * @param {number} toPage - Target page number (1-indexed)
     */
    async reorderPages(fromPage, toPage) {
        try {
            // This method will be called from app.js which has access to tools
            if (typeof window.handlePageReorder === 'function') {
                await window.handlePageReorder(fromPage, toPage);
            } else {
                console.error('handlePageReorder function not found');
            }
        } catch (error) {
            console.error('Error reordering pages:', error);
            throw error;
        }
    }

    /**
     * Go to specific page
     */
    async goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) return;

        this.currentPage = pageNum;

        // Update page input field
        const pageInput = document.getElementById('pageInput');
        if (pageInput) {
            pageInput.value = pageNum;
        }

        // In scroll mode, scroll to the page
        if (this.allPageCanvases[pageNum - 1]) {
            const targetCanvas = this.allPageCanvases[pageNum - 1];
            const targetWrapper = targetCanvas.parentElement;
            targetWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Update active thumbnail
        this.updateActiveThumbnail(pageNum);
    }

    /**
     * Go to previous page
     */
    goToPreviousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    /**
     * Go to next page
     */
    goToNextPage() {
        if (this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }
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

    /**
     * Search for text in the PDF
     * @param {string} query - Search query
     * @param {object} options - Search options (caseSensitive, wholeWord)
     * @returns {Promise<Array>} Array of matches with page and position
     */
    async searchText(query, options = {}) {
        if (!this.pdfDoc || !query) return [];

        const { caseSensitive = false, wholeWord = false } = options;
        const matches = [];

        // Search through all pages
        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            const page = await this.pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: this.scale });

            // Build text string and track positions
            let textItems = textContent.items;

            for (let i = 0; i < textItems.length; i++) {
                const item = textItems[i];
                let text = item.str;

                if (!text) continue;

                // Apply case sensitivity
                let searchText = caseSensitive ? text : text.toLowerCase();
                let searchQuery = caseSensitive ? query : query.toLowerCase();

                // Find all occurrences in this text item
                let index = 0;
                while ((index = searchText.indexOf(searchQuery, index)) !== -1) {
                    // Check whole word if needed
                    if (wholeWord) {
                        const before = index > 0 ? searchText[index - 1] : ' ';
                        const after = index + searchQuery.length < searchText.length ?
                            searchText[index + searchQuery.length] : ' ';

                        if (/\w/.test(before) || /\w/.test(after)) {
                            index++;
                            continue;
                        }
                    }

                    // Calculate position and dimensions more accurately
                    const transform = item.transform;
                    const fontSize = Math.sqrt(transform[2] * transform[2] + transform[3] * transform[3]);

                    // Calculate character width (approximate)
                    const charWidth = item.width / text.length;

                    // Calculate offset for the matched substring
                    const offsetX = charWidth * index;
                    const matchWidth = charWidth * searchQuery.length;

                    const x = transform[4] + offsetX;
                    const y = transform[5];

                    matches.push({
                        pageNum,
                        text: text.substring(index, index + searchQuery.length),
                        bounds: {
                            x: x,
                            y: viewport.height - y - fontSize,
                            width: matchWidth,
                            height: fontSize * 1.2  // Add some padding
                        }
                    });

                    index++;
                }
            }
        }

        return matches;
    }

    /**
     * Highlight search results on the current page
     * @param {Array} matches - Array of search matches
     * @param {number} currentMatchIndex - Index of current match
     */
    highlightSearchResults(matches, currentMatchIndex = 0) {
        // Remove existing highlights
        const existingLayers = document.querySelectorAll('.search-highlight-layer');
        existingLayers.forEach(layer => layer.remove());

        if (matches.length === 0) return;

        // In scroll view mode, highlight on all visible canvases
        if (this.viewMode === 'scroll' && this.allPageCanvases.length > 0) {
            this.allPageCanvases.forEach((canvas, pageIndex) => {
                const pageNum = pageIndex + 1;
                const pageMatches = matches.filter(m => m.pageNum === pageNum);

                if (pageMatches.length === 0) return;

                // Create highlight layer for this page
                const highlightLayer = document.createElement('div');
                highlightLayer.className = 'search-highlight-layer';

                const canvasWrapper = canvas.parentElement;
                const canvasRect = canvas.getBoundingClientRect();
                const wrapperRect = canvasWrapper.getBoundingClientRect();

                highlightLayer.style.position = 'absolute';
                highlightLayer.style.left = '0';
                highlightLayer.style.top = '0';
                highlightLayer.style.width = canvas.offsetWidth + 'px';
                highlightLayer.style.height = canvas.offsetHeight + 'px';
                highlightLayer.style.pointerEvents = 'none';

                // Calculate scale factors
                const scaleX = canvas.offsetWidth / canvas.width;
                const scaleY = canvas.offsetHeight / canvas.height;

                // Add highlights for this page
                pageMatches.forEach((match) => {
                    const highlight = document.createElement('div');
                    highlight.className = 'search-highlight';

                    const globalIndex = matches.findIndex(m =>
                        m.pageNum === match.pageNum &&
                        m.bounds.x === match.bounds.x &&
                        m.bounds.y === match.bounds.y
                    );

                    if (globalIndex === currentMatchIndex) {
                        highlight.classList.add('current');
                    }

                    highlight.style.left = (match.bounds.x * scaleX) + 'px';
                    highlight.style.top = (match.bounds.y * scaleY) + 'px';
                    highlight.style.width = (match.bounds.width * scaleX) + 'px';
                    highlight.style.height = (match.bounds.height * scaleY) + 'px';

                    highlightLayer.appendChild(highlight);
                });

                canvasWrapper.appendChild(highlightLayer);
            });
        } else {
            // Single page mode (legacy support, though we removed it)
            const currentPageMatches = matches.filter(m => m.pageNum === this.currentPage);
            if (currentPageMatches.length === 0) return;

            const highlightLayer = document.createElement('div');
            highlightLayer.className = 'search-highlight-layer';

            const canvasRect = this.canvas.getBoundingClientRect();
            const containerRect = this.canvas.parentElement.getBoundingClientRect();

            highlightLayer.style.left = (canvasRect.left - containerRect.left) + 'px';
            highlightLayer.style.top = (canvasRect.top - containerRect.top) + 'px';
            highlightLayer.style.width = this.canvas.offsetWidth + 'px';
            highlightLayer.style.height = this.canvas.offsetHeight + 'px';

            const scaleX = this.canvas.offsetWidth / this.canvas.width;
            const scaleY = this.canvas.offsetHeight / this.canvas.height;

            currentPageMatches.forEach((match) => {
                const highlight = document.createElement('div');
                highlight.className = 'search-highlight';

                const globalIndex = matches.findIndex(m =>
                    m.pageNum === match.pageNum &&
                    m.bounds.x === match.bounds.x &&
                    m.bounds.y === match.bounds.y
                );

                if (globalIndex === currentMatchIndex) {
                    highlight.classList.add('current');
                }

                highlight.style.left = (match.bounds.x * scaleX) + 'px';
                highlight.style.top = (match.bounds.y * scaleY) + 'px';
                highlight.style.width = (match.bounds.width * scaleX) + 'px';
                highlight.style.height = (match.bounds.height * scaleY) + 'px';

                highlightLayer.appendChild(highlight);
            });

            this.canvas.parentElement.appendChild(highlightLayer);
        }
    }

    /**
     * Clear search highlights
     */
    clearSearchHighlights() {
        const existingLayers = document.querySelectorAll('.search-highlight-layer');
        existingLayers.forEach(layer => layer.remove());
    }
}
