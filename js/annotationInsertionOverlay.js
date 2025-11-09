/**
 * Annotation Insertion Overlay - Similar to PNG Insertion but for text annotations
 * Allows batch annotation placement on multiple pages
 */

class AnnotationInsertionOverlay {
    constructor() {
        this.active = false;
        this.overlayContainer = null;
        this.pngCanvas = null;
        this.pageNumber = null;
        this.annotationData = null; // { text, fontSize, color, colorRGB }
        this.drawingBox = null; // { x, y, width, height } on PNG canvas
        this.isDragging = false;
        this.isResizing = false;
        this.dragStart = null;
        this.resizeHandle = null;
        this.selectedPages = new Set(); // For batch insertion
    }

    /**
     * Show annotation overlay for insertion
     * @param {number} pageNumber - Page number (1-indexed)
     * @param {Object} annotationData - { text, fontSize, color, colorRGB }
     */
    async show(pageNumber, annotationData) {
        console.log(`📝 [Annotation Overlay] Opening for annotation on page ${pageNumber}`);

        this.pageNumber = pageNumber;
        this.annotationData = annotationData;

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
        console.log(`🖼️ [Annotation Overlay] Generating PNG for page ${this.pageNumber}`);

        try {
            // Get the current page from PDF.js
            const page = await viewer.pdfDoc.getPage(this.pageNumber);

            // Get page rotation
            const rotation = page.rotate || 0;
            console.log(`🔄 [Annotation Overlay] Page rotation: ${rotation}°`);

            // HIGH-RES: Always render at 2x scale for crisp preview/insertion
            const HIGH_RES_SCALE = 2.0;
            const renderScale = viewer.scale * HIGH_RES_SCALE;

            // Calculate scale to match current zoom/viewport (with rotation)
            const viewport = page.getViewport({ scale: renderScale, rotation: rotation });

            // Create a canvas to render the page
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            console.log(`📐 [Annotation Overlay] Rendering at ${HIGH_RES_SCALE}x scale (viewer: ${viewer.scale}, render: ${renderScale})`);

            // Render page to canvas at high resolution
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            this.pngCanvas = canvas;
            this.pageRotation = rotation; // Store rotation for coordinate transformation
            this.viewport = viewport; // Store viewport for coordinate conversion

            console.log(`✅ [Annotation Overlay] High-res PNG generated: ${canvas.width}x${canvas.height} (rotation: ${rotation}°)`);
        } catch (error) {
            console.error('❌ [Annotation Overlay] Failed to generate PNG:', error);
            throw error;
        }
    }

