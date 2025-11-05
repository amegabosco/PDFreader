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

            // Calculate scale to match current zoom/viewport
            const viewport = page.getViewport({ scale: viewer.scale });

            // Create a canvas to render the page
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            this.pngCanvas = canvas;

            console.log(`✅ [PNG Overlay] PNG generated: ${canvas.width}x${canvas.height}`);
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
                    <div class="png-canvas-wrapper" id="pngCanvasWrapper">
                        <!-- PNG will be inserted here -->
                        <div class="png-drawing-area" id="pngDrawingArea"></div>
                    </div>
                    <div class="png-overlay-instruction" id="pngInstruction">
                        <i class="ti ti-pointer"></i>
                        <p>Click and drag to draw a box where you want to insert the ${this.insertionType}</p>
                    </div>
                </div>
                <div class="png-overlay-footer">
                    <button class="png-overlay-btn cancel" id="pngOverlayCancel">
                        <i class="ti ti-x"></i> Cancel
                    </button>
                    <button class="png-overlay-btn validate" id="pngOverlayValidate" disabled>
                        <i class="ti ti-check"></i> Insert
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

        console.log('🎯 [PNG Overlay] Validating insertion...');

        try {
            // Calculate transformation from PNG coordinates to PDF coordinates
            const pdfCoords = await this.transformCoordinates(this.drawingBox);

            console.log('📐 [PNG Overlay] Transformation:', {
                png: this.drawingBox,
                pdf: pdfCoords,
                pngSize: { width: this.pngCanvas.width, height: this.pngCanvas.height }
            });

            // Perform the actual insertion using pdfTools
            const pageIndex = this.pageNumber - 1; // Convert to 0-indexed

            if (this.insertionType === 'image') {
                await this.insertImageIntoPDF(pageIndex, pdfCoords);
            } else if (this.insertionType === 'signature') {
                await this.insertSignatureIntoPDF(pageIndex, pdfCoords);
            }

            // Close overlay
            this.close();

            showNotification(`${this.insertionType === 'image' ? 'Image' : 'Signature'} inserted successfully!`, 'success');
        } catch (error) {
            console.error('❌ [PNG Overlay] Insertion failed:', error);
            showNotification('Failed to insert: ' + error.message, 'error');
        }
    }

    /**
     * Transform PNG coordinates to PDF coordinates - SIMPLIFIED v2.1
     * @param {Object} boxOnScreen - { x, y, width, height } in screen pixels (CSS)
     * @returns {Object} - { x, y, width, height } in PDF points
     */
    async transformCoordinates(boxOnScreen) {
        console.log('🔄 [v2.1 SIMPLIFIED] Starting transformation...');
        console.log('📍 [Input] Box on screen (CSS pixels):', boxOnScreen);

        // Get the actual PDF page dimensions
        const pdfDoc = await PDFLib.PDFDocument.load(currentPDFData);
        const pageIndex = this.pageNumber - 1;
        const page = pdfDoc.getPage(pageIndex);
        const { width: pdfWidth, height: pdfHeight } = page.getSize();

        console.log('📄 [PDF] Original page size:', { width: pdfWidth, height: pdfHeight });

        // Get canvas displayed size (what user sees)
        const displayedWidth = this.pngCanvas.offsetWidth;
        const displayedHeight = this.pngCanvas.offsetHeight;

        console.log('🖥️ [Display] Canvas displayed size:', { width: displayedWidth, height: displayedHeight });

        // Simple ratio: screen pixels → PDF points
        const ratioX = pdfWidth / displayedWidth;
        const ratioY = pdfHeight / displayedHeight;

        console.log('📊 [Ratio] Screen → PDF:', { x: ratioX, y: ratioY });

        // Convert screen coordinates to PDF coordinates
        // X: simple scaling
        const pdfX = boxOnScreen.x * ratioX;
        const pdfWidth_box = boxOnScreen.width * ratioX;

        // Y: flip coordinate system (screen top-left → PDF bottom-left)
        // In screen: y=0 is top, y increases downward
        // In PDF: y=0 is bottom, y increases upward
        const screenTopY = boxOnScreen.y;
        const screenBottomY = boxOnScreen.y + boxOnScreen.height;

        // Convert to PDF coordinates
        const pdfTopY = pdfHeight - (screenTopY * ratioY);
        const pdfBottomY = pdfHeight - (screenBottomY * ratioY);

        // PDF drawImage uses bottom-left corner
        const pdfY = pdfBottomY;
        const pdfHeight_box = boxOnScreen.height * ratioY;

        const result = {
            x: pdfX,
            y: pdfY,
            width: pdfWidth_box,
            height: pdfHeight_box
        };

        console.log('✅ [Output] Final PDF coordinates:', result);
        console.log('📐 [Details]', {
            screen: {
                top: screenTopY,
                bottom: screenBottomY,
                height: boxOnScreen.height
            },
            pdf: {
                top: pdfTopY,
                bottom: pdfBottomY,
                height: pdfHeight_box,
                totalHeight: pdfHeight
            }
        });

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

        // Add to history
        addEditToHistory(`Inserted signature on page ${this.pageNumber}`);
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
