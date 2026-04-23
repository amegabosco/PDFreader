/**
 * Pending Objects Manager
 * Manages objects waiting to be inserted into PDF
 */
class PendingObjectsManager {
    constructor() {
        this.objects = [];
        this.nextId = 1;
        this.overlay = null;
        this.drawingState = null;
    }

    initialize() {
        this.overlay = document.getElementById('insertionOverlay');
        this.setupValidateButtons();
        this.syncOverlayWithCanvas();

        // Sync overlay when window resizes or canvas changes
        window.addEventListener('resize', () => this.syncOverlayWithCanvas());
    }

    syncOverlayWithCanvas() {
        const container = document.querySelector('.pdf-canvas-container');
        if (!container) return;

        // In scroll mode, overlay covers the entire container to allow drawing on all pages
        if (viewer.viewMode === 'scroll') {
            this.overlay.style.left = '0';
            this.overlay.style.top = '0';
            this.overlay.style.width = '100%';
            this.overlay.style.height = '100%';
            this.overlay.style.position = 'absolute';
        } else {
            // Single page mode (legacy)
            const canvas = document.getElementById('pdfCanvas');
            if (!canvas) return;

            const canvasRect = canvas.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            this.overlay.style.left = (canvasRect.left - containerRect.left) + 'px';
            this.overlay.style.top = (canvasRect.top - containerRect.top) + 'px';
            this.overlay.style.width = canvas.offsetWidth + 'px';
            this.overlay.style.height = canvas.offsetHeight + 'px';
            this.overlay.style.position = 'absolute';
        }
    }

    setupValidateButtons() {
        document.getElementById('validateAllBtn').addEventListener('click', () => this.validateAll());
        document.getElementById('cancelAllBtn').addEventListener('click', () => this.cancelAll());
    }

    addObject(type, page, bounds, data) {
        const id = `obj-${this.nextId++}`;
        const obj = {
            id,
            type, // 'image', 'text', 'signature'
            page,
            bounds, // { x, y, width, height }
            data, // type-specific data
            element: null
        };

        this.objects.push(obj);
        this.renderObject(obj);
        this.updateUI();
        return obj;
    }