    /**
     * Create the overlay UI
     */
    createOverlay() {
        // Create overlay container
        this.overlayContainer = document.createElement('div');
        this.overlayContainer.className = 'annotation-insertion-overlay';

        // Generate page checkboxes
        const totalPages = viewer.pdfDoc ? viewer.pdfDoc.numPages : 1;
        this.selectedPages.add(this.pageNumber); // Pre-select current page

        let pageCheckboxes = '';
        for (let i = 1; i <= totalPages; i++) {
            const isChecked = this.selectedPages.has(i) ? 'checked' : '';
            pageCheckboxes += `
                <label class="annotation-page-checkbox-item">
                    <input type="checkbox" value="${i}" ${isChecked} class="annotation-page-checkbox">
                    <span>Page ${i}</span>
                </label>
            `;
        }

        this.overlayContainer.innerHTML = `
            <div class="annotation-overlay-backdrop"></div>
            <div class="annotation-overlay-content">
                <div class="annotation-overlay-header">
                    <h3>
                        <i class="ti ti-pencil"></i>
                        Add Text Annotation
                    </h3>
                    <button class="annotation-overlay-close" id="annotationOverlayClose">
                        <i class="ti ti-x"></i>
                    </button>
                </div>
                <div class="annotation-overlay-body">
                    <div class="annotation-overlay-sidebar">
                        <div class="annotation-pages-panel">
                            <div class="annotation-pages-header">
                                <h4><i class="ti ti-list-check"></i> Select Pages</h4>
                                <div class="annotation-pages-actions">
                                    <button class="annotation-select-all-btn" id="annotationSelectAll" title="Select All">
                                        <i class="ti ti-checkbox"></i>
                                    </button>
                                    <button class="annotation-select-none-btn" id="annotationSelectNone" title="Deselect All">
                                        <i class="ti ti-square"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="annotation-pages-list" id="annotationPagesList">
                                ${pageCheckboxes}
                            </div>
                            <div class="annotation-pages-summary">
                                <span id="annotationSelectedCount">${this.selectedPages.size}</span> page(s) selected
                            </div>
                        </div>
                        <div class="annotation-preview-panel">
                            <div class="annotation-preview-header">
                                <h4><i class="ti ti-eye"></i> Preview</h4>
                            </div>
                            <div class="annotation-preview-content">
                                <div class="annotation-preview-text" style="font-size: ${this.annotationData.fontSize}px; color: ${this.annotationData.color};">
                                    ${this.annotationData.text}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="annotation-overlay-main">
                        <div class="annotation-canvas-wrapper" id="annotationCanvasWrapper">
                            <!-- PNG will be inserted here -->
                            <div class="annotation-drawing-area" id="annotationDrawingArea"></div>
                        </div>
                        <div class="annotation-overlay-instruction" id="annotationInstruction">
                            <i class="ti ti-pointer"></i>
                            <p>Click and drag to draw a box where you want to place the annotation</p>
                        </div>
                    </div>
                </div>
                <div class="annotation-overlay-footer">
                    <button class="annotation-overlay-btn cancel" id="annotationOverlayCancel">
                        <i class="ti ti-x"></i> Cancel
                    </button>
                    <button class="annotation-overlay-btn validate" id="annotationOverlayValidate" disabled>
                        <i class="ti ti-check"></i> Insert on <span id="annotationInsertCount">${this.selectedPages.size}</span> page(s)
                    </button>
                </div>
            </div>
        `;

        // Append to body
        document.body.appendChild(this.overlayContainer);

        // Insert the PNG canvas
        const wrapper = document.getElementById('annotationCanvasWrapper');
        wrapper.insertBefore(this.pngCanvas, wrapper.firstChild);
        this.pngCanvas.className = 'annotation-render-canvas';

        // Sync drawing area with canvas after rendering
        setTimeout(() => this.syncDrawingAreaWithCanvas(), 0);

        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Sync drawing area position and size with the displayed canvas
     */
    syncDrawingAreaWithCanvas() {
        const drawingArea = document.getElementById('annotationDrawingArea');
        const canvasRect = this.pngCanvas.getBoundingClientRect();
        const wrapperRect = drawingArea.parentElement.getBoundingClientRect();

        // Position drawing area exactly over the canvas
        drawingArea.style.left = (canvasRect.left - wrapperRect.left) + 'px';
        drawingArea.style.top = (canvasRect.top - wrapperRect.top) + 'px';
        drawingArea.style.width = canvasRect.width + 'px';
        drawingArea.style.height = canvasRect.height + 'px';

        console.log('📐 [Annotation Drawing Area Sync]', {
            canvas: { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height },
            wrapper: { left: wrapperRect.left, top: wrapperRect.top },
            drawingArea: { left: drawingArea.style.left, top: drawingArea.style.top, width: drawingArea.style.width, height: drawingArea.style.height }
        });
    }

    /**
     * Setup event handlers for drawing, resizing, and validation
     */
    setupEventHandlers() {
        const drawingArea = document.getElementById('annotationDrawingArea');
        const validateBtn = document.getElementById('annotationOverlayValidate');
        const cancelBtn = document.getElementById('annotationOverlayCancel');
        const closeBtn = document.getElementById('annotationOverlayClose');
        const selectAllBtn = document.getElementById('annotationSelectAll');
        const selectNoneBtn = document.getElementById('annotationSelectNone');
        const pageCheckboxes = document.querySelectorAll('.annotation-page-checkbox');

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
                console.log('🔄 Window resized - re-syncing annotation drawing area');
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
        const countSpan = document.getElementById('annotationSelectedCount');
        const insertCountSpan = document.getElementById('annotationInsertCount');
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
        const drawingArea = document.getElementById('annotationDrawingArea');
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
        this.drawingBox = { x, y, width: 0, height: 0 };
        this.isDragging = false;
        this.isResizing = false;
        this.dragStart = { x, y };
    }

    /**
     * Handle mouse move - update drawing/dragging/resizing
     */
    handleMouseMove(e) {
        if (!this.dragStart) return;

        const drawingArea = document.getElementById('annotationDrawingArea');
        const rect = drawingArea.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isDragging) {
            // Move the box
            const dx = x - this.dragStart.x;
            const dy = y - this.dragStart.y;

            this.drawingBox.x = Math.max(0, Math.min(rect.width - this.drawingBox.width, this.dragStart.originalBox.x + dx));
            this.drawingBox.y = Math.max(0, Math.min(rect.height - this.drawingBox.height, this.dragStart.originalBox.y + dy));
        } else if (this.isResizing) {
            // Resize the box
            const dx = x - this.dragStart.x;
            const dy = y - this.dragStart.y;
            const originalBox = this.dragStart.originalBox;

            if (this.resizeHandle.includes('n')) {
                this.drawingBox.y = Math.max(0, originalBox.y + dy);
                this.drawingBox.height = originalBox.height - (this.drawingBox.y - originalBox.y);
            }
            if (this.resizeHandle.includes('s')) {
                this.drawingBox.height = Math.max(10, originalBox.height + dy);
            }
            if (this.resizeHandle.includes('w')) {
                this.drawingBox.x = Math.max(0, originalBox.x + dx);
                this.drawingBox.width = originalBox.width - (this.drawingBox.x - originalBox.x);
            }
            if (this.resizeHandle.includes('e')) {
                this.drawingBox.width = Math.max(10, originalBox.width + dx);
            }
        } else {
            // Drawing new box
            const width = x - this.dragStart.x;
            const height = y - this.dragStart.y;

            this.drawingBox.x = width < 0 ? x : this.dragStart.x;
            this.drawingBox.y = height < 0 ? y : this.dragStart.y;
            this.drawingBox.width = Math.abs(width);
            this.drawingBox.height = Math.abs(height);
        }

        this.renderDrawing();
    }

