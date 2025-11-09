/**
 * PNG-Based Insertion Overlay v2.0.0
 * Renders PDF page as PNG for precise insertion positioning
 */

class PNGInsertionOverlay {
    constructor() {
        this.active = false;
        this.overlayContainer = null;
        this.pngCanvas = null;
        this.pageNumber = null;
        this.insertionType = null; // 'image' or 'signature'
        this.imageData = null; // Image/signature to insert
        this.drawingBox = null; // { x, y, width, height } on PNG canvas
        this.isDragging = false;
        this.isResizing = false;
        this.dragStart = null;
        this.resizeHandle = null;
        this.selectedPages = new Set(); // For batch insertion
    }

    /**
     * Show PNG overlay for insertion
     * @param {number} pageNumber - Page number (1-indexed)
     * @param {string} type - 'image' or 'signature'
     * @param {Object} imageData - { url, buffer, imageType }
     */
    async show(pageNumber, type, imageData) {
        console.log(`🎯 [PNG Overlay] Opening for ${type} insertion on page ${pageNumber}`);

        this.pageNumber = pageNumber;
        this.insertionType = type;
        this.imageData = imageData;

        // Generate PNG from current page
        await this.generatePagePNG();

        // Create overlay UI
        this.createOverlay();

        // Show the overlay
        this.active = true;

        // Add instruction to draw box
        this.showInstruction();
    }

    /**
     * Generate PNG image of the current PDF page
     */
    async generatePagePNG() {
        console.log(`🖼️ [PNG Overlay] Generating PNG for page ${this.pageNumber}`);

        try {
            // Get the current page from PDF.js
            const page = await viewer.pdfDoc.getPage(this.pageNumber);

            // Get page rotation
            const rotation = page.rotate || 0;
            console.log(`🔄 [PNG Overlay] Page rotation: ${rotation}°`);

            // HIGH-RES: Always render at 2x scale for crisp preview/insertion
            const HIGH_RES_SCALE = 2.0;
            const renderScale = viewer.scale * HIGH_RES_SCALE;

            // Calculate scale to match current zoom/viewport (with rotation)
            const viewport = page.getViewport({ scale: renderScale, rotation: rotation });

            // Also get unrotated viewport for dimension comparison
            const unrotatedViewport = page.getViewport({ scale: renderScale, rotation: 0 });

            // Create a canvas to render the page
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            console.log(`📐 [PNG Overlay] Rendering at ${HIGH_RES_SCALE}x scale (viewer: ${viewer.scale}, render: ${renderScale})`);

            // Render page to canvas at high resolution
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            this.pngCanvas = canvas;
            this.pageRotation = rotation; // Store rotation for coordinate transformation
            this.viewport = viewport; // Store viewport for coordinate conversion
            this.rotatedViewportDimensions = { width: viewport.width, height: viewport.height };
            this.unrotatedViewportDimensions = { width: unrotatedViewport.width, height: unrotatedViewport.height };

            console.log(`✅ [PNG Overlay] High-res PNG generated: ${canvas.width}x${canvas.height} (rotation: ${rotation}°)`);
        } catch (error) {
            console.error('❌ [PNG Overlay] Failed to generate PNG:', error);
            throw error;
        }
    }