    renderObject(obj) {
        const element = document.createElement('div');
        element.className = `pending-object pending-${obj.type}`;
        element.dataset.id = obj.id;
        element.style.left = obj.bounds.x + 'px';
        element.style.top = obj.bounds.y + 'px';
        element.style.width = obj.bounds.width + 'px';
        element.style.height = obj.bounds.height + 'px';

        // Add content based on type
        if (obj.type === 'image') {
            const img = document.createElement('img');
            img.src = obj.data.imageUrl;
            element.appendChild(img);
        } else if (obj.type === 'text') {
            const textarea = document.createElement('textarea');
            textarea.className = 'text-content';
            textarea.value = obj.data.text || '';
            textarea.style.fontSize = obj.data.fontSize + 'px';
            textarea.style.color = obj.data.color;
            textarea.addEventListener('input', (e) => {
                obj.data.text = e.target.value;
            });
            element.appendChild(textarea);
        } else if (obj.type === 'signature') {
            const img = document.createElement('img');
            img.src = obj.data.signatureUrl;
            element.appendChild(img);
        }

        // Add resize handles
        ['nw', 'ne', 'sw', 'se'].forEach(corner => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${corner}`;
            handle.dataset.corner = corner;
            element.appendChild(handle);
        });

        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="ti ti-x"></i>';
        deleteBtn.onclick = () => this.removeObject(obj.id);
        element.appendChild(deleteBtn);

        // Add interaction handlers
        this.setupObjectInteraction(element, obj);

        obj.element = element;
        this.overlay.appendChild(element);
    }

    setupObjectInteraction(element, obj) {
        let isDragging = false;
        let isResizing = false;
        let startPos = { x: 0, y: 0 };
        let startBounds = null;
        let resizeCorner = null;

        element.addEventListener('mousedown', (e) => {
            // Always save initial bounds and position
            startBounds = { ...obj.bounds };
            startPos = { x: e.clientX, y: e.clientY };

            if (e.target.classList.contains('resize-handle')) {
                isResizing = true;
                resizeCorner = e.target.dataset.corner;
            } else if (!e.target.classList.contains('text-content') && !e.target.classList.contains('delete-btn')) {
                isDragging = true;
                element.style.cursor = 'move';
            }

            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging && !isResizing) return;

            const deltaX = e.clientX - startPos.x;
            const deltaY = e.clientY - startPos.y;

            if (isDragging) {
                // Calculate new position from start bounds
                obj.bounds.x = Math.max(0, startBounds.x + deltaX);
                obj.bounds.y = Math.max(0, startBounds.y + deltaY);

                element.style.left = obj.bounds.x + 'px';
                element.style.top = obj.bounds.y + 'px';
            } else if (isResizing) {
                this.resizeObject(obj, element, resizeCorner, deltaX, deltaY, startBounds);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                element.style.cursor = '';
            }
            isDragging = false;
            isResizing = false;
            startBounds = null;
        });
    }

    resizeObject(obj, element, corner, deltaX, deltaY, startBounds) {
        const minSize = 20;

        switch (corner) {
            case 'se': // Bottom-right
                obj.bounds.width = Math.max(minSize, startBounds.width + deltaX);
                obj.bounds.height = Math.max(minSize, startBounds.height + deltaY);
                break;
            case 'sw': // Bottom-left
                obj.bounds.x = Math.max(0, startBounds.x + deltaX);
                obj.bounds.width = Math.max(minSize, startBounds.width - deltaX);
                obj.bounds.height = Math.max(minSize, startBounds.height + deltaY);
                break;
            case 'ne': // Top-right
                obj.bounds.y = Math.max(0, startBounds.y + deltaY);
                obj.bounds.width = Math.max(minSize, startBounds.width + deltaX);
                obj.bounds.height = Math.max(minSize, startBounds.height - deltaY);
                break;
            case 'nw': // Top-left
                obj.bounds.x = Math.max(0, startBounds.x + deltaX);
                obj.bounds.y = Math.max(0, startBounds.y + deltaY);
                obj.bounds.width = Math.max(minSize, startBounds.width - deltaX);
                obj.bounds.height = Math.max(minSize, startBounds.height - deltaY);
                break;
        }

        element.style.left = obj.bounds.x + 'px';
        element.style.top = obj.bounds.y + 'px';
        element.style.width = obj.bounds.width + 'px';
        element.style.height = obj.bounds.height + 'px';
    }

    removeObject(id) {
        const index = this.objects.findIndex(obj => obj.id === id);
        if (index === -1) return;

        const obj = this.objects[index];
        if (obj.element) {
            obj.element.remove();
        }

        this.objects.splice(index, 1);
        this.updateUI();
    }

    clear() {
        this.objects.forEach(obj => {
            if (obj.element) obj.element.remove();
        });
        this.objects = [];
        this.updateUI();
    }

    updateUI() {
        const container = document.getElementById('validateAllContainer');
        const countText = document.getElementById('validateAllText');

        if (this.objects.length > 0) {
            container.style.display = 'flex';
            countText.textContent = `Validate All (${this.objects.length})`;
            this.overlay.classList.add('active');
        } else {
            container.style.display = 'none';
            this.overlay.classList.remove('active');
        }
    }

    async validateAll() {
        if (this.objects.length === 0) return;

        try {
            const currentPage = viewer.currentPage;
            const objectCount = this.objects.length;

            // Save state BEFORE making any changes (for undo/redo)
            saveStateForUndo();

            // Prepare batch data for worker
            const batchObjects = [];

            for (const obj of this.objects) {
                const pageIndex = obj.page - 1;

                // Convert overlay coordinates to PDF coordinates
                const pdfBounds = await this.convertOverlayToPDFCoordinates(obj.bounds, pageIndex);

                const batchObj = {
                    type: obj.type,
                    pageIndex: pageIndex,
                    x: pdfBounds.x,
                    y: pdfBounds.y,
                    width: pdfBounds.width,
                    height: pdfBounds.height
                };

                if (obj.type === 'image') {
                    batchObj.imageData = obj.data.imageData;
                    batchObj.imageType = obj.data.imageType;
                    batchObj.rotation = 0;
                    batchObj.opacity = 1;
                } else if (obj.type === 'text') {
                    batchObj.text = obj.data.text;
                    batchObj.fontSize = obj.data.fontSize;
                    batchObj.color = obj.data.colorRGB; // {r, g, b} or [r, g, b]
                } else if (obj.type === 'signature') {
                    batchObj.imageData = obj.data.signatureData;
                    batchObj.imageType = 'png';
                    batchObj.rotation = 0;
                    batchObj.opacity = 1;
                }

                batchObjects.push(batchObj);
            }

            // Execute batch insertion in worker
            const modifiedPDF = await workerManager.execute('insertObjects', {
                pdfData: currentPDFData.slice(0),
                objects: batchObjects
            });

            // Update current PDF data
            const newArray = new Uint8Array(modifiedPDF);
            currentPDFData = newArray.buffer;

            // Clear pending objects
            this.clear();

            // Refresh the view
            await viewer.loadPDF(currentPDFData.slice(0));

            // Restore page position in scroll view
            await viewer.goToPage(currentPage);

            // Regenerate thumbnails after insertion
            if (viewer.navPanelOpen) {
                await viewer.generateThumbnails(true);
            }

            // Update cache if document is cached
            if (currentCacheId && currentPDFData) {
                await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
            }

            // Update document in tabs
            const activeDoc = getActiveDocument();
            if (activeDoc) {
                activeDoc.pdfData = currentPDFData.slice(0);
            }

            // Add to history WITHOUT calling saveStateForUndo again
            const timestamp = new Date().toLocaleTimeString();
            editHistory.push(`Inserted ${objectCount} object(s) (${timestamp})`);
            updateMetadataDisplay();
            updateUndoRedoButtons();

            // Close the tool panel after successful insertion
            closeToolPanel();

            showNotification(`Successfully inserted ${objectCount} object(s)!`, 'success');
        } catch (error) {
            console.error('Failed to validate objects:', error);
            showNotification('Failed to insert objects: ' + error.message, 'error');
        }
    }

    async convertOverlayToPDFCoordinates(overlayBounds, pageIndex) {
        // Get the appropriate canvas based on view mode
        let canvas;
        if (viewer.viewMode === 'scroll' && viewer.allPageCanvases[pageIndex]) {
            canvas = viewer.allPageCanvases[pageIndex];
        } else {
            canvas = document.getElementById('pdfCanvas');
        }

        if (!canvas) {
            console.error('Canvas not found for page', pageIndex);
            return overlayBounds;
        }

        // Get PDF page dimensions using PDF-lib
        const pdfDoc = await PDFLib.PDFDocument.load(currentPDFData);
        const page = pdfDoc.getPage(pageIndex);
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        // Calculate scale factors from display pixels to PDF points
        const scaleX = pageWidth / canvas.offsetWidth;
        const scaleY = pageHeight / canvas.offsetHeight;

        // Convert coordinates from display pixels to PDF points
        return {
            x: overlayBounds.x * scaleX,
            y: overlayBounds.y * scaleY,
            width: overlayBounds.width * scaleX,
            height: overlayBounds.height * scaleY
        };
    }

    cancelAll() {
        if (this.objects.length === 0) return;
        if (confirm(`Cancel all ${this.objects.length} pending object(s)?`)) {
            this.clear();
        }
    }

    // Draw box interaction
    startDrawing(type, data) {
        // In scroll mode, we work with the scroll view directly
        // No need to switch view modes anymore

        // Sync overlay with canvas before starting
        this.syncOverlayWithCanvas();

        this.drawingState = {
            type,
            data,
            startX: 0,
            startY: 0,
            element: null
        };

        this.overlay.style.cursor = 'crosshair';
        this.overlay.classList.add('active');

        // Drawing mode is now active
    }

    handleDrawMouseDown(e) {
        if (!this.drawingState) {
            console.warn('⚠️ No drawing state, ignoring mousedown');
            return;
        }

        const rect = this.overlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.drawingState.startX = x;
        this.drawingState.startY = y;

        // Create drawing element
        const element = document.createElement('div');
        element.className = 'pending-object drawing';
        element.style.left = x + 'px';
        element.style.top = y + 'px';
        element.style.width = '0px';
        element.style.height = '0px';

        this.drawingState.element = element;
        this.overlay.appendChild(element);
    }

    handleDrawMouseMove(e) {
        if (!this.drawingState || !this.drawingState.element) return;

        const rect = this.overlay.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = Math.abs(currentX - this.drawingState.startX);
        const height = Math.abs(currentY - this.drawingState.startY);
        const left = Math.min(currentX, this.drawingState.startX);
        const top = Math.min(currentY, this.drawingState.startY);

        this.drawingState.element.style.left = left + 'px';
        this.drawingState.element.style.top = top + 'px';
        this.drawingState.element.style.width = width + 'px';
        this.drawingState.element.style.height = height + 'px';
    }

    handleDrawMouseUp(e) {
        if (!this.drawingState || !this.drawingState.element) return;

        const rect = this.overlay.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = Math.abs(currentX - this.drawingState.startX);
        const height = Math.abs(currentY - this.drawingState.startY);

        // Minimum size check
        if (width < 20 || height < 20) {
            this.drawingState.element.remove();
            this.drawingState = null;
            this.overlay.style.cursor = '';
            return;
        }

        const left = Math.min(currentX, this.drawingState.startX);
        const top = Math.min(currentY, this.drawingState.startY);

        const bounds = { x: left, y: top, width, height };

        // Determine which page was clicked (in scroll mode)
        let targetPage = viewer.currentPage;
        if (viewer.viewMode === 'scroll' && viewer.allPageCanvases.length > 0) {
            // Find which page canvas contains these coordinates
            const container = document.querySelector('.pdf-canvas-container');
            const containerRect = container.getBoundingClientRect();
            const absoluteX = e.clientX;
            const absoluteY = e.clientY;

            for (let i = 0; i < viewer.allPageCanvases.length; i++) {
                const canvas = viewer.allPageCanvases[i];
                const canvasRect = canvas.getBoundingClientRect();

                if (absoluteY >= canvasRect.top && absoluteY <= canvasRect.bottom) {
                    targetPage = i + 1;

                    // Adjust bounds to be relative to this specific canvas
                    // Convert from overlay coordinates to canvas-relative coordinates
                    const overlayRect = this.overlay.getBoundingClientRect();
                    bounds.x = left - (canvasRect.left - overlayRect.left);
                    bounds.y = top - (canvasRect.top - overlayRect.top);

                    break;
                }
            }
        }

        // Remove drawing element
        this.drawingState.element.remove();

        // Add actual object
        this.addObject(
            this.drawingState.type,
            targetPage,
            bounds,
            this.drawingState.data
        );

        this.drawingState = null;
        this.overlay.style.cursor = '';
        // DON'T remove active class - keep overlay active for potential additional objects
        // The active class will be removed when validateAll() or cancelAll() is called
        // this.overlay.classList.remove('active');
    }
}
