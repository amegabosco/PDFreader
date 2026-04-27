/**
 * PDF Viewer Module
 * Handles PDF rendering using PDF.js
 */

/**
 * Canvas Pool - reuses canvas elements to avoid costly DOM creation/destruction
 * during zoom and re-render operations.
 */
class CanvasPool {
    constructor(maxSize = 10) {
        this.pool = [];
        this.maxSize = maxSize;
    }
    acquire() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return document.createElement('canvas');
    }
    release(canvas) {
        if (this.pool.length < this.maxSize) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = 0;
            canvas.height = 0;
            this.pool.push(canvas);
        }
    }
    clear() {
        this.pool = [];
    }
}

class PDFViewer {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.5;
        this.selectedPages = new Set(); // Track selected pages for multi-select
        this.lastClickedPage = null; // Track last clicked page for shift-select
        this.syncInProgress = false; // Flag to prevent sync loops
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

        // Canvas pool for reusing canvas elements (avoids DOM churn on zoom)
        this.canvasPool = new CanvasPool(10);

        // Navigator panel state
        this.navPanelOpen = false;
        this.thumbnails = [];
        this.thumbnailsStale = false;

        // Rendering state for performance
        this.isRendering = false;
        this.pendingRender = null;
        this.initialLoad = true; // Flag to prevent page tracking during initial load

        // Active render tasks map for cancellation on rapid scroll
        this.activeRenderTasks = new Map();

        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