    /**
     * Handle mouse up - finish drawing/dragging/resizing
     */
    handleMouseUp(e) {
        if (this.drawingBox && this.drawingBox.width > 5 && this.drawingBox.height > 5) {
            // Valid box drawn
            this.hideInstruction();
            document.getElementById('annotationOverlayValidate').disabled = false;
        }

        this.isDragging = false;
        this.isResizing = false;
        this.dragStart = null;
        this.resizeHandle = null;
    }

    /**
     * Render the drawing box
     */
    renderDrawing() {
        const drawingArea = document.getElementById('annotationDrawingArea');

        // Clear previous drawing
        const existingBox = drawingArea.querySelector('.annotation-drawing-box');
        if (existingBox) {
            existingBox.remove();
        }

        if (!this.drawingBox) return;

        // Create box element
        const boxEl = document.createElement('div');
        boxEl.className = 'annotation-drawing-box';
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

        // Show preview of the text inside the box
        if (this.annotationData && this.annotationData.text) {
            const preview = document.createElement('div');
            preview.className = 'annotation-box-preview-text';
            preview.style.fontSize = this.annotationData.fontSize + 'px';
            preview.style.color = this.annotationData.color;
            preview.textContent = this.annotationData.text;
            boxEl.appendChild(preview);
        }

        drawingArea.appendChild(boxEl);
    }

    /**
     * Show instruction message
     */
    showInstruction() {
        const instruction = document.getElementById('annotationInstruction');
        if (instruction) {
            instruction.style.display = 'flex';
        }
    }

    /**
     * Hide instruction message
     */
    hideInstruction() {
        const instruction = document.getElementById('annotationInstruction');
        if (instruction) {
            instruction.style.display = 'none';
        }
    }