    /**
     * Create the overlay UI
     */
    createOverlay() {
        // Create overlay container
        this.overlayContainer = document.createElement('div');
        this.overlayContainer.className = 'png-insertion-overlay';

        // Generate page checkboxes
        const totalPages = viewer.pdfDoc ? viewer.pdfDoc.numPages : 1;
        this.selectedPages.add(this.pageNumber); // Pre-select current page

        let pageCheckboxes = '';
        for (let i = 1; i <= totalPages; i++) {
            const isChecked = this.selectedPages.has(i) ? 'checked' : '';
            pageCheckboxes += `
                <label class="png-page-checkbox-item">
                    <input type="checkbox" value="${i}" ${isChecked} class="png-page-checkbox">
                    <span>Page ${i}</span>
                </label>
            `;
        }

        this.overlayContainer.innerHTML = `
            <div class="png-overlay-backdrop"></div>
            <div class="png-overlay-content">
                <div class="png-overlay-header">
                    <h3>
                        <i class="ti ti-crosshair"></i>
                        ${this.insertionType === 'image' ? 'Insert Image' : 'Insert Signature'}
                    </h3>
                    <button class="png-overlay-close" id="pngOverlayClose">
                        <i class="ti ti-x"></i>
                    </button>
                </div>
                <div class="png-overlay-body">
                    <div class="png-overlay-sidebar">
                        <div class="png-pages-panel">
                            <div class="png-pages-header">
                                <h4><i class="ti ti-list-check"></i> Select Pages</h4>
                                <div class="png-pages-actions">
                                    <button class="png-select-all-btn" id="pngSelectAll" title="Select All">
                                        <i class="ti ti-checkbox"></i>
                                    </button>
                                    <button class="png-select-none-btn" id="pngSelectNone" title="Deselect All">
                                        <i class="ti ti-square"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="png-pages-list" id="pngPagesList">
                                ${pageCheckboxes}
                            </div>
                            <div class="png-pages-summary">
                                <span id="pngSelectedCount">${this.selectedPages.size}</span> page(s) selected
                            </div>
                        </div>
                    </div>
                    <div class="png-overlay-main">
                        <div class="png-canvas-wrapper" id="pngCanvasWrapper">
                            <!-- PNG will be inserted here -->
                            <div class="png-drawing-area" id="pngDrawingArea"></div>
                        </div>
                        <div class="png-overlay-instruction" id="pngInstruction">
                            <i class="ti ti-pointer"></i>
                            <p>Click and drag to draw a box where you want to insert the ${this.insertionType}</p>
                        </div>
                    </div>
                </div>
                <div class="png-overlay-footer">
                    <button class="png-overlay-btn cancel" id="pngOverlayCancel">
                        <i class="ti ti-x"></i> Cancel
                    </button>
                    <button class="png-overlay-btn validate" id="pngOverlayValidate" disabled>
                        <i class="ti ti-check"></i> Insert on <span id="pngInsertCount">${this.selectedPages.size}</span> page(s)
                    </button>
                </div>
            </div>
        `;

        // Append to body
        document.body.appendChild(this.overlayContainer);

        // Insert the PNG canvas
        const wrapper = document.getElementById('pngCanvasWrapper');
        wrapper.insertBefore(this.pngCanvas, wrapper.firstChild);
        this.pngCanvas.className = 'png-render-canvas';

        // Sync drawing area with canvas after rendering
        setTimeout(() => this.syncDrawingAreaWithCanvas(), 0);

        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Sync drawing area position and size with the displayed canvas
     */
    syncDrawingAreaWithCanvas() {
        const drawingArea = document.getElementById('pngDrawingArea');
        const canvasRect = this.pngCanvas.getBoundingClientRect();
        const wrapperRect = drawingArea.parentElement.getBoundingClientRect();

        // Position drawing area exactly over the canvas
        drawingArea.style.left = (canvasRect.left - wrapperRect.left) + 'px';
        drawingArea.style.top = (canvasRect.top - wrapperRect.top) + 'px';
        drawingArea.style.width = canvasRect.width + 'px';
        drawingArea.style.height = canvasRect.height + 'px';

        console.log('📐 [Drawing Area Sync]', {
            canvas: { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height },
            wrapper: { left: wrapperRect.left, top: wrapperRect.top },
            drawingArea: { left: drawingArea.style.left, top: drawingArea.style.top, width: drawingArea.style.width, height: drawingArea.style.height }
        });
    }

    /**
     * Setup event handlers for drawing, resizing, and validation
     */
    setupEventHandlers() {
        const drawingArea = document.getElementById('pngDrawingArea');
        const validateBtn = document.getElementById('pngOverlayValidate');
        const cancelBtn = document.getElementById('pngOverlayCancel');
        const closeBtn = document.getElementById('pngOverlayClose');
        const selectAllBtn = document.getElementById('pngSelectAll');
        const selectNoneBtn = document.getElementById('pngSelectNone');
        const pageCheckboxes = document.querySelectorAll('.png-page-checkbox');

        // Page checkbox handlers
        pageCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const pageNum = parseInt(e.target.value);
                if (e.target.checked) {
                    this.selectedPages.add(pageNum);
                } else {
                    this.selectedPages.delete(pageNum);
                }
                this.updateSelectedCount();
            });
        });

        // Select All button
        selectAllBtn.addEventListener('click', () => {
            pageCheckboxes.forEach(checkbox => {
                checkbox.checked = true;
                this.selectedPages.add(parseInt(checkbox.value));
            });
            this.updateSelectedCount();
        });

        // Select None button
        selectNoneBtn.addEventListener('click', () => {
            pageCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
                this.selectedPages.delete(parseInt(checkbox.value));
            });
            this.updateSelectedCount();
        });

        // Drawing handlers
        drawingArea.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Button handlers
        validateBtn.addEventListener('click', () => this.validateInsertion());
        cancelBtn.addEventListener('click', () => this.close());
        closeBtn.addEventListener('click', () => this.close());

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.active) {
                this.close();
            }
        });

        // Window resize handler - re-sync drawing area with canvas
        window.addEventListener('resize', () => {
            if (this.active) {
                console.log('🔄 Window resized - re-syncing drawing area');
                this.syncDrawingAreaWithCanvas();
                // Redraw the box if it exists
                if (this.drawingBox) {
                    this.renderBox();
                }
            }
        });
    }

    /**
     * Update the selected page count display
     */
    updateSelectedCount() {
        const countSpan = document.getElementById('pngSelectedCount');
        const insertCountSpan = document.getElementById('pngInsertCount');
        if (countSpan) {
            countSpan.textContent = this.selectedPages.size;
        }
        if (insertCountSpan) {
            insertCountSpan.textContent = this.selectedPages.size;
        }
    }

    /**
     * Handle mouse down - start drawing or dragging/resizing
     */
    handleMouseDown(e) {
        const drawingArea = document.getElementById('pngDrawingArea');
        const rect = drawingArea.getBoundingClientRect();

        // Get coordinates relative to the drawing area
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on existing box
        if (this.drawingBox) {
            const box = this.drawingBox;
            const handleSize = 10;

            // Check if clicking on resize handles
            const handles = [
                { name: 'nw', x: box.x, y: box.y },
                { name: 'ne', x: box.x + box.width, y: box.y },
                { name: 'sw', x: box.x, y: box.y + box.height },
                { name: 'se', x: box.x + box.width, y: box.y + box.height }
            ];

            for (const handle of handles) {
                if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
                    this.isResizing = true;
                    this.resizeHandle = handle.name;
                    this.dragStart = { x, y, originalBox: { ...box } };
                    return;
                }
            }

            // Check if clicking inside box (dragging)
            if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
                this.isDragging = true;
                this.dragStart = { x, y, originalBox: { ...box } };
                return;
            }
        }

        // Start drawing new box
        this.isDragging = true;
        this.drawingBox = { x, y, width: 0, height: 0 };
        this.dragStart = { x, y };
        this.renderBox();
    }

    /**
     * Handle mouse move - update box dimensions
     */
    handleMouseMove(e) {
        if (!this.isDragging && !this.isResizing) return;

        const drawingArea = document.getElementById('pngDrawingArea');
        const rect = drawingArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isResizing) {
            // Resize the box
            const deltaX = x - this.dragStart.x;
            const deltaY = y - this.dragStart.y;
            const originalBox = this.dragStart.originalBox;

            switch (this.resizeHandle) {
                case 'se': // Bottom-right
                    this.drawingBox.width = Math.max(20, originalBox.width + deltaX);
                    this.drawingBox.height = Math.max(20, originalBox.height + deltaY);
                    break;
                case 'sw': // Bottom-left
                    this.drawingBox.x = originalBox.x + deltaX;
                    this.drawingBox.width = Math.max(20, originalBox.width - deltaX);
                    this.drawingBox.height = Math.max(20, originalBox.height + deltaY);
                    break;
                case 'ne': // Top-right
                    this.drawingBox.y = originalBox.y + deltaY;
                    this.drawingBox.width = Math.max(20, originalBox.width + deltaX);
                    this.drawingBox.height = Math.max(20, originalBox.height - deltaY);
                    break;
                case 'nw': // Top-left
                    this.drawingBox.x = originalBox.x + deltaX;
                    this.drawingBox.y = originalBox.y + deltaY;
                    this.drawingBox.width = Math.max(20, originalBox.width - deltaX);
                    this.drawingBox.height = Math.max(20, originalBox.height - deltaY);
                    break;
            }
        } else if (this.isDragging && this.dragStart.originalBox) {
            // Dragging existing box
            const deltaX = x - this.dragStart.x;
            const deltaY = y - this.dragStart.y;
            const originalBox = this.dragStart.originalBox;

            this.drawingBox.x = Math.max(0, originalBox.x + deltaX);
            this.drawingBox.y = Math.max(0, originalBox.y + deltaY);
        } else {
            // Drawing new box
            const width = x - this.dragStart.x;
            const height = y - this.dragStart.y;

            this.drawingBox.width = Math.abs(width);
            this.drawingBox.height = Math.abs(height);
            this.drawingBox.x = width < 0 ? x : this.dragStart.x;
            this.drawingBox.y = height < 0 ? y : this.dragStart.y;
        }

        this.renderBox();
    }

    /**
     * Handle mouse up - finish drawing/dragging/resizing
     */
    handleMouseUp(e) {
        if (this.isDragging || this.isResizing) {
            this.isDragging = false;
            this.isResizing = false;
            this.resizeHandle = null;

            // Enable validate button if box is valid
            if (this.drawingBox && this.drawingBox.width > 10 && this.drawingBox.height > 10) {
                document.getElementById('pngOverlayValidate').disabled = false;
                this.hideInstruction();
            }
        }
    }

    /**
     * Render the drawing box on the PNG canvas
     */
    renderBox() {
        const drawingArea = document.getElementById('pngDrawingArea');

        // Remove existing box
        const existingBox = drawingArea.querySelector('.drawing-box');
        if (existingBox) {
            existingBox.remove();
        }

        if (!this.drawingBox) return;

        // Create box element
        const boxEl = document.createElement('div');
        boxEl.className = 'drawing-box';
        boxEl.style.left = this.drawingBox.x + 'px';
        boxEl.style.top = this.drawingBox.y + 'px';
        boxEl.style.width = this.drawingBox.width + 'px';
        boxEl.style.height = this.drawingBox.height + 'px';

        // Add resize handles
        ['nw', 'ne', 'sw', 'se'].forEach(corner => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${corner}`;
            boxEl.appendChild(handle);
        });

        // Show preview of the image/signature inside the box
        if (this.imageData && this.imageData.url) {
            const preview = document.createElement('img');
            preview.src = this.imageData.url;
            preview.className = 'box-preview-image';
            boxEl.appendChild(preview);
        }

        drawingArea.appendChild(boxEl);
    }

    /**
     * Show instruction message
     */
    showInstruction() {
        const instruction = document.getElementById('pngInstruction');
        if (instruction) {
            instruction.style.display = 'flex';
        }
    }

    /**
     * Hide instruction message
     */
    hideInstruction() {
        const instruction = document.getElementById('pngInstruction');
        if (instruction) {
            instruction.style.display = 'none';
        }
    }

    /**
     * Validate and perform the insertion
     */
    async validateInsertion() {
        if (!this.drawingBox || !this.imageData) {
            showNotification('No box drawn or no image data', 'error');
            return;
        }

        if (this.selectedPages.size === 0) {
            showNotification('Please select at least one page', 'error');
            return;
        }

        console.log('🎯 [PNG Overlay] Validating batch insertion on', this.selectedPages.size, 'page(s)...');

        // Show loading notification
        showNotification(`Processing insertion on ${this.selectedPages.size} page(s)...`, 'info', 30000);

        try {
            const selectedPageArray = Array.from(this.selectedPages).sort((a, b) => a - b);
            let successCount = 0;
            let failCount = 0;

            // OPTIMIZATION: Load PDF once with pdf-lib
            console.log('📄 [Batch Optimization] Loading PDF once for all insertions...');
            const pdfDoc = await PDFLib.PDFDocument.load(currentPDFData);

            // OPTIMIZATION: Pre-process and embed images for each unique rotation (0°, 90°, 180°, 270°)
            // This creates rotated+upscaled versions to avoid pixelation and rotation issues
            console.log('🖼️ [PNG Overlay] Pre-processing images for each rotation...');
            const imagesByRotation = new Map(); // rotation -> embeddedImage

            // Insert on each selected page
            for (const pageNum of selectedPageArray) {
                try {
                    // Store current page to calculate correct transformation
                    const originalPageNum = this.pageNumber;
                    this.pageNumber = pageNum;

                    // Get page for rotation info (from PDF.js)
                    const pdfJsPage = await viewer.pdfDoc.getPage(pageNum);
                    this.pageRotation = pdfJsPage.rotate || 0;

                    console.log(`📄 [PNG Overlay] Page ${pageNum}: rotation = ${this.pageRotation}°`);

                    // Create and embed rotated+upscaled image for this rotation if not already done
                    if (!imagesByRotation.has(this.pageRotation)) {
                        console.log(`🔄 [PNG Overlay] Processing image for rotation ${this.pageRotation}°...`);

                        const processedImageBuffer = await this.rotateAndUpscaleImage(
                            this.imageData.buffer,
                            this.imageData.imageType,
                            this.pageRotation
                        );

                        // Always embed as PNG (since rotateAndUpscaleImage returns PNG)
                        const embeddedImage = await pdfDoc.embedPng(processedImageBuffer);
                        imagesByRotation.set(this.pageRotation, embeddedImage);
                        console.log(`✅ [PNG Overlay] Image for ${this.pageRotation}° cached`);
                    }

                    const embeddedImage = imagesByRotation.get(this.pageRotation);

                    // Calculate transformation from PNG coordinates to PDF coordinates
                    const pdfCoords = await this.transformCoordinates(this.drawingBox);

                    console.log(`📐 [PNG Overlay] Page ${pageNum} transformation:`, {
                        png: this.drawingBox,
                        pdf: pdfCoords,
                        rotation: this.pageRotation
                    });

                    // OPTIMIZATION: Insert directly on the pdf-lib page (no reload per page)
                    const pageIndex = pageNum - 1;
                    const page = pdfDoc.getPage(pageIndex);

                    page.drawImage(embeddedImage, {
                        x: pdfCoords.x,
                        y: pdfCoords.y,
                        width: pdfCoords.width,
                        height: pdfCoords.height,
                        opacity: 1
                    });

                    successCount++;

                    // Restore original page number
                    this.pageNumber = originalPageNum;
                } catch (pageError) {
                    console.error(`❌ [PNG Overlay] Failed on page ${pageNum}:`, pageError);
                    failCount++;
                }
            }

            // OPTIMIZATION: Save PDF once after all insertions
            console.log('💾 [Batch Optimization] Saving PDF once after all insertions...');
            const pdfBytes = await pdfDoc.save();
            currentPDFData = pdfBytes.buffer.slice(0);

            // Update document in tabs
            const activeDoc = getActiveDocument();
            if (activeDoc) {
                activeDoc.pdfData = currentPDFData.slice(0);
            }

            // Update cache
            if (currentCacheId && currentPDFData) {
                await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
            }

            // OPTIMIZATION: Reload viewer once after all insertions
            console.log('🔄 [Batch Optimization] Reloading viewer once...');
            await viewer.loadPDF(currentPDFData.slice(0));
            await viewer.goToPage(selectedPageArray[0]); // Go to first modified page

            // NOTE: Thumbnail regeneration is skipped for performance (would take 20-30s)
            // User can manually refresh thumbnails by closing/opening the panel if needed

            // Add to history
            addEditToHistory(`Inserted ${this.insertionType} on ${successCount} page(s)`);

            // Close overlay
            this.close();

            // Show result
            if (failCount === 0) {
                showNotification(`${this.insertionType === 'image' ? 'Image' : 'Signature'} inserted successfully on ${successCount} page(s)!`, 'success');
            } else {
                showNotification(`Inserted on ${successCount} page(s), failed on ${failCount} page(s)`, 'warning');
            }
        } catch (error) {
            console.error('❌ [PNG Overlay] Batch insertion failed:', error);
            showNotification('Failed to insert: ' + error.message, 'error');
        }
    }

    /**
     * Transform PNG coordinates to PDF coordinates - v2.3.4 COMPLETE REWRITE
     * @param {Object} boxOnScreen - { x, y, width, height } in screen pixels (CSS)
     * @returns {Object} - { x, y, width, height } in PDF points
     */
    async transformCoordinates(boxOnScreen) {
        console.log('=== v2.3.14 SIMPLE VIEWPORT-BASED ALGORITHM ===');
        console.log('📍 Screen box (CSS px, top-left origin):', boxOnScreen);

        // Step 1: Screen pixels → Canvas pixels
        const canvasRect = this.pngCanvas.getBoundingClientRect();
        const screenW = canvasRect.width;
        const screenH = canvasRect.height;
        const canvasW = this.pngCanvas.width;
        const canvasH = this.pngCanvas.height;

        const scaleScreenToCanvas = canvasW / screenW;
        console.log('📐 Screen→Canvas scale:', scaleScreenToCanvas);

        // Box in canvas pixels (viewport space, top-left origin)
        const cx = boxOnScreen.x * scaleScreenToCanvas;
        const cy = boxOnScreen.y * scaleScreenToCanvas;
        const cw = boxOnScreen.width * scaleScreenToCanvas;
        const ch = boxOnScreen.height * scaleScreenToCanvas;

        console.log('🎨 Canvas box (viewport space):', { x: cx, y: cy, w: cw, h: ch });

        // Step 2: Use PDF.js viewport to convert canvas coords to PDF coords
        // The viewport has all the rotation/scaling logic built-in!

        // Convert the 4 corners of the box from canvas (viewport) to PDF coordinates
        const topLeft = this.viewport.convertToPdfPoint(cx, cy);
        const topRight = this.viewport.convertToPdfPoint(cx + cw, cy);
        const bottomLeft = this.viewport.convertToPdfPoint(cx, cy + ch);
        const bottomRight = this.viewport.convertToPdfPoint(cx + cw, cy + ch);

        console.log('🔄 Corner transformations:', {
            topLeft,
            topRight,
            bottomLeft,
            bottomRight
        });

        // Find bounding box of the transformed corners
        const pdfX = Math.min(topLeft[0], topRight[0], bottomLeft[0], bottomRight[0]);
        const pdfY = Math.min(topLeft[1], topRight[1], bottomLeft[1], bottomRight[1]);
        const pdfMaxX = Math.max(topLeft[0], topRight[0], bottomLeft[0], bottomRight[0]);
        const pdfMaxY = Math.max(topLeft[1], topRight[1], bottomLeft[1], bottomRight[1]);
        const pdfBoxW = pdfMaxX - pdfX;
        const pdfBoxH = pdfMaxY - pdfY;

        const result = { x: pdfX, y: pdfY, width: pdfBoxW, height: pdfBoxH };

        console.log('✅ PDF coordinates (pdf-lib space):', result);
        console.log('   PDF box bounds:', {
            left: pdfX,
            bottom: pdfY,
            right: pdfMaxX,
            top: pdfMaxY
        });
        console.log('=====================================');
        return result;
    }

    /**
     * Insert image into PDF using pdf-lib
     */
    async insertImageIntoPDF(pageIndex, coords) {
        console.log('🖼️ [PNG Overlay] Inserting image into PDF...');

        const modifiedPDF = await tools.insertImage(
            currentPDFData,
            this.imageData.buffer,
            this.imageData.imageType,
            pageIndex,
            {
                x: coords.x,
                y: coords.y,
                width: coords.width,
                height: coords.height,
                opacity: 1,
                coordsAlreadyTransformed: true // v2.0.0 flag
            }
        );

        // Update current PDF data
        currentPDFData = modifiedPDF.buffer.slice(0);

        // Update document in tabs
        const activeDoc = getActiveDocument();
        if (activeDoc) {
            activeDoc.pdfData = currentPDFData.slice(0);
        }

        // Update cache
        if (currentCacheId && currentPDFData) {
            await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
        }

        // Reload viewer
        await viewer.loadPDF(currentPDFData.slice(0));
        await viewer.goToPage(this.pageNumber);

        // Refresh thumbnails if navigator panel is open
        if (viewer.navPanelOpen) {
            console.log('🔄 Refreshing thumbnails after image insertion...');
            await viewer.generateThumbnails(true);
        }

        // Add to history
        addEditToHistory(`Inserted image on page ${this.pageNumber}`);
    }

    /**
     * Insert signature into PDF using pdf-lib
     */
    async insertSignatureIntoPDF(pageIndex, coords) {
        console.log('✍️ [PNG Overlay] Inserting signature into PDF...');

        const modifiedPDF = await tools.insertImage(
            currentPDFData,
            this.imageData.buffer,
            this.imageData.imageType,
            pageIndex,
            {
                x: coords.x,
                y: coords.y,
                width: coords.width,
                height: coords.height,
                opacity: 1,
                coordsAlreadyTransformed: true // v2.0.0 flag
            }
        );

        // Update current PDF data
        currentPDFData = modifiedPDF.buffer.slice(0);

        // Update document in tabs
        const activeDoc = getActiveDocument();
        if (activeDoc) {
            activeDoc.pdfData = currentPDFData.slice(0);
        }

        // Update cache
        if (currentCacheId && currentPDFData) {
            await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
        }

        // Reload viewer
        await viewer.loadPDF(currentPDFData.slice(0));
        await viewer.goToPage(this.pageNumber);

        // Refresh thumbnails if navigator panel is open
        if (viewer.navPanelOpen) {
            console.log('🔄 Refreshing thumbnails after signature insertion...');
            await viewer.generateThumbnails(true);
        }

        // Add to history
        addEditToHistory(`Inserted signature on page ${this.pageNumber}`);
    }

    /**
     * Rotate and upscale image for crisp rendering with rotation compensation
     * @param {ArrayBuffer} imageBuffer - Original image data
     * @param {string} imageType - Image type (png/jpeg)
     * @param {number} pageRotation - Page rotation in degrees (0, 90, 180, 270)
     * @returns {Promise<ArrayBuffer>} Rotated and upscaled PNG data
     */
    async rotateAndUpscaleImage(imageBuffer, imageType, pageRotation) {
        console.log(`🔄 [Image Processing] Rotating and upscaling ${imageType} for ${pageRotation}° page`);

        // HIGH-RES: 3x upscale for crisp rendering
        const UPSCALE = 3;

        return new Promise((resolve, reject) => {
            // Load image
            const blob = new Blob([imageBuffer], { type: imageType });
            const url = URL.createObjectURL(blob);
            const img = new Image();

            img.onload = () => {
                // Original dimensions
                const origW = img.width;
                const origH = img.height;

                // Upscaled dimensions
                const upscaledW = origW * UPSCALE;
                const upscaledH = origH * UPSCALE;

                // Adjust canvas size based on rotation
                let canvasW, canvasH;
                if (pageRotation === 90 || pageRotation === 270) {
                    canvasW = upscaledH;
                    canvasH = upscaledW;
                } else {
                    canvasW = upscaledW;
                    canvasH = upscaledH;
                }

                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = canvasW;
                canvas.height = canvasH;
                const ctx = canvas.getContext('2d');

                // Enable high-quality rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Apply rotation transformation
                ctx.save();

                if (pageRotation === 90) {
                    ctx.translate(0, canvasH);
                    ctx.rotate(-Math.PI / 2);
                } else if (pageRotation === 180) {
                    ctx.translate(canvasW, canvasH);
                    ctx.rotate(Math.PI);
                } else if (pageRotation === 270) {
                    ctx.translate(canvasW, 0);
                    ctx.rotate(Math.PI / 2);
                }

                // Draw upscaled image
                ctx.drawImage(img, 0, 0, upscaledW, upscaledH);
                ctx.restore();

                console.log(`✅ [Image Processing] Upscaled ${origW}x${origH} → ${upscaledW}x${upscaledH}, canvas: ${canvasW}x${canvasH}`);

                // Convert to PNG blob
                canvas.toBlob(async (blob) => {
                    const arrayBuffer = await blob.arrayBuffer();
                    URL.revokeObjectURL(url);
                    resolve(arrayBuffer);
                }, 'image/png');
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };

            img.src = url;
        });
    }

    /**
     * Close and cleanup the overlay
     */
    close() {
        console.log('🚪 [PNG Overlay] Closing overlay');

        if (this.overlayContainer) {
            this.overlayContainer.remove();
        }

        this.active = false;
        this.overlayContainer = null;
        this.pngCanvas = null;
        this.drawingBox = null;
        this.pageNumber = null;
        this.insertionType = null;
        this.imageData = null;
    }
}

// Create global instance
window.pngInsertionOverlay = new PNGInsertionOverlay();