        this.initializeControls();
        this.initializeNavigator();
        this.setupResizeHandler();
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
     * Setup resize handler for responsive layout
     */
    setupResizeHandler() {
        let resizeTimer = null;

        window.addEventListener('resize', () => {
            // Clear previous timer
            if (resizeTimer) clearTimeout(resizeTimer);

            // Set new timer
            resizeTimer = setTimeout(async () => {

                // Only re-render if we have a document
                if (!this.pdfDoc) return;

                // If we were in a "fit" mode, we might want to recalculate scale here
                // For now, we just re-render to ensure layout is correct

                if (this.viewMode === 'scroll') {
                    await this.renderScrollView();
                } else {
                    await this.renderPage(this.currentPage);
                }

                // Sync overlay
                if (window.pendingObjects) {
                    window.pendingObjects.syncOverlayWithCanvas();
                }
            }, 200); // Debounce 200ms
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
            // Set initial load flag to prevent scroll tracking during render
            this.initialLoad = true;

            // Load the PDF document
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;

            // Mark thumbnails as stale so they regenerate when needed
            // Don't clear the DOM here — let generateThumbnails(true) handle it
            // to avoid blank thumbnails between loadPDF and regeneration
            this.thumbnailsStale = true;

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

        // Clear canvas pool
        if (this.canvasPool) this.canvasPool.clear();

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

    }

    /**
     * Render all pages in continuous scroll view
     */
    /**
     * Render all pages in continuous scroll view (Lazy Loaded)
     */
    async renderScrollView() {
        if (!this.pdfDoc) return;

        // Prevent concurrent renders
        if (this.isRendering) return;

        this.isRendering = true;

        // Force scroll to 0 before anything else
        const container = document.querySelector('.pdf-canvas-container');
        container.scrollTop = 0;

        // Show loading overlay
        const loadingOverlay = document.getElementById('pdfLoadingOverlay');
        const progressFill = document.getElementById('pdfLoadingProgressFill');
        const progressText = document.getElementById('pdfLoadingPercentage');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }

        // Preserve the insertion overlay and loading overlay
        const insertionOverlay = document.getElementById('insertionOverlay');
        const loadingOverlayEl = document.getElementById('pdfLoadingOverlay');

        // Release existing canvases to the pool before clearing
        const oldCanvases = container.querySelectorAll('canvas');
        oldCanvases.forEach(c => this.canvasPool.release(c));

        // Clear existing content but keep overlays
        container.innerHTML = '';
        this.allPageCanvases = [];

        // Force scroll again after clearing
        container.scrollTop = 0;

        // Create a wrapper for all pages FIRST (before overlays)
        const pagesWrapper = document.createElement('div');
        pagesWrapper.id = 'scrollViewWrapper';
        pagesWrapper.style.display = 'flex';
        pagesWrapper.style.flexDirection = 'column';
        pagesWrapper.style.alignItems = 'flex-start';
        pagesWrapper.style.gap = '1rem';
        pagesWrapper.style.padding = '0';
        pagesWrapper.style.paddingTop = '0.5rem';
        pagesWrapper.style.paddingBottom = '1rem';
        pagesWrapper.style.width = 'fit-content';
        pagesWrapper.style.minWidth = '100%';
        pagesWrapper.style.minHeight = '100%';

        // Disconnect existing observers if any
        if (this.pageObserver) {
            this.pageObserver.disconnect();
        }
        if (this.pageTracker) {
            this.pageTracker.disconnect();
        }

        // Create IntersectionObserver for lazy loading pages
        // Handles both DIV placeholders (virtual scroll) and canvas elements
        this.pageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                let pageEl = entry.target;
                const pageNum = parseInt(pageEl.dataset.pageNum);

                if (entry.isIntersecting) {
                    // Only render if marked as needing render
                    if (pageEl.dataset.needsRender === 'true') {
                        // If this is a DIV placeholder, swap it for a real canvas first
                        if (pageEl.dataset.isPlaceholder === 'true') {
                            const pageCanvas = this.canvasPool.acquire();
                            pageCanvas.id = pageEl.id;
                            pageCanvas.dataset.pageNum = pageNum;
                            pageCanvas.dataset.needsRender = 'true';
                            // Copy dimensions from placeholder
                            pageCanvas.style.width = pageEl.style.width;
                            pageCanvas.style.height = pageEl.style.height;
                            pageCanvas.width = parseInt(pageEl.style.width);
                            pageCanvas.height = parseInt(pageEl.style.height);

                            const wrapper = pageEl.parentElement;
                            // Stop observing old placeholder
                            observer.unobserve(pageEl);
                            wrapper.replaceChild(pageCanvas, pageEl);

                            // Update allPageCanvases reference
                            const idx = this.allPageCanvases.indexOf(pageEl);
                            if (idx !== -1) {
                                this.allPageCanvases[idx] = pageCanvas;
                            }

                            // Observe the new canvas and update pageTracker if it exists
                            observer.observe(pageCanvas);
                            if (this.pageTracker) {
                                this.pageTracker.observe(pageCanvas);
                            }

                            pageEl = pageCanvas;
                        }
                        this.renderPageCanvas(pageEl, pageNum);
                    }
                } else {
                    // Page left the viewport — only process canvas elements (skip DIV placeholders)
                    if (pageEl.dataset.isPlaceholder === 'true') return;

                    // Cancel active render if any
                    if (this.activeRenderTasks.has(pageNum)) {
                        const task = this.activeRenderTasks.get(pageNum);
                        task.cancel();
                        this.activeRenderTasks.delete(pageNum);
                    }

                    // If page was already rendered, clean up resources and show placeholder
                    if (pageEl.dataset.needsRender === 'false') {
                        // Release PDF.js internal resources for this page
                        this.pdfDoc.getPage(pageNum).then(function(page) { page.cleanup(); }).catch(function() {});

                        // Mark as needing re-render when it comes back
                        pageEl.dataset.needsRender = 'true';

                        // Draw a lightweight placeholder (keep canvas dimensions)
                        const ctx = pageEl.getContext('2d');
                        ctx.clearRect(0, 0, pageEl.width, pageEl.height);
                        ctx.fillStyle = '#f8fafc';
                        ctx.fillRect(0, 0, pageEl.width, pageEl.height);
                        ctx.fillStyle = '#94a3b8';
                        ctx.font = '14px -apple-system, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText('Page ' + pageNum, pageEl.width / 2, pageEl.height / 2);
                    }
                }
            });
        }, {
            root: container,
            rootMargin: '600px', // Load ahead by 600px (approx 1 page height)
            threshold: 0.01
        });

        const INITIAL_PAGES = 3; // Render first 3 pages immediately

        // Get page 1 dimensions as reference for placeholder sizing
        // This avoids calling getPage() for every page upfront
        const firstPage = await this.pdfDoc.getPage(1);
        const refViewport = firstPage.getViewport({ scale: this.scale });
        const refWidth = refViewport.width;
        const refHeight = refViewport.height;

        // Render first pages immediately (need exact dimensions)
        for (let pageNum = 1; pageNum <= Math.min(INITIAL_PAGES, this.totalPages); pageNum++) {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'scroll-page-wrapper';
            pageWrapper.style.marginLeft = 'auto';
            pageWrapper.style.marginRight = 'auto';
            pageWrapper.style.boxShadow = '0 4px 12px var(--shadow)';
            pageWrapper.style.border = '1px solid var(--border)';
            pageWrapper.style.backgroundColor = 'white';

            const pageCanvas = this.canvasPool.acquire();
            pageCanvas.id = `page-${pageNum}`;
            pageCanvas.dataset.pageNum = pageNum;

            const page = pageNum === 1 ? firstPage : await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            pageCanvas.width = viewport.width;
            pageCanvas.height = viewport.height;
            pageCanvas.style.width = viewport.width + 'px';
            pageCanvas.style.height = viewport.height + 'px';

            const ctx = pageCanvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            pageCanvas.dataset.needsRender = 'false';

            const progress = Math.round((pageNum / Math.min(INITIAL_PAGES, this.totalPages)) * 100);
            if (progressFill) progressFill.style.width = progress + '%';
            if (progressText) progressText.textContent = progress + '%';

            // Observe initial pages too (for cleanup when they leave viewport)
            this.pageObserver.observe(pageCanvas);

            // Click-to-select and context menu on page wrapper
            this.setupPageWrapperInteractions(pageWrapper, pageNum);

            pageWrapper.appendChild(pageCanvas);
            pagesWrapper.appendChild(pageWrapper);
            this.allPageCanvases.push(pageCanvas);
        }

        // Create lightweight DIV placeholders for remaining pages (virtual scroll — no canvas until visible)
        for (let pageNum = INITIAL_PAGES + 1; pageNum <= this.totalPages; pageNum++) {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'scroll-page-wrapper';
            pageWrapper.style.marginLeft = 'auto';
            pageWrapper.style.marginRight = 'auto';
            pageWrapper.style.boxShadow = '0 4px 12px var(--shadow)';
            pageWrapper.style.border = '1px solid var(--border)';
            pageWrapper.style.backgroundColor = 'white';

            // DIV placeholder instead of canvas — much lighter on the DOM
            const placeholder = document.createElement('div');
            placeholder.id = 'page-' + pageNum;
            placeholder.dataset.pageNum = pageNum;
            placeholder.dataset.needsRender = 'true';
            placeholder.dataset.isPlaceholder = 'true';
            placeholder.style.width = refWidth + 'px';
            placeholder.style.height = refHeight + 'px';
            placeholder.style.backgroundColor = '#f8fafc';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.style.color = '#94a3b8';
            placeholder.style.fontFamily = '-apple-system, sans-serif';
            placeholder.style.fontSize = '14px';
            placeholder.style.userSelect = 'none';
            placeholder.textContent = 'Page ' + pageNum;

            this.pageObserver.observe(placeholder);

            // Click-to-select and context menu on page wrapper
            this.setupPageWrapperInteractions(pageWrapper, pageNum);

            pageWrapper.appendChild(placeholder);
            pagesWrapper.appendChild(pageWrapper);
            // Store placeholder in allPageCanvases (swapped for canvas when visible)
            this.allPageCanvases.push(placeholder);
        }

        container.appendChild(pagesWrapper);

        // Add overlays back
        if (insertionOverlay) container.appendChild(insertionOverlay);
        if (loadingOverlayEl) container.appendChild(loadingOverlayEl);

        // Hide loading overlay after initial pages are done
        setTimeout(() => {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }, 500);

        // Reset scroll logic (same as before)
        container.scrollTop = 0;
        this.currentPage = 1;
        const pageInput = document.getElementById('pageInput');
        if (pageInput) pageInput.value = 1;

        this.initialLoad = true;

        // Reset scroll blocker logic
        const scrollBlocker = (e) => { container.scrollTop = 0; };
        container.addEventListener('scroll', scrollBlocker);

        setTimeout(() => {
            container.removeEventListener('scroll', scrollBlocker);
            this.initialLoad = false;
            this.setupScrollPageTracking();
        }, 1000);

        this.isRendering = false;
    }

    /**
     * Setup click-to-select and context menu on a page wrapper in the main viewer
     */
    setupPageWrapperInteractions(wrapper, pageNum) {
        wrapper.dataset.pageNum = pageNum;
        wrapper.style.cursor = 'default';
        wrapper.style.position = 'relative';

        // Click to select page
        wrapper.addEventListener('click', (e) => {
            // Don't interfere with hand tool panning or pending object interactions
            if (this.handToolActive || e.target.closest('.pending-object')) return;

            if (e.ctrlKey || e.metaKey) {
                this.togglePageSelection(pageNum);
            } else if (e.shiftKey && this.lastClickedPage) {
                const from = Math.min(this.lastClickedPage, pageNum);
                const to = Math.max(this.lastClickedPage, pageNum);
                for (let p = from; p <= to; p++) this.selectedPages.add(p);
                this.updateThumbnailSelection();
                this.updateMainPageSelection();
            } else {
                this.clearPageSelection();
                this.selectedPages.add(pageNum);
                this.updateThumbnailSelection();
                this.updateMainPageSelection();
            }
            this.lastClickedPage = pageNum;
        });

        // Right-click context menu
        wrapper.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Auto-select page if not already selected
            if (!this.selectedPages.has(pageNum)) {
                this.clearPageSelection();
                this.selectedPages.add(pageNum);
                this.updateThumbnailSelection();
                this.updateMainPageSelection();
            }
            this.showContextMenu(e.clientX, e.clientY, pageNum, 'page');
        });
    }

    /**
     * Update visual selection state on main viewer pages
     */
    updateMainPageSelection() {
        const wrappers = document.querySelectorAll('.scroll-page-wrapper');
        wrappers.forEach(w => {
            const pNum = parseInt(w.dataset.pageNum);
            if (this.selectedPages.has(pNum)) {
                w.classList.add('page-selected');
            } else {
                w.classList.remove('page-selected');
            }
        });
    }

    /**
     * Show context menu at position
     */
    showContextMenu(x, y, pageNum, source) {
        // Remove existing menu
        this.hideContextMenu();

        const selectedCount = this.selectedPages.size;
        const pageLabel = selectedCount > 1
            ? selectedCount + ' pages'
            : 'Page ' + pageNum;

        const menu = document.createElement('div');
        menu.id = 'pdfContextMenu';
        menu.className = 'pdf-context-menu';

        const items = [
            { icon: 'ti-file-info', label: pageLabel, action: null, isHeader: true },
            { icon: null, label: '', action: null, isSeparator: true },
            { icon: 'ti-click', label: 'Go to this page', action: 'goto', single: true },
            { icon: 'ti-select-all', label: 'Select all pages', action: 'select-all' },
            { icon: 'ti-deselect', label: 'Clear selection', action: 'clear-selection' },
            { icon: null, label: '', action: null, isSeparator: true },
            { icon: 'ti-rotate', label: 'Rotate 90° Left', action: 'rotate-left' },
            { icon: 'ti-rotate-clockwise', label: 'Rotate 90° Right', action: 'rotate-right' },
            { icon: 'ti-rotate-2', label: 'Rotate 180°', action: 'rotate-180' },
            { icon: null, label: '', action: null, isSeparator: true },
            { icon: 'ti-cut', label: 'Extract ' + pageLabel, action: 'extract' },
            { icon: 'ti-copy', label: 'Duplicate ' + pageLabel, action: 'duplicate' },
            { icon: null, label: '', action: null, isSeparator: true },
            { icon: 'ti-trash', label: 'Delete ' + pageLabel, action: 'delete', danger: true },
        ];

        items.forEach(item => {
            if (item.isSeparator) {
                const sep = document.createElement('div');
                sep.className = 'ctx-separator';
                menu.appendChild(sep);
                return;
            }
            if (item.single && selectedCount > 1) return;

            const el = document.createElement('div');
            el.className = 'ctx-item' + (item.isHeader ? ' ctx-header' : '') + (item.danger ? ' ctx-danger' : '');

            if (item.icon) {
                const icon = document.createElement('i');
                icon.className = 'ti ' + item.icon;
                icon.setAttribute('aria-hidden', 'true');
                el.appendChild(icon);
            }

            const span = document.createElement('span');
            span.textContent = item.label;
            el.appendChild(span);

            if (item.action) {
                el.addEventListener('click', () => {
                    this.handleContextAction(item.action, pageNum);
                    this.hideContextMenu();
                });
            }

            menu.appendChild(el);
        });

        document.body.appendChild(menu);

        // Position — ensure menu stays in viewport
        const menuRect = menu.getBoundingClientRect();
        const maxX = window.innerWidth - menuRect.width - 8;
        const maxY = window.innerHeight - menuRect.height - 8;
        menu.style.left = Math.min(x, maxX) + 'px';
        menu.style.top = Math.min(y, maxY) + 'px';

        // Close on click outside
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                this.hideContextMenu();
                document.removeEventListener('click', closeHandler, true);
                document.removeEventListener('contextmenu', closeHandler, true);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', closeHandler, true);
            document.addEventListener('contextmenu', closeHandler, true);
        }, 0);
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        const existing = document.getElementById('pdfContextMenu');
        if (existing) existing.remove();
    }

    /**
     * Handle context menu action
     */
    handleContextAction(action, pageNum) {
        const selectedPages = this.getSelectedPages();
        const pages = selectedPages.length > 0 ? selectedPages : [pageNum];

        switch (action) {
            case 'goto':
                this.goToPage(pageNum);
                break;
            case 'select-all':
                for (let p = 1; p <= this.totalPages; p++) this.selectedPages.add(p);
                this.updateThumbnailSelection();
                this.updateMainPageSelection();
                break;
            case 'clear-selection':
                this.clearPageSelection();
                this.updateMainPageSelection();
                break;
            case 'rotate-left':
                if (typeof executeRotateSelected === 'function') executeRotateSelected(270, pages);
                break;
            case 'rotate-right':
                if (typeof executeRotateSelected === 'function') executeRotateSelected(90, pages);
                break;
            case 'rotate-180':
                if (typeof executeRotateSelected === 'function') executeRotateSelected(180, pages);
                break;
            case 'extract':
                if (typeof executeSplitSelected === 'function') executeSplitSelected(pages);
                break;
            case 'duplicate':
                if (typeof executeDuplicatePages === 'function') executeDuplicatePages(pages);
                break;
            case 'delete':
                if (typeof executeDeleteSelected === 'function') executeDeleteSelected(pages);
                break;
        }
    }

    /**
     * Render a specific page canvas (Lazy Load helper)
     */
    async renderPageCanvas(canvas, pageNum) {
        try {
            // Cancel any in-progress render for this page
            if (this.activeRenderTasks.has(pageNum)) {
                const existingTask = this.activeRenderTasks.get(pageNum);
                existingTask.cancel();
                this.activeRenderTasks.delete(pageNum);
            }

            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            // Correct dimensions if they differ from placeholder estimate
            if (canvas.width !== viewport.width || canvas.height !== viewport.height) {
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = viewport.width + 'px';
                canvas.style.height = viewport.height + 'px';
            }

            const ctx = canvas.getContext('2d');
            const renderTask = page.render({ canvasContext: ctx, viewport: viewport });

            // Store the render task so it can be cancelled on rapid scroll
            this.activeRenderTasks.set(pageNum, renderTask);

            await renderTask.promise;

            // Render complete — remove from active tasks
            this.activeRenderTasks.delete(pageNum);
            canvas.dataset.needsRender = 'false';
        } catch (error) {
            // RenderingCancelledException is expected when we cancel tasks
            if (error && error.name === 'RenderingCancelledException') {
                // Silently ignore — this is intentional
                return;
            }
            console.error(`Error lazy rendering page ${pageNum}:`, error);
        }
    }

    /**
     * Track which page is currently visible during scrolling
     * Uses IntersectionObserver for O(1) page detection instead of O(n) scroll loop
     */
    setupScrollPageTracking() {
        const container = document.querySelector('.pdf-canvas-container');

        // Remove existing scroll listener if any
        if (this.handleScrollTracking) {
            container.removeEventListener('scroll', this.handleScrollTracking);
            this.handleScrollTracking = null;
        }

        // Disconnect existing page tracker if any
        if (this.pageTracker) {
            this.pageTracker.disconnect();
            this.pageTracker = null;
        }

        // Create IntersectionObserver for page tracking
        // threshold: 0.5 means the callback fires when 50%+ of a page is visible
        this.pageTracker = new IntersectionObserver((entries) => {
            if (this.viewMode !== 'scroll' || this.initialLoad) return;

            for (const entry of entries) {
                if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    const pageNum = parseInt(entry.target.dataset.pageNum);
                    if (pageNum && this.currentPage !== pageNum) {
                        this.currentPage = pageNum;
                        this.updatePageTrackingUI(pageNum);
                    }
                }
            }
        }, {
            root: container,
            threshold: 0.5
        });

        // Observe all page canvases
        for (const canvas of this.allPageCanvases) {
            this.pageTracker.observe(canvas);
        }

        // Lightweight scroll handler only for the edge case: scroll near top forces page 1
        this.handleScrollTracking = () => {
            if (this.viewMode !== 'scroll' || this.initialLoad) return;

            if (container.scrollTop <= 20 && this.currentPage !== 1) {
                this.currentPage = 1;
                this.updatePageTrackingUI(1);
            }
        };

        container.addEventListener('scroll', this.handleScrollTracking, { passive: true });
    }

    /**
     * Update UI elements when current page changes (called by pageTracker)
     * @param {number} pageNum - New current page number
     */
    updatePageTrackingUI(pageNum) {
        const pageInput = document.getElementById('pageInput');
        if (pageInput) {
            pageInput.value = pageNum;
        }

        if (this.navPanelOpen) {
            this.updateActiveThumbnail(pageNum);
        }
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
        if (!this.pdfDoc) {
            console.error('No PDF document loaded');
            return;
        }

        const navPanel = document.getElementById('navPanel');
        const container = document.querySelector('.app-container');
        const toggleBtn = document.getElementById('toggleNavPanel');


        navPanel.style.display = 'flex';
        this.navPanelOpen = true;
        if (container) {
            container.classList.add('nav-open');
        }
        if (toggleBtn) {
            toggleBtn.classList.add('active');
        }

        // Generate thumbnails if not already generated or if stale
        await this.generateThumbnails(this.thumbnailsStale);
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
    /**
     * Generate thumbnails for all pages (Lazy Loaded)
     */
    async generateThumbnails(force = false) {

        if (!this.pdfDoc) {
            console.error('Cannot generate thumbnails: no PDF document loaded');
            return;
        }

        const navThumbnails = document.getElementById('navThumbnails');
        if (!navThumbnails) {
            console.error('Cannot generate thumbnails: navThumbnails element not found');
            return;
        }

        // Only generate if empty, stale, or forced
        if (this.thumbnails.length > 0 && !force && !this.thumbnailsStale) {
            return;
        }
        this.thumbnailsStale = false;

        navThumbnails.innerHTML = ''; // Clear existing thumbnails
        this.thumbnails = [];

        // Disconnect existing observer if any
        if (this.thumbnailObserver) {
            this.thumbnailObserver.disconnect();
        }

        // Create IntersectionObserver for lazy loading
        this.thumbnailObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const thumbDiv = entry.target;
                    const pageNum = parseInt(thumbDiv.dataset.pageNum);
                    this.renderThumbnail(thumbDiv, pageNum);
                    observer.unobserve(thumbDiv); // Only render once
                }
            });
        }, {
            root: navThumbnails,
            rootMargin: '200px', // Load ahead by 200px
            threshold: 0.1
        });

        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            // Create thumbnail container
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'nav-thumbnail';
            thumbDiv.dataset.pageNum = pageNum;

            // Create thumbnail wrapper (for positioning)
            const thumbWrapper = document.createElement('div');
            thumbWrapper.className = 'nav-thumbnail-wrapper';
            // Set aspect ratio placeholder if possible, otherwise fixed height
            // We don't know exact dimensions yet without loading page, so use standard A4 ratio approx
            thumbWrapper.style.minHeight = '150px';
            thumbWrapper.style.backgroundColor = '#f0f0f0'; // Placeholder color

            // Create label
            const label = document.createElement('div');
            label.className = 'nav-thumbnail-label';
            label.textContent = `Page ${pageNum}`;

            // Selection checkbox overlay
            const selectCheck = document.createElement('div');
            selectCheck.className = 'nav-thumbnail-check';
            const checkIcon = document.createElement('i');
            checkIcon.className = 'ti ti-check';
            checkIcon.setAttribute('aria-hidden', 'true');
            selectCheck.appendChild(checkIcon);
            selectCheck.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePageSelection(pageNum);
            });

            thumbDiv.appendChild(thumbWrapper);
            thumbDiv.appendChild(label);
            thumbDiv.appendChild(selectCheck);

            // Click handler with multi-select support
            thumbDiv.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    if (e.shiftKey && this.lastClickedPage) {
                        // Range select (Shift+Click)
                        const from = Math.min(this.lastClickedPage, pageNum);
                        const to = Math.max(this.lastClickedPage, pageNum);
                        for (let p = from; p <= to; p++) {
                            this.selectedPages.add(p);
                        }
                        this.updateThumbnailSelection();
                    } else {
                        // Toggle select (Ctrl/Cmd+Click)
                        this.togglePageSelection(pageNum);
                    }
                } else {
                    // Normal mode: select this page only and navigate
                    this.clearPageSelection();
                    this.selectedPages.add(pageNum);
                    this.updateThumbnailSelection();
                    this.goToPage(pageNum);
                }
                this.lastClickedPage = pageNum;
            });

            // Right-click context menu on thumbnail
            thumbDiv.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this.selectedPages.has(pageNum)) {
                    this.clearPageSelection();
                    this.selectedPages.add(pageNum);
                    this.updateThumbnailSelection();
                    this.updateMainPageSelection();
                }
                this.showContextMenu(e.clientX, e.clientY, pageNum, 'thumbnail');
            });

            // Drag and drop handlers
            this.setupThumbnailDrag(thumbDiv, pageNum);

            navThumbnails.appendChild(thumbDiv);
            this.thumbnails.push(thumbDiv);

            // Observe for lazy loading
            this.thumbnailObserver.observe(thumbDiv);
        }

    }

    /**
     * Render a specific thumbnail (called by IntersectionObserver)
     */
    async renderThumbnail(thumbDiv, pageNum) {
        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const thumbnailScale = 0.3;
            const viewport = page.getViewport({ scale: thumbnailScale });

            const thumbWrapper = thumbDiv.querySelector('.nav-thumbnail-wrapper');
            if (!thumbWrapper) return;

            // Remove placeholder style
            thumbWrapper.style.minHeight = '';
            thumbWrapper.style.backgroundColor = '';

            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext('2d');
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Create page number overlay badge
            const badge = document.createElement('div');
            badge.className = 'nav-thumbnail-badge';
            badge.textContent = pageNum;

            thumbWrapper.innerHTML = ''; // Clear any placeholder content
            thumbWrapper.appendChild(canvas);
            thumbWrapper.appendChild(badge);

            // Restore selection state if needed
            if (this.selectedPages.has(pageNum)) {
                thumbDiv.classList.add('selected');
            }

        } catch (error) {
            console.error(`Error rendering thumbnail for page ${pageNum}:`, error);
        }
    }

    /**
     * Regenerate a single thumbnail for a specific page
     * @param {number} pageNum - Page number to regenerate
     */
    async generateSingleThumbnail(pageNum) {
        if (!this.pdfDoc || pageNum < 1 || pageNum > this.totalPages) {
            console.error(`Cannot regenerate thumbnail: invalid page ${pageNum}`);
            return;
        }


        const navThumbnails = document.getElementById('navThumbnails');
        if (!navThumbnails) {
            console.error('Cannot regenerate thumbnail: navThumbnails element not found');
            return;
        }

        // Find existing thumbnail
        const existingThumb = navThumbnails.querySelector(`.nav-thumbnail[data-page-num="${pageNum}"]`);
        if (!existingThumb) {
            console.warn(`Thumbnail for page ${pageNum} not found, skipping regeneration`);
            return;
        }

        const thumbnailScale = 0.3; // Same scale as generateThumbnails

        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: thumbnailScale });

            // Find the canvas inside the thumbnail
            const canvas = existingThumb.querySelector('canvas');
            if (!canvas) {
                console.error(`Canvas not found for page ${pageNum}`);
                return;
            }

            // Update canvas dimensions
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext('2d');
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            // Render the page
            await page.render(renderContext).promise;
        } catch (error) {
            console.error(`Failed to regenerate thumbnail for page ${pageNum}:`, error);
        }
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

        // Temporarily disable scroll tracking during navigation
        const wasInitialLoad = this.initialLoad;
        this.initialLoad = true;

        this.currentPage = pageNum;

        // Update page input field
        const pageInput = document.getElementById('pageInput');
        if (pageInput) {
            pageInput.value = pageNum;
        }

        // In scroll mode, scroll to the page manually
        const container = document.querySelector('.pdf-canvas-container');
        if (this.allPageCanvases[pageNum - 1] && container) {
            const targetCanvas = this.allPageCanvases[pageNum - 1];
            const targetWrapper = targetCanvas.parentElement;

            // Calculate exact scroll position
            const containerRect = container.getBoundingClientRect();
            const targetRect = targetWrapper.getBoundingClientRect();
            const scrollOffset = targetRect.top - containerRect.top + container.scrollTop;

            // Use smooth scroll
            container.scrollTo({
                top: scrollOffset,
                behavior: 'smooth'
            });

            // Re-enable scroll tracking after smooth scroll completes (1 second)
            setTimeout(() => {
                this.initialLoad = wasInitialLoad;
            }, 1000);
        } else {
            // If no scroll needed, re-enable immediately
            this.initialLoad = wasInitialLoad;
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
     * Update active thumbnail - now updates selection instead
     */
    updateActiveThumbnail(pageNum) {
        // Clear and select only the current page
        this.selectedPages.clear();
        this.selectedPages.add(pageNum);
        this.updateThumbnailSelection();
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

    /**
     * Toggle page selection in thumbnails
     */
    togglePageSelection(pageNum) {
        if (this.selectedPages.has(pageNum)) {
            this.selectedPages.delete(pageNum);
        } else {
            this.selectedPages.add(pageNum);
        }
        this.updateThumbnailSelection();
    }

    /**
     * Clear page selection
     */
    clearPageSelection() {
        this.selectedPages.clear();
        this.updateThumbnailSelection();
    }

    /**
     * Update visual state of thumbnail selection
     */
    updateThumbnailSelection() {
        const thumbnails = document.querySelectorAll('.nav-thumbnail');
        thumbnails.forEach(thumb => {
            const pageNum = parseInt(thumb.dataset.pageNum);
            if (this.selectedPages.has(pageNum)) {
                thumb.classList.add('selected');
            } else {
                thumb.classList.remove('selected');
            }
        });

        // Update selection counter in nav header
        this.updateSelectionCounter();

        // Update action bar visibility
        this.updateSelectionActionBar();

        // Sync main viewer page selection
        this.updateMainPageSelection();

        // Sync with rotation panel if it's open (avoid loops)
        if (!this.syncInProgress) {
            this.syncThumbnailsToRotationPanel();
        }
    }

    /**
     * Update the selection counter badge in the nav header
     */
    updateSelectionCounter() {
        const count = this.selectedPages.size;
        let counter = document.getElementById('navSelectionCounter');

        if (count > 1) {
            if (!counter) {
                counter = document.createElement('span');
                counter.id = 'navSelectionCounter';
                counter.className = 'nav-selection-counter';
                const navHeader = document.querySelector('.nav-header h3');
                if (navHeader) navHeader.appendChild(counter);
            }
            counter.textContent = count + ' selected';
            counter.classList.add('show');
        } else if (counter) {
            counter.classList.remove('show');
        }
    }

    /**
     * Update the selection action bar at the bottom of the nav panel
     */
    updateSelectionActionBar() {
        const count = this.selectedPages.size;
        let actionBar = document.getElementById('navSelectionActions');

        if (count > 1) {
            if (!actionBar) {
                actionBar = document.createElement('div');
                actionBar.id = 'navSelectionActions';
                actionBar.className = 'nav-selection-actions';

                const actions = [
                    { icon: 'ti-rotate', label: '90° L', title: 'Rotate Left', action: 'rotate-left' },
                    { icon: 'ti-rotate-clockwise', label: '90° R', title: 'Rotate Right', action: 'rotate-right' },
                    { icon: 'ti-rotate-2', label: '180°', title: 'Rotate 180°', action: 'rotate-180' },
                    { icon: 'ti-separator', label: '', title: '', action: 'separator' },
                    { icon: 'ti-cut', label: 'Split', title: 'Split selected pages', action: 'split' },
                    { icon: 'ti-trash', label: 'Delete', title: 'Delete selected pages', action: 'delete' },
                    { icon: 'ti-separator', label: '', title: '', action: 'separator2' },
                    { icon: 'ti-x', label: '', title: 'Clear selection', action: 'clear' },
                ];

                // Selection info
                const info = document.createElement('div');
                info.className = 'nav-selection-info';
                info.id = 'navSelectionInfo';
                actionBar.appendChild(info);

                // Buttons row
                const btnRow = document.createElement('div');
                btnRow.className = 'nav-selection-btn-row';

                actions.forEach(a => {
                    if (a.action.startsWith('separator')) {
                        const sep = document.createElement('div');
                        sep.className = 'nav-action-separator';
                        btnRow.appendChild(sep);
                        return;
                    }
                    const btn = document.createElement('button');
                    btn.className = 'nav-action-btn';
                    btn.title = a.title;
                    btn.setAttribute('aria-label', a.title);
                    btn.dataset.action = a.action;

                    const icon = document.createElement('i');
                    icon.className = 'ti ' + a.icon;
                    icon.setAttribute('aria-hidden', 'true');
                    btn.appendChild(icon);

                    if (a.label) {
                        const span = document.createElement('span');
                        span.textContent = a.label;
                        btn.appendChild(span);
                    }

                    if (a.action === 'delete') {
                        btn.classList.add('danger');
                    }
                    if (a.action === 'clear') {
                        btn.classList.add('clear-btn');
                    }

                    btn.addEventListener('click', () => this.handleSelectionAction(a.action));
                    btnRow.appendChild(btn);
                });

                actionBar.appendChild(btnRow);

                const navPanel = document.getElementById('navPanel');
                if (navPanel) navPanel.appendChild(actionBar);
            }

            // Update info text
            const info = document.getElementById('navSelectionInfo');
            if (info) {
                const pages = this.getSelectedPages();
                info.textContent = count + ' page' + (count > 1 ? 's' : '') + ' selected';
            }

            actionBar.classList.add('show');
        } else if (actionBar) {
            actionBar.classList.remove('show');
        }
    }

    /**
     * Handle action from the selection action bar
     */
    handleSelectionAction(action) {
        const selectedPages = this.getSelectedPages();
        if (selectedPages.length === 0) return;

        switch (action) {
            case 'rotate-left':
                if (typeof executeRotateSelected === 'function') {
                    executeRotateSelected(270, selectedPages);
                }
                break;
            case 'rotate-right':
                if (typeof executeRotateSelected === 'function') {
                    executeRotateSelected(90, selectedPages);
                }
                break;
            case 'rotate-180':
                if (typeof executeRotateSelected === 'function') {
                    executeRotateSelected(180, selectedPages);
                }
                break;
            case 'split':
                if (typeof executeSplitSelected === 'function') {
                    executeSplitSelected(selectedPages);
                }
                break;
            case 'delete':
                if (typeof executeDeleteSelected === 'function') {
                    executeDeleteSelected(selectedPages);
                }
                break;
            case 'clear':
                this.clearPageSelection();
                break;
        }
    }

    /**
     * Sync thumbnail selection to rotation panel checkboxes (if panel is open)
     */
    syncThumbnailsToRotationPanel() {
        const checkboxes = document.querySelectorAll('.page-checkbox input[type="checkbox"]');
        if (checkboxes.length === 0) return; // Panel not open

        this.syncInProgress = true; // Set flag to prevent loops

        const selectedPages = this.getSelectedPages();

        checkboxes.forEach(checkbox => {
            const pageNum = parseInt(checkbox.value);
            checkbox.checked = selectedPages.includes(pageNum);
        });

        this.syncInProgress = false; // Reset flag
    }

    /**
     * Get array of selected page numbers
     */
    getSelectedPages() {
        return Array.from(this.selectedPages).sort((a, b) => a - b);
    }
}