    /**
     * Validate and perform the insertion
     */
    async validateInsertion() {
        if (!this.drawingBox || !this.annotationData) {
            showNotification('No box drawn or no annotation data', 'error');
            return;
        }

        if (this.selectedPages.size === 0) {
            showNotification('Please select at least one page', 'error');
            return;
        }

        console.log('📝 [Annotation Overlay] Validating batch insertion on', this.selectedPages.size, 'page(s)...');

        // Show loading notification
        showNotification(`Processing annotation on ${this.selectedPages.size} page(s)...`, 'info', 30000);

        try {
            const selectedPageArray = Array.from(this.selectedPages).sort((a, b) => a - b);
            let successCount = 0;
            let failCount = 0;

            // OPTIMIZATION: Load PDF once with pdf-lib
            console.log('📄 [Batch Optimization] Loading PDF once for all annotation insertions...');
            const pdfDoc = await PDFLib.PDFDocument.load(currentPDFData);

            // OPTIMIZATION: Pre-render text images for each unique rotation (0°, 90°, 180°, 270°)
            // This avoids re-rendering the same text image multiple times
            console.log('🖼️ [Annotation] Pre-rendering text images for each rotation...');
            const textImagesByRotation = new Map(); // rotation -> embeddedImage

            // Insert on each selected page
            for (const pageNum of selectedPageArray) {
                try {
                    // Store current page to calculate correct transformation
                    const originalPageNum = this.pageNumber;
                    this.pageNumber = pageNum;

                    // Get page for rotation info (from PDF.js)
                    const pdfJsPage = await viewer.pdfDoc.getPage(pageNum);
                    this.pageRotation = pdfJsPage.rotate || 0;

                    console.log(`📄 [Annotation] Page ${pageNum}: rotation = ${this.pageRotation}°`);

                    // Create and embed text image for this rotation if not already done
                    if (!textImagesByRotation.has(this.pageRotation)) {
                        console.log(`🖼️ [Annotation] Creating text image for rotation ${this.pageRotation}°...`);
                        const textImageData = await this.renderTextAsImage(
                            this.annotationData.text,
                            this.annotationData.fontSize,
                            this.annotationData.color,
                            this.pageRotation
                        );
                        const embeddedImage = await pdfDoc.embedPng(textImageData);
                        textImagesByRotation.set(this.pageRotation, embeddedImage);
                        console.log(`✅ [Annotation] Text image for ${this.pageRotation}° cached: ${textImageData.byteLength} bytes`);
                    }

                    const embeddedTextImage = textImagesByRotation.get(this.pageRotation);

                    // Calculate transformation from PNG coordinates to PDF coordinates
                    const pdfCoords = await this.transformCoordinates(this.drawingBox);

                    console.log(`📐 [Annotation Overlay] Page ${pageNum} transformation:`, {
                        png: this.drawingBox,
                        pdf: pdfCoords,
                        rotation: this.pageRotation
                    });

                    // OPTIMIZATION: Insert directly on the pdf-lib page (no reload per page)
                    const pageIndex = pageNum - 1;
                    const page = pdfDoc.getPage(pageIndex);

                    // Insert text as image for perfect WYSIWYG (no rotation issues)
                    page.drawImage(embeddedTextImage, {
                        x: pdfCoords.x,
                        y: pdfCoords.y,
                        width: pdfCoords.width,
                        height: pdfCoords.height
                    });

                    console.log(`📝 [Annotation] Page ${pageNum}: Text image inserted at (${pdfCoords.x.toFixed(1)}, ${pdfCoords.y.toFixed(1)})`);

                    successCount++;

                    // Restore original page number
                    this.pageNumber = originalPageNum;
                } catch (pageError) {
                    console.error(`❌ [Annotation Overlay] Failed on page ${pageNum}:`, pageError);
                    failCount++;
                }
            }

            // OPTIMIZATION: Save PDF once after all insertions
            console.log('💾 [Batch Optimization] Saving PDF once after all annotations...');
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
            const thumbnailsWereOpen = viewer.navPanelOpen;
            await viewer.loadPDF(currentPDFData.slice(0));
            await viewer.goToPage(selectedPageArray[0]); // Go to first modified page

            // SMART THUMBNAIL UPDATE: Regenerate all thumbnails if panel was open
            // (loadPDF clears thumbnails, so we need to regenerate them)
            if (thumbnailsWereOpen) {
                console.log('🔄 [Thumbnail Update] Regenerating thumbnails after reload...');
                await viewer.generateThumbnails(false);
                console.log('✅ [Thumbnail Update] Thumbnails regenerated');
            }

            // Add to history
            addEditToHistory(`Inserted annotation on ${successCount} page(s)`);

            // Update metadata
            updateMetadataDisplay();

            // Close overlay
            this.close();

            // Show result
            if (failCount === 0) {
                showNotification(`Annotation inserted successfully on ${successCount} page(s)!`, 'success');
            } else {
                showNotification(`Inserted on ${successCount} page(s), failed on ${failCount} page(s)`, 'warning');
            }
        } catch (error) {
            console.error('❌ [Annotation Overlay] Batch insertion failed:', error);
            showNotification('Failed to insert annotation: ' + error.message, 'error');
        }
    }

    /**
     * Transform PNG coordinates to PDF coordinates
     * @param {Object} boxOnScreen - { x, y, width, height } in screen pixels (CSS)
     * @returns {Object} - { x, y, width, height } in PDF points
     */
    async transformCoordinates(boxOnScreen) {
        console.log('=== v2.3.14 ANNOTATION VIEWPORT-BASED ALGORITHM ===');
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
     * Insert annotation into PDF using pdf-lib
     */
    async insertAnnotationIntoPDF(pageIndex, coords) {
        console.log('📝 [Annotation Overlay] Inserting annotation on page', pageIndex + 1);

        // Load the PDF
        const pdfDoc = await PDFLib.PDFDocument.load(currentPDFData);
        const page = pdfDoc.getPage(pageIndex);

        // Parse color
        const [r, g, b] = this.annotationData.colorRGB;

        // Draw text
        page.drawText(this.annotationData.text, {
            x: coords.x,
            y: coords.y,
            size: this.annotationData.fontSize,
            color: PDFLib.rgb(r, g, b),
            maxWidth: coords.width
        });

        // Save the PDF
        const pdfBytes = await pdfDoc.save();
        currentPDFData = pdfBytes.buffer;

        // Reload the PDF in the viewer
        await viewer.loadPDF(currentPDFData.slice(0));
        updateMetadataDisplay();
    }

    /**
     * Render text as PNG image for perfect WYSIWYG (no rotation issues)
     * @param {string} text - The text to render
     * @param {number} fontSize - Font size in points
     * @param {string} color - Text color (e.g., '#000000')
     * @param {number} pageRotation - Page rotation in degrees (0, 90, 180, 270)
     * @returns {Promise<ArrayBuffer>} PNG image data
     */
    async renderTextAsImage(text, fontSize, color, pageRotation = 0) {
        console.log(`🖼️ [Text2Image] Rendering text: "${text}", size: ${fontSize}px, color: ${color}, rotation: ${pageRotation}°`);

        // HIGH-RES: Use 3x scale for crisp rendering in PDF
        const SCALE = 3;

        // Create offscreen canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set font to measure text (before rotation, at 1x scale)
        ctx.font = `${fontSize}px Arial`;
        const metrics = ctx.measureText(text);

        // Calculate canvas dimensions with padding (at 1x scale)
        const padding = Math.ceil(fontSize * 0.2);
        const textWidth = Math.ceil(metrics.width + padding * 2);
        const textHeight = Math.ceil(fontSize * 1.5 + padding * 2);

        // Adjust canvas size based on rotation
        // For 90° or 270°, swap width and height
        let canvasWidth, canvasHeight;
        if (pageRotation === 90 || pageRotation === 270) {
            canvasWidth = textHeight;
            canvasHeight = textWidth;
        } else {
            canvasWidth = textWidth;
            canvasHeight = textHeight;
        }

        // HIGH-RES: Set canvas to 3x size for crisp rendering
        canvas.width = canvasWidth * SCALE;
        canvas.height = canvasHeight * SCALE;

        console.log(`📐 [Text2Image] Canvas size: ${canvas.width}x${canvas.height}px (${SCALE}x scale, logical: ${canvasWidth}x${canvasHeight})`);

        // HIGH-RES: Scale the context
        ctx.scale(SCALE, SCALE);

        // Fill transparent background
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Apply rotation transformation
        ctx.save();

        if (pageRotation === 90) {
            // Rotate 90° clockwise: move to bottom-left, rotate
            ctx.translate(0, canvasHeight);
            ctx.rotate(-Math.PI / 2);
        } else if (pageRotation === 180) {
            // Rotate 180°: move to bottom-right, rotate
            ctx.translate(canvasWidth, canvasHeight);
            ctx.rotate(Math.PI);
        } else if (pageRotation === 270) {
            // Rotate 270° clockwise (90° counter-clockwise): move to top-right, rotate
            ctx.translate(canvasWidth, 0);
            ctx.rotate(Math.PI / 2);
        }
        // For 0°, no transformation needed

        // Set text rendering properties (with high-quality rendering)
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw text at origin (transformations applied)
        ctx.fillText(text, padding, padding);

        ctx.restore();

        // Convert canvas to PNG blob
        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });

        // Convert blob to ArrayBuffer
        const arrayBuffer = await blob.arrayBuffer();

        console.log(`✅ [Text2Image] PNG created: ${arrayBuffer.byteLength} bytes`);

        return arrayBuffer;
    }

    /**
     * Close the overlay
     */
    close() {
        if (this.overlayContainer) {
            this.overlayContainer.remove();
            this.overlayContainer = null;
        }
        this.active = false;
        this.drawingBox = null;
        this.selectedPages.clear();
        console.log('📝 [Annotation Overlay] Closed');
    }
}

// Create global instance
window.annotationInsertionOverlay = new AnnotationInsertionOverlay();
