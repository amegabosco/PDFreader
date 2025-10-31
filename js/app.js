/**
 * Main Application
 * Handles file uploads, user interactions, and coordination between modules
 */

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
            if (e.target.classList.contains('resize-handle')) {
                isResizing = true;
                resizeCorner = e.target.dataset.corner;
                startBounds = { ...obj.bounds };
            } else if (!e.target.classList.contains('text-content') && !e.target.classList.contains('delete-btn')) {
                isDragging = true;
            }

            startPos = { x: e.clientX, y: e.clientY };
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging && !isResizing) return;

            const deltaX = e.clientX - startPos.x;
            const deltaY = e.clientY - startPos.y;

            if (isDragging) {
                obj.bounds.x = Math.max(0, startBounds ? startBounds.x + deltaX : obj.bounds.x + deltaX);
                obj.bounds.y = Math.max(0, startBounds ? startBounds.y + deltaY : obj.bounds.y + deltaY);

                if (!startBounds) startBounds = { ...obj.bounds };

                element.style.left = obj.bounds.x + 'px';
                element.style.top = obj.bounds.y + 'px';
            } else if (isResizing) {
                this.resizeObject(obj, element, resizeCorner, deltaX, deltaY, startBounds);
            }
        });

        document.addEventListener('mouseup', () => {
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

            // Insert all objects into PDF sequentially
            for (const obj of this.objects) {
                await this.insertObject(obj);
            }

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

    async insertObject(obj) {
        const pageIndex = obj.page - 1;
        const pdfCopy = currentPDFData.slice(0);

        // Convert overlay coordinates to PDF coordinates
        const pdfBounds = await this.convertOverlayToPDFCoordinates(obj.bounds, pageIndex);

        console.log(`Inserting ${obj.type} on page ${obj.page}`);
        console.log('Overlay bounds:', obj.bounds);
        console.log('PDF bounds:', pdfBounds);

        if (obj.type === 'image') {
            const modifiedPDF = await tools.insertImage(
                pdfCopy,
                obj.data.imageData,
                obj.data.imageType,
                pageIndex,
                pdfBounds
            );
            const newArray = new Uint8Array(modifiedPDF);
            currentPDFData = newArray.buffer;
            console.log(`Image inserted, new PDF size: ${currentPDFData.byteLength} bytes`);
        } else if (obj.type === 'text') {
            const modifiedPDF = await tools.addTextAnnotation(
                pdfCopy,
                pageIndex,
                obj.data.text,
                {
                    x: pdfBounds.x,
                    y: pdfBounds.y,
                    size: obj.data.fontSize,
                    color: obj.data.colorRGB
                }
            );
            const newArray = new Uint8Array(modifiedPDF);
            currentPDFData = newArray.buffer;
            console.log(`Text inserted, new PDF size: ${currentPDFData.byteLength} bytes`);
        } else if (obj.type === 'signature') {
            const modifiedPDF = await tools.insertImage(
                pdfCopy,
                obj.data.signatureData,
                'png',
                pageIndex,
                pdfBounds
            );
            const newArray = new Uint8Array(modifiedPDF);
            currentPDFData = newArray.buffer;
            console.log(`Signature inserted, new PDF size: ${currentPDFData.byteLength} bytes`);
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

        console.log('Conversion debug:');
        console.log('  Page index:', pageIndex);
        console.log('  Overlay bounds:', overlayBounds);
        console.log('  Canvas display size:', canvas.offsetWidth, 'x', canvas.offsetHeight);
        console.log('  PDF page size:', pageWidth, 'x', pageHeight);
        console.log('  Scale factors:', scaleX, scaleY);

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

        // Show a message to guide the user
        console.log('Drawing mode active. Draw a box on the PDF to place your', type);
    }

    handleDrawMouseDown(e) {
        if (!this.drawingState) return;

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
            const absoluteY = e.clientY;

            for (let i = 0; i < viewer.allPageCanvases.length; i++) {
                const canvas = viewer.allPageCanvases[i];
                const canvasRect = canvas.getBoundingClientRect();

                if (absoluteY >= canvasRect.top && absoluteY <= canvasRect.bottom) {
                    targetPage = i + 1;
                    // Adjust bounds to be relative to this specific canvas
                    bounds.y = top - (canvasRect.top - containerRect.top) + container.scrollTop;
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
        this.overlay.classList.remove('active');
    }
}

// Initialize modules
const viewer = new PDFViewer();
const tools = new PDFTools();
const pendingObjects = new PendingObjectsManager();

// Multi-document state
let documents = []; // Array of open documents
let activeDocumentId = null; // Currently active document ID
let nextDocumentId = 1; // Auto-increment ID

// Legacy state (for backward compatibility)
let currentPDFData = null;
let currentFileName = '';
let currentCacheId = null; // ID of the current PDF in cache (for auto-save)
let allUploadedFiles = []; // Store all uploaded files for merge
let editHistory = []; // Track all edits made
let originalFileSize = 0; // Store original file size

// Undo/Redo system
let undoStack = []; // Stack of previous states
let redoStack = []; // Stack of undone states
const MAX_UNDO_STACK = 20; // Maximum number of undo states

// Search system
let searchMatches = []; // All search results
let currentMatchIndex = -1; // Index of current match
let searchQuery = ''; // Current search query

/**
 * Show notification banner
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showNotification(message, type = 'info', duration = 3000) {
    const banner = document.getElementById('notificationBanner');

    // Set icon based on type
    const icons = {
        success: 'ti-check',
        error: 'ti-alert-circle',
        warning: 'ti-alert-triangle',
        info: 'ti-info-circle'
    };

    banner.innerHTML = `
        <i class="ti ${icons[type]}"></i>
        <span>${message}</span>
    `;

    // Set type class
    banner.className = `notification-banner ${type}`;

    // Show banner
    setTimeout(() => {
        banner.classList.add('show');
    }, 10);

    // Hide banner after duration
    setTimeout(() => {
        banner.classList.remove('show');
    }, duration);
}

/**
 * Setup info bar toggle functionality
 */
function setupInfoBarToggle() {
    const toggleBtn = document.getElementById('toggleInfoBar');
    const infoBar = document.getElementById('infoBar');

    if (toggleBtn && infoBar) {
        toggleBtn.addEventListener('click', () => {
            if (infoBar.style.display === 'none') {
                infoBar.style.display = 'flex';
                toggleBtn.classList.add('active');
            } else {
                infoBar.style.display = 'none';
                toggleBtn.classList.remove('active');
            }
        });
    }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Ctrl/Cmd + O: Open file
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            document.getElementById('fileInput').click();
            showNotification('Opening file picker...', 'info');
        }

        // Ctrl/Cmd + F: Search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            const searchBar = document.getElementById('searchBar');
            const searchInput = document.getElementById('searchInput');
            searchBar.style.display = 'flex';
            searchInput.focus();
        }

        // Ctrl/Cmd + S: Download/Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (currentPDFData) {
                tools.downloadPDF(new Uint8Array(currentPDFData), currentFileName);
                showNotification('Downloading PDF...', 'success');
            }
        }

        // Ctrl/Cmd + Z: Undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }

        // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redo();
        }

        // Escape: Cancel/Close panels
        if (e.key === 'Escape') {
            const toolPanel = document.getElementById('toolPanel');
            if (toolPanel.style.display !== 'none') {
                closeToolPanel();
            }
            if (pendingObjects.objects.length > 0) {
                pendingObjects.cancelAll();
            }
        }

        // Only if PDF is loaded
        if (!currentPDFData) return;

        // Arrow keys: Navigate pages
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            document.getElementById('prevPage').click();
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            document.getElementById('nextPage').click();
        }

        // +/= : Zoom in
        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            document.getElementById('zoomIn').click();
        }

        // - : Zoom out
        if (e.key === '-') {
            e.preventDefault();
            document.getElementById('zoomOut').click();
        }

        // Space: Scroll down (Shift+Space: scroll up)
        if (e.key === ' ') {
            e.preventDefault();
            const container = document.querySelector('.pdf-canvas-container');
            if (e.shiftKey) {
                container.scrollTop -= container.clientHeight * 0.8;
            } else {
                container.scrollTop += container.clientHeight * 0.8;
            }
        }

        // Home: First page
        if (e.key === 'Home') {
            e.preventDefault();
            viewer.currentPage = 1;
            viewer.renderPage(1);
        }

        // End: Last page
        if (e.key === 'End') {
            e.preventDefault();
            viewer.currentPage = viewer.totalPages;
            viewer.renderPage(viewer.totalPages);
        }

        // 1: Single page view
        if (e.key === '1') {
            e.preventDefault();
            document.getElementById('singlePageView').click();
        }

        // 2: Scroll view
        if (e.key === '2') {
            e.preventDefault();
            document.getElementById('scrollView').click();
        }

        // Ctrl/Cmd + I: Toggle info bar
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            document.getElementById('toggleInfoBar').click();
        }

        // Ctrl/Cmd + N: Toggle navigator
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            document.getElementById('toggleNavPanel').click();
        }
    });

    console.log('Keyboard shortcuts initialized');
}

/**
 * Handle page reordering from drag and drop
 */
window.handlePageReorder = async function(fromPage, toPage) {
    if (!currentPDFData) {
        showNotification('No PDF loaded', 'error');
        return;
    }

    try {
        // Use Web Worker for reordering
        const reorderedPDF = await workerManager.execute('reorder', {
            pdfData: currentPDFData.slice(0),
            fromPage: fromPage,
            toPage: toPage
        });

        // Update current PDF data
        const newArray = new Uint8Array(reorderedPDF);
        currentPDFData = newArray.buffer;

        // Update document in tabs
        const activeDoc = getActiveDocument();
        if (activeDoc) {
            activeDoc.pdfData = currentPDFData.slice(0);
        }

        // Update cache
        if (currentCacheId && currentPDFData) {
            await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
        }

        // Reload PDF and regenerate thumbnails
        await viewer.loadPDF(currentPDFData.slice(0));

        // Force thumbnail regeneration if navigator is open
        if (viewer.navPanelOpen) {
            await viewer.generateThumbnails(true); // Force regeneration with true parameter
        }

        // Navigate to the moved page's new position
        await viewer.goToPage(toPage);

        // Add to history
        addEditToHistory(`Moved page ${fromPage} to position ${toPage}`);

        showNotification(`Page ${fromPage} moved to position ${toPage}`, 'success');
    } catch (error) {
        console.error('Failed to reorder pages:', error);
        showNotification('Failed to reorder pages: ' + error.message, 'error');
    }
};

/**
 * Initialize the application
 */
function init() {
    setupFileUpload();
    setupToolButtons();
    setupTabsSystem();
    setupInfoBarToggle();
    setupKeyboardShortcuts();
    setupSearchHandlers();
    updateMetadataDisplay();

    // Initialize pending objects manager
    pendingObjects.initialize();
    setupDrawingHandlers();

    // Update memory usage periodically
    setInterval(updateMemoryUsage, 2000);

    console.log('PDF Power-Tool initialized');
}

/**
 * Setup drawing handlers for the overlay
 */
function setupDrawingHandlers() {
    const overlay = document.getElementById('insertionOverlay');

    overlay.addEventListener('mousedown', (e) => {
        pendingObjects.handleDrawMouseDown(e);
    });

    overlay.addEventListener('mousemove', (e) => {
        pendingObjects.handleDrawMouseMove(e);
    });

    overlay.addEventListener('mouseup', (e) => {
        pendingObjects.handleDrawMouseUp(e);
    });
}

/**
 * Setup tabs system
 */
function setupTabsSystem() {
    const newTabBtn = document.getElementById('newTabBtn');
    if (newTabBtn) {
        newTabBtn.addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
    }
}

/**
 * Document Manager - Create a new document
 */
function createDocument(pdfData, fileName) {
    const doc = {
        id: nextDocumentId++,
        fileName: fileName,
        pdfData: pdfData,
        originalSize: pdfData.byteLength,
        editHistory: [],
        viewerState: {
            currentPage: 1,
            scale: 1.5
        }
    };

    documents.push(doc);
    return doc;
}

/**
 * Get active document
 */
function getActiveDocument() {
    return documents.find(doc => doc.id === activeDocumentId);
}

/**
 * Switch to a document
 */
async function switchToDocument(docId) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    // Save current document state if there is one
    const currentDoc = getActiveDocument();
    if (currentDoc) {
        currentDoc.pdfData = currentPDFData;
        currentDoc.editHistory = [...editHistory];
        currentDoc.viewerState = {
            currentPage: viewer.currentPage,
            scale: viewer.scale
        };
    }

    // Switch to new document
    activeDocumentId = docId;
    currentPDFData = doc.pdfData;
    currentFileName = doc.fileName;
    currentCacheId = doc.cacheId || null; // Restore cache ID
    editHistory = [...doc.editHistory];
    originalFileSize = doc.originalSize;

    // Load into viewer
    await viewer.loadPDF(currentPDFData.slice(0));

    // Restore viewer scale (but always start at page 1)
    if (doc.viewerState && doc.viewerState.scale !== viewer.scale) {
        viewer.scale = doc.viewerState.scale;
        viewer.updateZoomLevel();
        await viewer.renderScrollView();
    }

    // Always scroll to top (first page) on document load
    const container = document.querySelector('.pdf-canvas-container');
    if (container) {
        container.scrollTop = 0;
    }
    viewer.currentPage = 1;
    const pageInput = document.getElementById('pageInput');
    if (pageInput) {
        pageInput.value = 1;
    }

    // Update UI
    updateTabsUI();
    updateMetadataDisplay();
    enableToolButtons();
}

/**
 * Close a document
 */
function closeDocument(docId) {
    const index = documents.findIndex(d => d.id === docId);
    if (index === -1) return;

    documents.splice(index, 1);

    // If closing active document, switch to another
    if (docId === activeDocumentId) {
        if (documents.length > 0) {
            // Switch to the previous tab or first tab
            const newDoc = documents[Math.max(0, index - 1)];
            switchToDocument(newDoc.id);
        } else {
            // No documents left, reset
            activeDocumentId = null;
            currentPDFData = null;
            currentFileName = '';
            editHistory = [];
            document.getElementById('uploadArea').style.display = 'flex';
            document.getElementById('viewerArea').style.display = 'none';
            updateMetadataDisplay();
        }
    }

    updateTabsUI();
}

/**
 * Update tabs UI
 */
function updateTabsUI() {
    const tabsList = document.getElementById('tabsList');
    if (!tabsList) return;

    tabsList.innerHTML = '';

    documents.forEach(doc => {
        const tab = document.createElement('div');
        tab.className = 'tab' + (doc.id === activeDocumentId ? ' active' : '');
        tab.dataset.docId = doc.id;

        const shortName = doc.fileName.length > 20
            ? doc.fileName.substring(0, 17) + '...'
            : doc.fileName;

        tab.innerHTML = `
            <i class="tab-icon ti ti-file-type-pdf"></i>
            <span class="tab-name" title="${doc.fileName}">${shortName}</span>
            <button class="tab-close" onclick="event.stopPropagation(); closeDocument(${doc.id})">
                <i class="ti ti-x"></i>
            </button>
        `;

        tab.addEventListener('click', () => switchToDocument(doc.id));
        tabsList.appendChild(tab);
    });
}

/**
 * Setup file upload functionality
 */
function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const dropzone = document.querySelector('.upload-dropzone');
    const browseBtn = document.querySelector('.browse-btn');

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Browse button click - prevent event bubbling
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent dropzone click from firing
        fileInput.click();
    });

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    });
}

/**
 * Handle file selection
 */
function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        handleFiles(files);
    }
}

/**
 * Process uploaded files
 * @param {FileList} files - Uploaded files
 */
async function handleFiles(files) {
    try {
        // Store all PDF files for merge functionality
        allUploadedFiles = [];
        tools.clearPDFs();

        let firstNewDoc = null;

        for (let file of files) {
            if (file.type === 'application/pdf') {
                const arrayBuffer = await readFileAsArrayBuffer(file);
                allUploadedFiles.push({ data: arrayBuffer, name: file.name });
                tools.addPDF(arrayBuffer, file.name);

                // Save to cache and store cache ID
                let cacheId = null;
                try {
                    cacheId = await pdfCache.savePDF(file.name, arrayBuffer, file.size);
                    console.log(`Cached: ${file.name} with ID ${cacheId}`);
                } catch (error) {
                    console.error('Failed to cache PDF:', error);
                }

                // Create a new document for each PDF
                const doc = createDocument(arrayBuffer, file.name);
                doc.cacheId = cacheId; // Store cache ID in document
                if (!firstNewDoc) firstNewDoc = doc;
            }
        }

        if (allUploadedFiles.length === 0) {
            showNotification('Please upload at least one PDF file', 'warning');
            return;
        }

        // Show viewer area
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('viewerArea').style.display = 'flex';

        // Switch to the first new document
        if (firstNewDoc) {
            await switchToDocument(firstNewDoc.id);
        }

        // Update recent documents display
        updateRecentDocuments();

        console.log(`Loaded ${allUploadedFiles.length} PDF file(s) as tabs`);
    } catch (error) {
        console.error('Error handling files:', error);
        showNotification('Failed to load file. Please try again.', 'error');
    }
}

/**
 * Read file as ArrayBuffer
 * @param {File} file - File to read
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Setup tool button interactions
 */
function setupToolButtons() {
    const toolButtons = document.querySelectorAll('.tool-btn');

    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tool = button.dataset.tool;
            handleToolClick(tool);
        });
    });
}

/**
 * Enable tool buttons when a PDF is loaded
 */
function enableToolButtons() {
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(button => {
        button.removeAttribute('disabled');
    });
}

/**
 * Handle tool button clicks
 * @param {string} toolName - Name of the tool
 */
async function handleToolClick(toolName) {
    console.log('Tool clicked:', toolName);

    switch (toolName) {
        case 'upload':
            handleUploadNew();
            break;
        case 'merge':
            showMergePanel();
            break;
        case 'split':
            showSplitPanel();
            break;
        case 'rotate':
            showRotatePanel();
            break;
        case 'compress':
            await handleCompress();
            break;
        case 'image':
            showImagePanel();
            break;
        case 'annotate':
            showAnnotatePanel();
            break;
        case 'sign':
            showSignPanel();
            break;
        case 'hand':
            handleHandTool();
            break;
        case 'download':
            if (currentPDFData) {
                tools.downloadPDF(new Uint8Array(currentPDFData), currentFileName);
            }
            break;
    }
}

/**
 * Handle new upload - Just trigger file picker to add new tabs
 */
function handleUploadNew() {
    console.log('Upload button clicked - opening file picker');
    document.getElementById('fileInput').click();
}

/**
 * Show merge panel
 */
function showMergePanel() {
    // Case 1: Current document is open - offer to pick another document to merge with it
    if (currentPDFData) {
        const panel = `
            <button class="close-btn" onclick="closeToolPanel()">
                <i class="ti ti-x"></i>
            </button>
            <h3><i class="ti ti-files"></i> Merge PDFs</h3>
            <div class="tool-content">
                <p>Current document: <strong>${currentFileName}</strong></p>
                <p>Select a PDF file to merge with the current document:</p>
                <input type="file" id="mergeFile" accept=".pdf" />
                <div style="margin-top: 1rem;">
                    <label>
                        <input type="radio" name="mergeOrder" value="before" checked />
                        Insert before current document
                    </label>
                    <label style="display: block; margin-top: 0.5rem;">
                        <input type="radio" name="mergeOrder" value="after" />
                        Insert after current document
                    </label>
                </div>
                <button class="action-btn" onclick="executeMergeWithCurrent()" style="margin-top: 1rem;">
                    <i class="ti ti-check"></i> Merge Documents
                </button>
            </div>
        `;
        showToolPanel(panel);
        return;
    }

    // Case 2: No document open - use multi-file upload
    if (allUploadedFiles.length < 2) {
        showNotification('Please upload at least 2 PDF files to merge. Upload multiple files at once.', 'warning');
        return;
    }

    const panel = `
        <button class="close-btn" onclick="closeToolPanel()">
            <i class="ti ti-x"></i>
        </button>
        <h3><i class="ti ti-files"></i> Merge PDFs</h3>
        <div class="tool-content">
            <p>Files to merge (${allUploadedFiles.length}):</p>
            <ul class="file-list">
                ${allUploadedFiles.map((f, i) => `<li>${i + 1}. ${f.name}</li>`).join('')}
            </ul>
            <button class="action-btn" onclick="executeMerge()">
                <i class="ti ti-check"></i> Merge All PDFs
            </button>
        </div>
    `;

    showToolPanel(panel);
}

/**
 * Execute merge (when multiple files uploaded without current document)
 */
async function executeMerge() {
    try {
        const pdfBuffers = allUploadedFiles.map(f => f.data);
        const mergedPDF = await tools.mergePDFs(pdfBuffers);

        // Create a fresh copy to avoid detachment issues
        const newArray = new Uint8Array(mergedPDF);
        currentPDFData = newArray.buffer;
        currentFileName = 'merged.pdf';

        // IMPORTANT: Always pass a copy to viewer to prevent detachment
        await viewer.loadPDF(currentPDFData.slice(0));

        addEditToHistory('Merged PDFs');
        closeToolPanel();
        showNotification('PDFs merged successfully!', 'success');
    } catch (error) {
        console.error('Merge failed:', error);
        showNotification('Failed to merge PDFs: ' + error.message, 'error');
    }
}

/**
 * Execute merge with current document (new file picker workflow)
 */
async function executeMergeWithCurrent() {
    try {
        const fileInput = document.getElementById('mergeFile');
        const file = fileInput.files[0];

        if (!file) {
            showNotification('Please select a PDF file to merge', 'warning');
            return;
        }

        // Read the new file
        const newFileBuffer = await readFileAsArrayBuffer(file);

        // Get merge order
        const order = document.querySelector('input[name="mergeOrder"]:checked').value;

        // Prepare buffers in correct order
        const pdfBuffers = order === 'before'
            ? [newFileBuffer, currentPDFData.slice(0)]
            : [currentPDFData.slice(0), newFileBuffer];

        // Use Web Worker for merging
        const mergedPDF = await workerManager.execute('merge', { pdfs: pdfBuffers });

        // Create a fresh copy to avoid detachment issues
        const newArray = new Uint8Array(mergedPDF);
        currentPDFData = newArray.buffer;
        currentFileName = `merged_${currentFileName}`;

        // IMPORTANT: Always pass a copy to viewer to prevent detachment
        await viewer.loadPDF(currentPDFData.slice(0));

        addEditToHistory(`Merged with ${file.name}`);
        closeToolPanel();
        showNotification(`Successfully merged ${file.name} with ${currentFileName}!`, 'success');
    } catch (error) {
        console.error('Merge failed:', error);
        showNotification('Failed to merge PDFs: ' + error.message, 'error');
    }
}

/**
 * Show split panel
 */
function showSplitPanel() {
    if (!currentPDFData) {
        showNotification('Please load a PDF first', 'warning');
        return;
    }

    // Check if PDF has more than 1 page
    if (viewer.totalPages <= 1) {
        showNotification('Cannot split: PDF must have more than 1 page', 'warning');
        return;
    }

    const panel = `
        <button class="close-btn" onclick="closeToolPanel()">
            <i class="ti ti-x"></i>
        </button>
        <h3><i class="ti ti-cut"></i> Split PDF</h3>
        <div class="tool-content">
            <p>Current PDF: <strong>${currentFileName}</strong> (${viewer.totalPages} pages)</p>

            <div style="margin: 1rem 0;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                    Split after page:
                </label>
                <input type="number" id="splitPage" min="1" max="${viewer.totalPages - 1}"
                       value="${viewer.currentPage}"
                       style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;" />
                <p style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">
                    This will create two PDFs:<br/>
                    • <strong>Part 1:</strong> Pages 1 to <span id="splitPageBefore">${viewer.currentPage}</span><br/>
                    • <strong>Part 2:</strong> Pages <span id="splitPageAfter">${viewer.currentPage + 1}</span> to ${viewer.totalPages}
                </p>
            </div>

            <button class="action-btn" onclick="executeSplit()">
                <i class="ti ti-check"></i> Split PDF
            </button>
        </div>
    `;

    showToolPanel(panel);

    // Add input listener to update the preview text
    setTimeout(() => {
        const input = document.getElementById('splitPage');
        if (input) {
            input.addEventListener('input', () => {
                const splitAt = parseInt(input.value) || viewer.currentPage;
                const beforeSpan = document.getElementById('splitPageBefore');
                const afterSpan = document.getElementById('splitPageAfter');
                if (beforeSpan) beforeSpan.textContent = splitAt;
                if (afterSpan) afterSpan.textContent = splitAt + 1;
            });
        }
    }, 0);
}

/**
 * Execute split
 */
async function executeSplit() {
    try {
        // Get the split page from input
        const splitPageInput = document.getElementById('splitPage');
        const splitAfterPage = splitPageInput ? parseInt(splitPageInput.value) : null;

        // Validate split page
        if (splitAfterPage && (splitAfterPage < 1 || splitAfterPage >= viewer.totalPages)) {
            showNotification(`Split page must be between 1 and ${viewer.totalPages - 1}`, 'warning');
            return;
        }

        // Create a copy to avoid detachment issues
        const pdfCopy = currentPDFData.slice(0);
        const splitPDFs = await tools.splitPDF(pdfCopy, splitAfterPage);

        // Download the split PDFs with appropriate names
        if (splitAfterPage) {
            // Two-part split
            const baseName = currentFileName.replace('.pdf', '');
            const fileName1 = `${baseName}_part1_pages1-${splitAfterPage}.pdf`;
            const fileName2 = `${baseName}_part2_pages${splitAfterPage + 1}-${viewer.totalPages}.pdf`;

            tools.downloadPDF(splitPDFs[0], fileName1);
            setTimeout(() => {
                tools.downloadPDF(splitPDFs[1], fileName2);
            }, 300);

            addEditToHistory(`Split after page ${splitAfterPage}`);
            showNotification(`PDF split into 2 files. Check your downloads.`, 'success');
        } else {
            // Individual pages split
            splitPDFs.forEach((pdfBytes, index) => {
                const fileName = currentFileName.replace('.pdf', `_page_${index + 1}.pdf`);
                setTimeout(() => {
                    tools.downloadPDF(pdfBytes, fileName);
                }, index * 300);
            });

            addEditToHistory(`Split into ${splitPDFs.length} pages`);
            showNotification(`PDF split into ${splitPDFs.length} files. Check your downloads.`, 'success');
        }

        closeToolPanel();
    } catch (error) {
        console.error('Split failed:', error);
        showNotification('Failed to split PDF: ' + error.message, 'error');
    }
}

/**
 * Show rotate panel
 */
function showRotatePanel() {
    if (!currentPDFData) {
        showNotification('Please load a PDF first', 'warning');
        return;
    }

    // Generate page checkboxes
    let pageCheckboxes = '';
    for (let i = 1; i <= viewer.totalPages; i++) {
        pageCheckboxes += `
            <label class="page-checkbox">
                <input type="checkbox" value="${i}" ${i === viewer.currentPage ? 'checked' : ''}>
                <span>Page ${i}</span>
            </label>
        `;
    }

    const panel = `
        <button class="close-btn" onclick="closeToolPanel()">
            <i class="ti ti-x"></i>
        </button>
        <h3><i class="ti ti-rotate-clockwise"></i> Rotate Pages</h3>
        <div class="tool-content">
            <p>Current PDF: <strong>${currentFileName}</strong></p>

            <div class="form-group">
                <label>Select Pages to Rotate:</label>
                <div style="margin-bottom: 0.5rem;">
                    <button class="option-btn" onclick="selectAllPages()" style="font-size: 0.75rem; padding: 0.5rem;">
                        Select All
                    </button>
                    <button class="option-btn" onclick="selectNoPages()" style="font-size: 0.75rem; padding: 0.5rem;">
                        Clear All
                    </button>
                </div>
                <div class="page-selection-grid">
                    ${pageCheckboxes}
                </div>
            </div>

            <div class="form-group">
                <label>Rotation Angle:</label>
                <div class="button-group">
                    <button class="option-btn" onclick="executeRotate(90)">
                        <i class="ti ti-rotate-clockwise"></i> 90°
                    </button>
                    <button class="option-btn" onclick="executeRotate(180)">
                        <i class="ti ti-rotate-2"></i> 180°
                    </button>
                    <button class="option-btn" onclick="executeRotate(270)">
                        <i class="ti ti-rotate"></i> 270°
                    </button>
                </div>
            </div>

            <p class="note">Select one or more pages to rotate.</p>
        </div>
    `;

    showToolPanel(panel);
}

/**
 * Select all pages for rotation
 */
function selectAllPages() {
    document.querySelectorAll('.page-checkbox input[type="checkbox"]').forEach(cb => cb.checked = true);
}

/**
 * Deselect all pages for rotation
 */
function selectNoPages() {
    document.querySelectorAll('.page-checkbox input[type="checkbox"]').forEach(cb => cb.checked = false);
}

/**
 * Execute rotate
 */
async function executeRotate(degrees) {
    try {
        // Get selected pages
        const selectedPages = Array.from(document.querySelectorAll('.page-checkbox input[type="checkbox"]:checked'))
            .map(cb => parseInt(cb.value) - 1); // Convert to 0-based index

        if (selectedPages.length === 0) {
            showNotification('Please select at least one page to rotate', 'warning');
            return;
        }

        // Save current page to restore after rotation
        const currentPage = viewer.currentPage;

        // Use Web Worker for rotation
        const rotatedPDF = await workerManager.execute('rotate', {
            pdfData: currentPDFData.slice(0),
            pageIndices: selectedPages,
            rotation: degrees
        });

        // Create a fresh copy to avoid detachment issues
        const newArray = new Uint8Array(rotatedPDF);
        currentPDFData = newArray.buffer;

        // Update document in tabs
        const activeDoc = getActiveDocument();
        if (activeDoc) {
            activeDoc.pdfData = currentPDFData.slice(0);
        }

        // Update cache
        if (currentCacheId && currentPDFData) {
            await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
        }

        // IMPORTANT: Always pass a copy to viewer to prevent detachment
        await viewer.loadPDF(currentPDFData.slice(0));

        // Restore the page position in scroll view
        await viewer.goToPage(currentPage);

        // Force thumbnail regeneration if navigator is open
        if (viewer.navPanelOpen) {
            await viewer.generateThumbnails(true);
        }

        const pageText = selectedPages.length === 1 ? 'page' : 'pages';
        addEditToHistory(`Rotated ${selectedPages.length} ${pageText} by ${degrees}°`);
        closeToolPanel();
        showNotification(`${selectedPages.length} ${pageText} rotated ${degrees}° clockwise!`, 'success');
    } catch (error) {
        console.error('Rotation failed:', error);
        showNotification('Failed to rotate PDF: ' + error.message, 'error');
    }
}

/**
 * Handle compress
 */
async function handleCompress() {
    if (!currentPDFData) {
        showNotification('Please load a PDF first', 'warning');
        return;
    }

    try {
        console.log('Starting compression...');
        const originalSize = currentPDFData.byteLength;
        console.log('Original size:', originalSize, 'bytes');

        // Use Web Worker for compression
        const compressedPDF = await workerManager.execute('compress', {
            pdfData: currentPDFData.slice(0)
        });

        console.log('Compression completed');
        const newSize = compressedPDF.byteLength;
        console.log('Compressed size:', newSize, 'bytes');

        // Create a fresh copy to avoid detachment issues
        const newArray = new Uint8Array(compressedPDF);
        currentPDFData = newArray.buffer;

        // Update document in tabs
        const activeDoc = getActiveDocument();
        if (activeDoc) {
            activeDoc.pdfData = currentPDFData.slice(0);
        }

        // Update cache
        if (currentCacheId && currentPDFData) {
            await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
        }

        // Save current page to restore after reload
        const currentPage = viewer.currentPage;

        // IMPORTANT: Always pass a copy to viewer to prevent detachment
        await viewer.loadPDF(currentPDFData.slice(0));

        // Restore page position in scroll view
        await viewer.goToPage(currentPage);

        const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
        const saved = reduction > 0 ? reduction : 0;

        addEditToHistory(`Compressed (${saved}% reduction)`);
        showNotification(`PDF optimized! Original: ${(originalSize / 1024).toFixed(1)} KB → Compressed: ${(newSize / 1024).toFixed(1)} KB (${saved}% reduction)`, 'success', 5000);
    } catch (error) {
        console.error('Compression failed:', error);
        showNotification('Failed to compress PDF: ' + error.message, 'error');
    }
}

/**
 * Show image insertion panel
 */
function showImagePanel() {
    if (!currentPDFData) {
        showNotification('Please load a PDF first', 'warning');
        return;
    }

    const panel = `
        <button class="close-btn" onclick="closeToolPanel()">
            <i class="ti ti-x"></i>
        </button>
        <h3><i class="ti ti-photo-plus"></i> Insert Image</h3>
        <div class="tool-content">
            <div class="form-group">
                <label>Select Image:</label>
                <input type="file" id="imageFile" accept="image/png,image/jpeg,image/jpg" class="file-input">
            </div>

            <div class="info-box" style="background: var(--background); padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0;">
                    <i class="ti ti-info-circle"></i> After selecting an image, draw a box on the PDF where you want to place it. You can then drag and resize the box before validating.
                </p>
            </div>
        </div>
    `;

    showToolPanel(panel);

    // Setup file input handler
    setTimeout(() => {
        const fileInput = document.getElementById('imageFile');
        if (fileInput) {
            fileInput.addEventListener('change', handleImageFileSelection);
        }
    }, 0);
}

/**
 * Handle image file selection for draw-box insertion
 */
async function handleImageFileSelection(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Read image as data URL for preview
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        // Read image as ArrayBuffer for insertion
        const imageBuffer = await readFileAsArrayBuffer(file);
        const imageType = file.type.includes('png') ? 'png' : 'jpg';

        // Load image to get dimensions
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
        });

        // Start drawing mode
        pendingObjects.startDrawing('image', {
            imageUrl: dataUrl,
            imageData: imageBuffer,
            imageType: imageType,
            originalWidth: img.width,
            originalHeight: img.height
        });

        showNotification('Draw a box on the PDF to place your image. Click Validate when done.', 'info');
    } catch (error) {
        console.error('Error loading image:', error);
        showNotification('Failed to load image: ' + error.message, 'error');
    }
}

// State for image positioning
let imagePreviewState = {
    image: null,
    imageData: null,
    isDragging: false,
    isResizing: false,
    dragStart: { x: 0, y: 0 },
    originalImageSize: { width: 0, height: 0 },
    resizeCorner: null, // 'tl', 'tr', 'bl', 'br'
    originalBounds: null // { x, y, width, height }
};

/**
 * Initialize image positioning system
 */
function initializeImagePositioning() {
    const canvas = document.getElementById('pdfCanvas');
    const container = document.querySelector('.pdf-canvas-container');

    // Remove any existing listeners
    canvas.removeEventListener('mousedown', handleImageCanvasMouseDown);
    canvas.removeEventListener('mousemove', handleImageCanvasMouseMove);
    canvas.removeEventListener('mouseup', handleImageCanvasMouseUp);

    // Add new listeners
    canvas.addEventListener('mousedown', handleImageCanvasMouseDown);
    canvas.addEventListener('mousemove', handleImageCanvasMouseMove);
    canvas.addEventListener('mouseup', handleImageCanvasMouseUp);
}

/**
 * Preview image on canvas
 */
async function previewImageOnCanvas() {
    const fileInput = document.getElementById('imageFile');
    const file = fileInput.files[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = () => {
            imagePreviewState.image = img;
            imagePreviewState.originalImageSize = { width: img.width, height: img.height };

            // Set initial size
            document.getElementById('imageWidth').value = img.width;
            document.getElementById('imageHeight').value = img.height;

            // Store image data for insertion
            readFileAsArrayBuffer(file).then(buffer => {
                imagePreviewState.imageData = buffer;
            });

            // Show preview hint
            document.getElementById('imagePreviewStatus').style.display = 'block';

            updateImagePreview();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Update image preview on canvas
 */
function updateImagePreview() {
    if (!imagePreviewState.image) return;

    const pageNum = parseInt(document.getElementById('imagePage').value);
    if (pageNum !== viewer.currentPage) {
        viewer.currentPage = pageNum;
        viewer.renderPage(pageNum).then(() => {
            drawImagePreview();
        });
    } else {
        drawImagePreview();
    }
}

/**
 * Draw image preview with handles
 */
function drawImagePreview() {
    if (!imagePreviewState.image) return;

    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');

    // Re-render the PDF page first
    viewer.renderPage(viewer.currentPage).then(() => {
        const x = parseInt(document.getElementById('imageX').value);
        const y = parseInt(document.getElementById('imageY').value);
        const width = parseInt(document.getElementById('imageWidth').value);
        const height = parseInt(document.getElementById('imageHeight').value);
        const rotation = parseInt(document.getElementById('imageRotation').value);

        ctx.save();

        // Apply rotation
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-(x + width / 2), -(y + height / 2));

        // Draw image with transparency
        ctx.globalAlpha = 0.8;
        ctx.drawImage(imagePreviewState.image, x, y, width, height);
        ctx.globalAlpha = 1.0;

        // Draw handles (corners and edges)
        ctx.restore();
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        // Corner handles
        const handleSize = 8;
        ctx.fillStyle = '#3B82F6';
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
    });
}

/**
 * Handle mouse down on canvas for image positioning
 */
function handleImageCanvasMouseDown(e) {
    if (!imagePreviewState.image) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const x = parseInt(document.getElementById('imageX').value);
    const y = parseInt(document.getElementById('imageY').value);
    const width = parseInt(document.getElementById('imageWidth').value);
    const height = parseInt(document.getElementById('imageHeight').value);

    const handleSize = 8;
    const borderWidth = 2; // Border thickness for hit detection

    // Check if clicking on any of the 4 corner resize handles
    const isTopLeft = Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - y) < handleSize;
    const isTopRight = Math.abs(mouseX - (x + width)) < handleSize && Math.abs(mouseY - y) < handleSize;
    const isBottomLeft = Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - (y + height)) < handleSize;
    const isBottomRight = Math.abs(mouseX - (x + width)) < handleSize && Math.abs(mouseY - (y + height)) < handleSize;

    if (isTopLeft || isTopRight || isBottomLeft || isBottomRight) {
        // Clicking on a corner handle - enable resize
        imagePreviewState.isResizing = true;
        imagePreviewState.resizeCorner = isTopLeft ? 'tl' : isTopRight ? 'tr' : isBottomLeft ? 'bl' : 'br';
        imagePreviewState.dragStart = { x: mouseX, y: mouseY };
        imagePreviewState.originalBounds = { x, y, width, height };
        canvas.style.cursor = isTopLeft || isBottomRight ? 'nwse-resize' : 'nesw-resize';
    }
    // Check if clicking on the border (but not a handle)
    else if (
        (mouseX >= x - borderWidth && mouseX <= x + borderWidth && mouseY >= y && mouseY <= y + height) || // Left border
        (mouseX >= x + width - borderWidth && mouseX <= x + width + borderWidth && mouseY >= y && mouseY <= y + height) || // Right border
        (mouseY >= y - borderWidth && mouseY <= y + borderWidth && mouseX >= x && mouseX <= x + width) || // Top border
        (mouseY >= y + height - borderWidth && mouseY <= y + height + borderWidth && mouseX >= x && mouseX <= x + width) // Bottom border
    ) {
        // Clicking on border - no action
        return;
    }
    // Check if clicking inside the image frame (not on border)
    else if (mouseX > x + borderWidth && mouseX < x + width - borderWidth &&
             mouseY > y + borderWidth && mouseY < y + height - borderWidth) {
        // Clicking inside - enable dragging
        imagePreviewState.isDragging = true;
        imagePreviewState.dragStart = { x: mouseX - x, y: mouseY - y };
        canvas.style.cursor = 'move';
    }
}

/**
 * Handle mouse move on canvas for image positioning
 */
function handleImageCanvasMouseMove(e) {
    if (!imagePreviewState.image) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (imagePreviewState.isDragging) {
        const newX = Math.max(0, mouseX - imagePreviewState.dragStart.x);
        const newY = Math.max(0, mouseY - imagePreviewState.dragStart.y);

        document.getElementById('imageX').value = Math.round(newX);
        document.getElementById('imageY').value = Math.round(newY);
        drawImagePreview();
    } else if (imagePreviewState.isResizing) {
        const orig = imagePreviewState.originalBounds;
        const deltaX = mouseX - imagePreviewState.dragStart.x;
        const deltaY = mouseY - imagePreviewState.dragStart.y;

        let newX = orig.x;
        let newY = orig.y;
        let newWidth = orig.width;
        let newHeight = orig.height;

        // Calculate new bounds based on which corner is being dragged
        switch (imagePreviewState.resizeCorner) {
            case 'br': // Bottom-right
                newWidth = Math.max(20, orig.width + deltaX);
                newHeight = Math.max(20, orig.height + deltaY);
                break;
            case 'bl': // Bottom-left
                newX = Math.min(orig.x + orig.width - 20, orig.x + deltaX);
                newWidth = Math.max(20, orig.width - deltaX);
                newHeight = Math.max(20, orig.height + deltaY);
                break;
            case 'tr': // Top-right
                newY = Math.min(orig.y + orig.height - 20, orig.y + deltaY);
                newWidth = Math.max(20, orig.width + deltaX);
                newHeight = Math.max(20, orig.height - deltaY);
                break;
            case 'tl': // Top-left
                newX = Math.min(orig.x + orig.width - 20, orig.x + deltaX);
                newY = Math.min(orig.y + orig.height - 20, orig.y + deltaY);
                newWidth = Math.max(20, orig.width - deltaX);
                newHeight = Math.max(20, orig.height - deltaY);
                break;
        }

        document.getElementById('imageX').value = Math.round(newX);
        document.getElementById('imageY').value = Math.round(newY);
        document.getElementById('imageWidth').value = Math.round(newWidth);
        document.getElementById('imageHeight').value = Math.round(newHeight);
        drawImagePreview();
    } else {
        // Update cursor based on position
        const x = parseInt(document.getElementById('imageX').value);
        const y = parseInt(document.getElementById('imageY').value);
        const width = parseInt(document.getElementById('imageWidth').value);
        const height = parseInt(document.getElementById('imageHeight').value);
        const handleSize = 8;
        const borderWidth = 2;

        // Check corner handles
        const isTopLeft = Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - y) < handleSize;
        const isTopRight = Math.abs(mouseX - (x + width)) < handleSize && Math.abs(mouseY - y) < handleSize;
        const isBottomLeft = Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - (y + height)) < handleSize;
        const isBottomRight = Math.abs(mouseX - (x + width)) < handleSize && Math.abs(mouseY - (y + height)) < handleSize;

        if (isTopLeft || isBottomRight) {
            canvas.style.cursor = 'nwse-resize';
        } else if (isTopRight || isBottomLeft) {
            canvas.style.cursor = 'nesw-resize';
        } else if (mouseX > x + borderWidth && mouseX < x + width - borderWidth &&
                   mouseY > y + borderWidth && mouseY < y + height - borderWidth) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'default';
        }
    }
}

/**
 * Handle mouse up on canvas for image positioning
 */
function handleImageCanvasMouseUp(e) {
    const canvas = e.target;
    imagePreviewState.isDragging = false;
    imagePreviewState.isResizing = false;
    canvas.style.cursor = 'default';
}

/**
 * Execute image insertion
 */
async function executeInsertImage() {
    try {
        const fileInput = document.getElementById('imageFile');
        const file = fileInput.files[0];

        if (!file) {
            showNotification('Please select an image file', 'warning');
            return;
        }

        const imageBuffer = imagePreviewState.imageData || await readFileAsArrayBuffer(file);
        const imageType = file.type.includes('png') ? 'png' : 'jpg';

        const pageNum = parseInt(document.getElementById('imagePage').value) - 1;
        const x = parseInt(document.getElementById('imageX').value);
        const y = parseInt(document.getElementById('imageY').value);
        const width = parseInt(document.getElementById('imageWidth').value);
        const height = parseInt(document.getElementById('imageHeight').value);
        const rotation = parseInt(document.getElementById('imageRotation').value);

        // Calculate scale based on original image size
        const scaleX = width / imagePreviewState.originalImageSize.width;
        const scaleY = height / imagePreviewState.originalImageSize.height;
        const scale = Math.min(scaleX, scaleY);

        // Create a copy to avoid detachment issues
        const pdfCopy = currentPDFData.slice(0);
        const modifiedPDF = await tools.insertImage(
            pdfCopy,
            imageBuffer,
            imageType,
            pageNum,
            { x, y, scale, rotation, width, height }
        );

        // Create a fresh copy to avoid detachment issues
        const newArray = new Uint8Array(modifiedPDF);
        currentPDFData = newArray.buffer;

        // Clear preview state
        imagePreviewState = {
            image: null,
            imageData: null,
            isDragging: false,
            isResizing: false,
            dragStart: { x: 0, y: 0 },
            originalImageSize: { width: 0, height: 0 }
        };

        // IMPORTANT: Always pass a copy to viewer to prevent detachment
        await viewer.loadPDF(currentPDFData.slice(0));

        addEditToHistory(`Image inserted (page ${pageNum + 1})`);
        closeToolPanel();
        showNotification('Image inserted successfully!', 'success');
    } catch (error) {
        console.error('Image insertion failed:', error);
        showNotification('Failed to insert image: ' + error.message, 'error');
    }
}

// State for annotation positioning
let annotationPreviewState = {
    isActive: false,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    textWidth: 0,
    textHeight: 0
};

/**
 * Initialize annotation positioning system
 */
function initializeAnnotationPositioning() {
    const canvas = document.getElementById('pdfCanvas');

    // Setup color picker
    const colorBtns = document.querySelectorAll('#annotationColorPicker .color-btn');
    colorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('annotationColor').value = btn.dataset.color;
            updateAnnotationPreview();
        });
    });

    // Remove existing listeners to avoid duplicates
    canvas.removeEventListener('mousedown', handleAnnotationCanvasMouseDown);
    canvas.removeEventListener('mousemove', handleAnnotationCanvasMouseMove);
    canvas.removeEventListener('mouseup', handleAnnotationCanvasMouseUp);

    // Add new listeners
    canvas.addEventListener('mousedown', handleAnnotationCanvasMouseDown);
    canvas.addEventListener('mousemove', handleAnnotationCanvasMouseMove);
    canvas.addEventListener('mouseup', handleAnnotationCanvasMouseUp);
}

/**
 * Update annotation preview on canvas
 */
function updateAnnotationPreview() {
    const text = document.getElementById('annotationText')?.value;
    if (!text || text.trim() === '') {
        annotationPreviewState.isActive = false;
        viewer.renderPage(viewer.currentPage);
        document.getElementById('annotationPreviewStatus').style.display = 'none';
        return;
    }

    annotationPreviewState.isActive = true;
    document.getElementById('annotationPreviewStatus').style.display = 'block';

    const pageNum = parseInt(document.getElementById('annotationPage').value);
    if (pageNum !== viewer.currentPage) {
        viewer.currentPage = pageNum;
        viewer.renderPage(pageNum).then(() => {
            drawAnnotationPreview();
        });
    } else {
        drawAnnotationPreview();
    }
}

/**
 * Draw annotation preview with handles
 */
function drawAnnotationPreview() {
    if (!annotationPreviewState.isActive) return;

    const text = document.getElementById('annotationText')?.value;
    if (!text) return;

    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');

    // Re-render the PDF page first
    viewer.renderPage(viewer.currentPage).then(() => {
        const x = parseInt(document.getElementById('annotationX').value);
        const y = parseInt(document.getElementById('annotationY').value);
        const size = parseInt(document.getElementById('annotationSize').value);
        const colorStr = document.getElementById('annotationColor').value;
        const [r, g, b] = colorStr.split(',').map(parseFloat);

        // Convert RGB 0-1 to 0-255
        const rgbColor = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;

        ctx.save();

        // Set font and measure text
        ctx.font = `${size}px Arial`;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = size; // Approximate height

        // Store dimensions for hit detection
        annotationPreviewState.textWidth = textWidth;
        annotationPreviewState.textHeight = textHeight;

        // Draw background box with transparency
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(x - 2, y - textHeight - 2, textWidth + 4, textHeight + 4);

        // Draw text with transparency
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = rgbColor;
        ctx.fillText(text, x, y);
        ctx.globalAlpha = 1.0;

        // Draw bounding box
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 2, y - textHeight - 2, textWidth + 4, textHeight + 4);

        // Draw corner handles
        const handleSize = 8;
        ctx.fillStyle = '#3B82F6';
        ctx.fillRect(x - handleSize / 2, y - textHeight - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + textWidth - handleSize / 2, y - textHeight - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + textWidth - handleSize / 2, y - handleSize / 2, handleSize, handleSize);

        ctx.restore();
    });
}

/**
 * Handle mouse down on canvas for annotation positioning
 */
function handleAnnotationCanvasMouseDown(e) {
    if (!annotationPreviewState.isActive) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const x = parseInt(document.getElementById('annotationX').value);
    const y = parseInt(document.getElementById('annotationY').value);
    const textHeight = annotationPreviewState.textHeight;
    const textWidth = annotationPreviewState.textWidth;

    // Check if clicking inside text bounds
    if (mouseX >= x - 2 && mouseX <= x + textWidth + 2 &&
        mouseY >= y - textHeight - 2 && mouseY <= y + 2) {
        annotationPreviewState.isDragging = true;
        annotationPreviewState.dragStart = { x: mouseX - x, y: mouseY - y };
        canvas.style.cursor = 'move';
    }
}

/**
 * Handle mouse move on canvas for annotation positioning
 */
function handleAnnotationCanvasMouseMove(e) {
    if (!annotationPreviewState.isActive) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (annotationPreviewState.isDragging) {
        const newX = Math.max(0, mouseX - annotationPreviewState.dragStart.x);
        const newY = Math.max(annotationPreviewState.textHeight, mouseY - annotationPreviewState.dragStart.y);

        document.getElementById('annotationX').value = Math.round(newX);
        document.getElementById('annotationY').value = Math.round(newY);
        drawAnnotationPreview();
    } else {
        // Update cursor based on position
        const x = parseInt(document.getElementById('annotationX').value);
        const y = parseInt(document.getElementById('annotationY').value);
        const textHeight = annotationPreviewState.textHeight;
        const textWidth = annotationPreviewState.textWidth;

        if (mouseX >= x - 2 && mouseX <= x + textWidth + 2 &&
            mouseY >= y - textHeight - 2 && mouseY <= y + 2) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'default';
        }
    }
}

/**
 * Handle mouse up on canvas for annotation positioning
 */
function handleAnnotationCanvasMouseUp(e) {
    const canvas = e.target;
    annotationPreviewState.isDragging = false;
    canvas.style.cursor = 'default';
}

/**
 * Show annotation panel
 */
function showAnnotatePanel() {
    if (!currentPDFData) {
        showNotification('Please load a PDF first', 'warning');
        return;
    }

    const panel = `
        <button class="close-btn" onclick="closeToolPanel()">
            <i class="ti ti-x"></i>
        </button>
        <h3><i class="ti ti-pencil"></i> Add Text Annotation</h3>
        <div class="tool-content">
            <div class="form-group">
                <label>Text:</label>
                <textarea id="annotationText" rows="3" class="text-input" placeholder="Enter text..."></textarea>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    <button class="option-btn" onclick="insertDateTime('date')" title="Insert current date">
                        <i class="ti ti-calendar"></i> Date
                    </button>
                    <button class="option-btn" onclick="insertDateTime('time')" title="Insert current time">
                        <i class="ti ti-clock"></i> Time
                    </button>
                    <button class="option-btn" onclick="insertDateTime('datetime')" title="Insert date and time">
                        <i class="ti ti-calendar-time"></i> Both
                    </button>
                </div>
            </div>

            <div class="form-group">
                <label>Font Size:</label>
                <input type="number" id="annotationSize" min="6" max="72" value="14" class="text-input">
            </div>

            <div class="form-group">
                <label>Color:</label>
                <div class="color-picker" id="annotationColorPicker">
                    <button class="color-btn" data-color="0,0,0" style="background: #000000;" title="Black"></button>
                    <button class="color-btn" data-color="1,0,0" style="background: #FF0000;" title="Red"></button>
                    <button class="color-btn active" data-color="0,0,1" style="background: #0000FF;" title="Blue"></button>
                    <button class="color-btn" data-color="0,0.5,0" style="background: #008000;" title="Green"></button>
                    <button class="color-btn" data-color="1,0.65,0" style="background: #FFA500;" title="Orange"></button>
                    <button class="color-btn" data-color="0.5,0,0.5" style="background: #800080;" title="Purple"></button>
                    <button class="color-btn" data-color="1,0.75,0.8" style="background: #FFBFCC;" title="Pink"></button>
                    <button class="color-btn" data-color="0.6,0.4,0.2" style="background: #996633;" title="Brown"></button>
                </div>
                <input type="hidden" id="annotationColor" value="0,0,1">
            </div>

            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                <button class="action-btn" onclick="addTextAnnotationToPage()" style="flex: 1;">
                    <i class="ti ti-check"></i> Add to Page
                </button>
                <button class="option-btn" onclick="saveCurrentAnnotation()" title="Save to library">
                    <i class="ti ti-device-floppy"></i>
                </button>
            </div>

            <div class="form-group">
                <label>Saved Annotations:</label>
                <div id="savedAnnotationsList" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto;">
                    <!-- Annotations will be loaded here -->
                </div>
            </div>

            <div class="info-box" style="background: var(--background); padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0;">
                    <i class="ti ti-info-circle"></i> After entering text, click "Add to Page" then draw a box where you want to place it.
                </p>
            </div>
        </div>
    `;

    showToolPanel(panel);

    // Setup color picker
    setTimeout(() => {
        const colorBtns = document.querySelectorAll('#annotationColorPicker .color-btn');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                colorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('annotationColor').value = btn.dataset.color;
            });
        });

        // Load saved annotations
        loadSavedAnnotations();
    }, 0);
}

/**
 * Add text annotation to page using draw-box system
 */
async function addTextAnnotationToPage() {
    const text = document.getElementById('annotationText').value;
    if (!text) {
        showNotification('Please enter annotation text', 'warning');
        return;
    }

    const fontSize = parseInt(document.getElementById('annotationSize').value);
    const colorRGB = document.getElementById('annotationColor').value;

    // Parse RGB color
    const [r, g, b] = colorRGB.split(',').map(parseFloat);
    const hexColor = '#' + [r, g, b].map(v => {
        const hex = Math.round(v * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');

    // Start drawing mode
    pendingObjects.startDrawing('text', {
        text: text,
        fontSize: fontSize,
        color: hexColor,
        colorRGB: [r, g, b]  // Pass as array, not string
    });

    showNotification('Draw a box on the PDF to place your text', 'info');
    closeToolPanel();
}

/**
 * Insert date/time into annotation text
 */
function insertDateTime(type) {
    const textarea = document.getElementById('annotationText');
    const now = new Date();
    let text = '';

    if (type === 'date') {
        text = now.toLocaleDateString('fr-FR');
    } else if (type === 'time') {
        text = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (type === 'datetime') {
        text = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    // Insert at cursor position or append
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;

    textarea.value = currentValue.substring(0, start) + text + currentValue.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

/**
 * Save current annotation to library
 */
async function saveCurrentAnnotation() {
    const text = document.getElementById('annotationText').value;
    if (!text) {
        showNotification('Please enter annotation text first', 'warning');
        return;
    }

    const fontSize = parseInt(document.getElementById('annotationSize').value);
    const colorRGB = document.getElementById('annotationColor').value;

    const name = prompt('Enter a name for this annotation:', text.substring(0, 30));
    if (!name) return;

    await annotationLibrary.saveAnnotation(name, text, fontSize, colorRGB);
    await loadSavedAnnotations();
    showNotification('Annotation saved to library', 'success');
}

/**
 * Load saved annotations from library
 */
async function loadSavedAnnotations() {
    const annotations = await annotationLibrary.getAllAnnotations();
    const container = document.getElementById('savedAnnotationsList');

    if (!container) return;

    if (annotations.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 0.5rem;">No saved annotations</div>';
        return;
    }

    container.innerHTML = annotations.map(ann => {
        const [r, g, b] = ann.color.split(',').map(parseFloat);
        const hexColor = '#' + [r, g, b].map(v => {
            const hex = Math.round(v * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');

        return `
            <div class="saved-annotation-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--white); border: 1px solid var(--border); border-radius: 6px;">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ann.name}</div>
                    <div style="font-size: 0.625rem; color: var(--text-muted); margin-top: 0.125rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ann.text}</div>
                    <div style="font-size: 0.625rem; color: ${hexColor}; margin-top: 0.125rem;">Size: ${ann.fontSize}px • ${annotationLibrary.formatDate(ann.timestamp)}</div>
                </div>
                <button class="option-btn" onclick="loadAnnotationToForm(${ann.id})" title="Load to form" style="padding: 0.25rem 0.5rem;">
                    <i class="ti ti-download"></i>
                </button>
                <button class="option-btn" onclick="deleteAnnotation(${ann.id})" title="Delete" style="padding: 0.25rem 0.5rem; color: #EF4444;">
                    <i class="ti ti-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Load annotation from library to form
 */
async function loadAnnotationToForm(id) {
    const annotation = await annotationLibrary.getAnnotation(id);
    if (!annotation) return;

    document.getElementById('annotationText').value = annotation.text;
    document.getElementById('annotationSize').value = annotation.fontSize;
    document.getElementById('annotationColor').value = annotation.color;

    // Update active color button
    const colorBtns = document.querySelectorAll('#annotationColorPicker .color-btn');
    colorBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.color === annotation.color) {
            btn.classList.add('active');
        }
    });

    showNotification('Annotation loaded', 'success');
}

/**
 * Delete annotation from library
 */
async function deleteAnnotation(id) {
    if (!confirm('Delete this annotation?')) return;

    await annotationLibrary.removeAnnotation(id);
    await loadSavedAnnotations();
    showNotification('Annotation deleted', 'success');
}

/**
 * Execute annotation (old system - deprecated)
 */
async function executeAnnotate() {
    try {
        const text = document.getElementById('annotationText').value;
        if (!text) {
            showNotification('Please enter annotation text', 'warning');
            return;
        }

        const pageNum = parseInt(document.getElementById('annotationPage').value) - 1;
        const x = parseInt(document.getElementById('annotationX').value);
        const y = parseInt(document.getElementById('annotationY').value);
        const size = parseInt(document.getElementById('annotationSize').value);
        const colorStr = document.getElementById('annotationColor').value;
        const [r, g, b] = colorStr.split(',').map(parseFloat);

        // Create a copy to avoid detachment issues
        const pdfCopy = currentPDFData.slice(0);
        const modifiedPDF = await tools.addTextAnnotation(
            pdfCopy,
            pageNum,
            text,
            { x, y, size, color: { r, g, b } }
        );

        // Create a fresh copy to avoid detachment issues
        const newArray = new Uint8Array(modifiedPDF);
        currentPDFData = newArray.buffer;

        // Clear preview state
        annotationPreviewState = {
            isActive: false,
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            textWidth: 0,
            textHeight: 0
        };

        // IMPORTANT: Always pass a copy to viewer to prevent detachment
        await viewer.loadPDF(currentPDFData.slice(0));

        addEditToHistory(`Text annotation (page ${pageNum + 1})`);
        closeToolPanel();
        showNotification('Annotation added successfully!', 'success');
    } catch (error) {
        console.error('Annotation failed:', error);
        showNotification('Failed to add annotation: ' + error.message, 'error');
    }
}

/**
 * Show signature panel
 */
function showSignPanel() {
    if (!currentPDFData) {
        showNotification('Please load a PDF first', 'warning');
        return;
    }

    const panel = `
        <button class="close-btn" onclick="closeToolPanel()">
            <i class="ti ti-x"></i>
        </button>
        <h3><i class="ti ti-signature"></i> Add Signature</h3>
        <div class="tool-content">
            <div class="form-group">
                <label>Saved Signatures:</label>
                <div id="savedSignaturesList" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto; margin-bottom: 1rem;">
                    <div style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 1rem;">
                        Loading signatures...
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label>Draw Signature:</label>
                <canvas id="signatureCanvas" width="360" height="150" style="border: 1px solid var(--border); border-radius: 8px; cursor: crosshair; background: white;"></canvas>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    <button class="option-btn" onclick="clearSignature()" style="flex: 1;">
                        <i class="ti ti-eraser"></i> Clear
                    </button>
                    <button class="option-btn" onclick="saveCurrentSignature()" style="flex: 1;">
                        <i class="ti ti-device-floppy"></i> Save
                    </button>
                    <button class="option-btn" onclick="addSignatureToPage()" style="flex: 1;">
                        <i class="ti ti-check"></i> Add to Page
                    </button>
                </div>
            </div>

            <div class="form-group">
                <label>Pen Color:</label>
                <div class="color-picker" id="signatureColorPicker">
                    <button class="color-btn" data-color="#000000" style="background: #000000;" title="Black"></button>
                    <button class="color-btn active" data-color="#0000FF" style="background: #0000FF;" title="Blue"></button>
                    <button class="color-btn" data-color="#FF0000" style="background: #FF0000;" title="Red"></button>
                    <button class="color-btn" data-color="#008000" style="background: #008000;" title="Green"></button>
                    <button class="color-btn" data-color="#FFA500" style="background: #FFA500;" title="Orange"></button>
                    <button class="color-btn" data-color="#800080" style="background: #800080;" title="Purple"></button>
                    <button class="color-btn" data-color="#FFBFCC" style="background: #FFBFCC;" title="Pink"></button>
                    <button class="color-btn" data-color="#996633" style="background: #996633;" title="Brown"></button>
                </div>
                <input type="hidden" id="signatureColor" value="#0000FF">
            </div>

            <div class="info-box" style="background: var(--background); padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                <p style="font-size: 0.875rem; color: var(--text-muted); margin: 0;">
                    <i class="ti ti-info-circle"></i> Draw your signature, save it to library, then click "Add to Page" to place it on the PDF.
                </p>
            </div>
        </div>
    `;

    showToolPanel(panel);
    initSignatureCanvas();
    loadSavedSignatures();
}

// State for signature positioning
let signaturePreviewState = {
    image: null,
    isActive: false,
    isDragging: false,
    isResizing: false,
    dragStart: { x: 0, y: 0 },
    resizeCorner: null, // 'tl', 'tr', 'bl', 'br'
    originalBounds: null // { x, y, width, height }
};

/**
 * Initialize signature canvas
 */
function initSignatureCanvas() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let currentColor = document.getElementById('signatureColor').value;

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Setup color picker
    const colorBtns = document.querySelectorAll('#signatureColorPicker .color-btn');
    colorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentColor = btn.dataset.color;
            document.getElementById('signatureColor').value = currentColor;
            ctx.strokeStyle = currentColor;
        });
    });

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
    });

    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
    });

    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
    });

    // Initialize positioning on PDF canvas
    initializeSignaturePositioning();
}

/**
 * Initialize signature positioning system
 */
function initializeSignaturePositioning() {
    const pdfCanvas = document.getElementById('pdfCanvas');

    // Remove existing listeners to avoid duplicates
    pdfCanvas.removeEventListener('mousedown', handleSignatureCanvasMouseDown);
    pdfCanvas.removeEventListener('mousemove', handleSignatureCanvasMouseMove);
    pdfCanvas.removeEventListener('mouseup', handleSignatureCanvasMouseUp);

    // Add new listeners
    pdfCanvas.addEventListener('mousedown', handleSignatureCanvasMouseDown);
    pdfCanvas.addEventListener('mousemove', handleSignatureCanvasMouseMove);
    pdfCanvas.addEventListener('mouseup', handleSignatureCanvasMouseUp);
}

/**
 * Preview signature on PDF canvas
 */
async function previewSignatureOnCanvas() {
    const canvas = document.getElementById('signatureCanvas');

    // Check if signature is drawn
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isBlank = !imageData.data.some(channel => channel !== 0);

    if (isBlank) {
        showNotification('Please draw a signature first', 'warning');
        return;
    }

    // Switch to single page view for insertion
    if (viewer.viewMode !== 'single') {
        await viewer.setViewMode('single');
    }

    // Convert canvas to image
    const img = new Image();
    img.onload = () => {
        signaturePreviewState.image = img;
        signaturePreviewState.isActive = true;
        document.getElementById('signaturePreviewStatus').style.display = 'block';
        updateSignaturePreview();
    };
    img.src = canvas.toDataURL();
}

/**
 * Update signature preview on canvas
 */
function updateSignaturePreview() {
    if (!signaturePreviewState.image || !signaturePreviewState.isActive) return;

    const pageNum = parseInt(document.getElementById('signaturePage').value);
    if (pageNum !== viewer.currentPage) {
        viewer.currentPage = pageNum;
        viewer.renderPage(pageNum).then(() => {
            drawSignaturePreview();
        });
    } else {
        drawSignaturePreview();
    }
}

/**
 * Draw signature preview with handles
 */
function drawSignaturePreview() {
    if (!signaturePreviewState.image || !signaturePreviewState.isActive) return;

    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');

    // Re-render the PDF page first
    viewer.renderPage(viewer.currentPage).then(() => {
        const x = parseInt(document.getElementById('signatureX').value);
        const y = parseInt(document.getElementById('signatureY').value);
        const width = parseInt(document.getElementById('signatureWidth').value);
        const height = parseInt(document.getElementById('signatureHeight').value);

        ctx.save();

        // Draw signature with transparency
        ctx.globalAlpha = 0.8;
        ctx.drawImage(signaturePreviewState.image, x, y, width, height);
        ctx.globalAlpha = 1.0;

        // Draw handles
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        // Corner handles
        const handleSize = 8;
        ctx.fillStyle = '#3B82F6';
        ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);

        ctx.restore();
    });
}

/**
 * Handle mouse down on canvas for signature positioning
 */
function handleSignatureCanvasMouseDown(e) {
    if (!signaturePreviewState.isActive) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const x = parseInt(document.getElementById('signatureX').value);
    const y = parseInt(document.getElementById('signatureY').value);
    const width = parseInt(document.getElementById('signatureWidth').value);
    const height = parseInt(document.getElementById('signatureHeight').value);

    const handleSize = 8;
    const borderWidth = 2;

    // Check if clicking on any of the 4 corner resize handles
    const isTopLeft = Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - y) < handleSize;
    const isTopRight = Math.abs(mouseX - (x + width)) < handleSize && Math.abs(mouseY - y) < handleSize;
    const isBottomLeft = Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - (y + height)) < handleSize;
    const isBottomRight = Math.abs(mouseX - (x + width)) < handleSize && Math.abs(mouseY - (y + height)) < handleSize;

    if (isTopLeft || isTopRight || isBottomLeft || isBottomRight) {
        signaturePreviewState.isResizing = true;
        signaturePreviewState.resizeCorner = isTopLeft ? 'tl' : isTopRight ? 'tr' : isBottomLeft ? 'bl' : 'br';
        signaturePreviewState.dragStart = { x: mouseX, y: mouseY };
        signaturePreviewState.originalBounds = { x, y, width, height };
        canvas.style.cursor = isTopLeft || isBottomRight ? 'nwse-resize' : 'nesw-resize';
    }
    // Check if clicking on the border (but not a handle)
    else if (
        (mouseX >= x - borderWidth && mouseX <= x + borderWidth && mouseY >= y && mouseY <= y + height) ||
        (mouseX >= x + width - borderWidth && mouseX <= x + width + borderWidth && mouseY >= y && mouseY <= y + height) ||
        (mouseY >= y - borderWidth && mouseY <= y + borderWidth && mouseX >= x && mouseX <= x + width) ||
        (mouseY >= y + height - borderWidth && mouseY <= y + height + borderWidth && mouseX >= x && mouseX <= x + width)
    ) {
        // Clicking on border - no action
        return;
    }
    // Check if clicking inside the signature frame (not on border)
    else if (mouseX > x + borderWidth && mouseX < x + width - borderWidth &&
             mouseY > y + borderWidth && mouseY < y + height - borderWidth) {
        signaturePreviewState.isDragging = true;
        signaturePreviewState.dragStart = { x: mouseX - x, y: mouseY - y };
        canvas.style.cursor = 'move';
    }
}

/**
 * Handle mouse move on canvas for signature positioning
 */
function handleSignatureCanvasMouseMove(e) {
    if (!signaturePreviewState.isActive) return;

    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (signaturePreviewState.isDragging) {
        const newX = Math.max(0, mouseX - signaturePreviewState.dragStart.x);
        const newY = Math.max(0, mouseY - signaturePreviewState.dragStart.y);

        document.getElementById('signatureX').value = Math.round(newX);
        document.getElementById('signatureY').value = Math.round(newY);
        drawSignaturePreview();
    } else if (signaturePreviewState.isResizing) {
        const orig = signaturePreviewState.originalBounds;
        const deltaX = mouseX - signaturePreviewState.dragStart.x;
        const deltaY = mouseY - signaturePreviewState.dragStart.y;

        let newX = orig.x;
        let newY = orig.y;
        let newWidth = orig.width;
        let newHeight = orig.height;

        switch (signaturePreviewState.resizeCorner) {
            case 'br':
                newWidth = Math.max(20, orig.width + deltaX);
                newHeight = Math.max(20, orig.height + deltaY);
                break;
            case 'bl':
                newX = Math.min(orig.x + orig.width - 20, orig.x + deltaX);
                newWidth = Math.max(20, orig.width - deltaX);
                newHeight = Math.max(20, orig.height + deltaY);
                break;
            case 'tr':
                newY = Math.min(orig.y + orig.height - 20, orig.y + deltaY);
                newWidth = Math.max(20, orig.width + deltaX);
                newHeight = Math.max(20, orig.height - deltaY);
                break;
            case 'tl':
                newX = Math.min(orig.x + orig.width - 20, orig.x + deltaX);
                newY = Math.min(orig.y + orig.height - 20, orig.y + deltaY);
                newWidth = Math.max(20, orig.width - deltaX);
                newHeight = Math.max(20, orig.height - deltaY);
                break;
        }

        document.getElementById('signatureX').value = Math.round(newX);
        document.getElementById('signatureY').value = Math.round(newY);
        document.getElementById('signatureWidth').value = Math.round(newWidth);
        document.getElementById('signatureHeight').value = Math.round(newHeight);
        drawSignaturePreview();
    } else {
        // Update cursor based on position
        const x = parseInt(document.getElementById('signatureX').value);
        const y = parseInt(document.getElementById('signatureY').value);
        const width = parseInt(document.getElementById('signatureWidth').value);
        const height = parseInt(document.getElementById('signatureHeight').value);
        const handleSize = 8;
        const borderWidth = 2;

        const isTopLeft = Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - y) < handleSize;
        const isTopRight = Math.abs(mouseX - (x + width)) < handleSize && Math.abs(mouseY - y) < handleSize;
        const isBottomLeft = Math.abs(mouseX - x) < handleSize && Math.abs(mouseY - (y + height)) < handleSize;
        const isBottomRight = Math.abs(mouseX - (x + width)) < handleSize && Math.abs(mouseY - (y + height)) < handleSize;

        if (isTopLeft || isBottomRight) {
            canvas.style.cursor = 'nwse-resize';
        } else if (isTopRight || isBottomLeft) {
            canvas.style.cursor = 'nesw-resize';
        } else if (mouseX > x + borderWidth && mouseX < x + width - borderWidth &&
                   mouseY > y + borderWidth && mouseY < y + height - borderWidth) {
            canvas.style.cursor = 'move';
        } else {
            canvas.style.cursor = 'default';
        }
    }
}

/**
 * Handle mouse up on canvas for signature positioning
 */
function handleSignatureCanvasMouseUp(e) {
    const canvas = e.target;
    signaturePreviewState.isDragging = false;
    signaturePreviewState.isResizing = false;
    canvas.style.cursor = 'default';
}

/**
 * Clear signature canvas
 */
function clearSignature() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Add signature to page using draw-box system
 */
async function addSignatureToPage() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');

    // Check if signature is drawn
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isBlank = !imageData.data.some(channel => channel !== 0);

    if (isBlank) {
        showNotification('Please draw a signature first', 'warning');
        return;
    }

    try {
        // Convert canvas to PNG blob
        const signatureBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const signatureBuffer = await signatureBlob.arrayBuffer();

        // Convert to data URL for preview
        const signatureUrl = canvas.toDataURL('image/png');

        // Start drawing mode
        pendingObjects.startDrawing('signature', {
            signatureUrl: signatureUrl,
            signatureData: signatureBuffer,
            originalWidth: canvas.width,
            originalHeight: canvas.height
        });

        showNotification('Draw a box on the PDF to place your signature. Click Validate when done.', 'info');
    } catch (error) {
        console.error('Error preparing signature:', error);
        showNotification('Failed to prepare signature: ' + error.message, 'error');
    }
}

/**
 * Load saved signatures from library
 */
async function loadSavedSignatures() {
    try {
        const signatures = await signatureLibrary.getAllSignatures();
        const container = document.getElementById('savedSignaturesList');

        if (!container) return;

        if (signatures.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 0.5rem;">No saved signatures</div>';
            return;
        }

        container.innerHTML = signatures.map(sig => `
            <div class="saved-signature-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--white); border: 1px solid var(--border); border-radius: 6px;">
                <img src="${sig.dataUrl}" style="height: 40px; border: 1px solid var(--border); border-radius: 4px; background: white; flex-shrink: 0;" alt="${sig.name}">
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sig.name}</div>
                    <div style="font-size: 0.625rem; color: var(--text-muted);">${signatureLibrary.formatDate(sig.timestamp)}</div>
                </div>
                <button class="option-btn" onclick="loadSignatureToCanvas(${sig.id})" title="Load to canvas" style="padding: 0.25rem 0.5rem;">
                    <i class="ti ti-download"></i>
                </button>
                <button class="option-btn" onclick="deleteSignature(${sig.id})" title="Delete" style="padding: 0.25rem 0.5rem; color: #EF4444;">
                    <i class="ti ti-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading signatures:', error);
    }
}

/**
 * Save current signature to library
 */
async function saveCurrentSignature() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');

    // Check if signature is drawn
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isBlank = !imageData.data.some(channel => channel !== 0);

    if (isBlank) {
        showNotification('Please draw a signature first', 'warning');
        return;
    }

    // Prompt for name
    const name = prompt('Enter a name for this signature:', `Signature ${Date.now().toString().slice(-4)}`);
    if (!name) return;

    try {
        const dataUrl = canvas.toDataURL('image/png');
        await signatureLibrary.saveSignature(name, dataUrl);
        await loadSavedSignatures();
        showNotification('Signature saved to library', 'success');
    } catch (error) {
        console.error('Error saving signature:', error);
        showNotification('Failed to save signature: ' + error.message, 'error');
    }
}

/**
 * Load a saved signature to canvas
 */
async function loadSignatureToCanvas(id) {
    try {
        const signature = await signatureLibrary.getSignature(id);
        if (!signature) return;

        const canvas = document.getElementById('signatureCanvas');
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Load image
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
            showNotification('Signature loaded', 'success');
        };
        img.src = signature.dataUrl;
    } catch (error) {
        console.error('Error loading signature:', error);
        showNotification('Failed to load signature: ' + error.message, 'error');
    }
}

/**
 * Delete a signature from library
 */
async function deleteSignature(id) {
    if (!confirm('Delete this signature?')) return;

    try {
        await signatureLibrary.removeSignature(id);
        await loadSavedSignatures();
        showNotification('Signature deleted', 'success');
    } catch (error) {
        console.error('Error deleting signature:', error);
        showNotification('Failed to delete signature: ' + error.message, 'error');
    }
}

/**
 * Execute signature (old system - deprecated)
 */
async function executeSign() {
    try {
        const canvas = document.getElementById('signatureCanvas');

        // Convert canvas to PNG
        const signatureBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const signatureBuffer = await signatureBlob.arrayBuffer();

        const pageNum = parseInt(document.getElementById('signaturePage').value) - 1;
        const x = parseInt(document.getElementById('signatureX').value);
        const y = parseInt(document.getElementById('signatureY').value);
        const width = parseInt(document.getElementById('signatureWidth').value);
        const height = parseInt(document.getElementById('signatureHeight').value);

        // Calculate scale based on signature canvas size
        const scaleX = width / canvas.width;
        const scaleY = height / canvas.height;
        const scale = Math.min(scaleX, scaleY);

        // Create a copy to avoid detachment issues
        const pdfCopy = currentPDFData.slice(0);
        const modifiedPDF = await tools.insertImage(
            pdfCopy,
            signatureBuffer,
            'png',
            pageNum,
            { x, y, scale, rotation: 0, width, height }
        );

        // Create a fresh copy to avoid detachment issues
        const newArray = new Uint8Array(modifiedPDF);
        currentPDFData = newArray.buffer;

        // Clear preview state
        signaturePreviewState = {
            image: null,
            isActive: false,
            isDragging: false,
            isResizing: false,
            dragStart: { x: 0, y: 0 }
        };

        // IMPORTANT: Always pass a copy to viewer to prevent detachment
        await viewer.loadPDF(currentPDFData.slice(0));

        addEditToHistory(`Signature added (page ${pageNum + 1})`);
        closeToolPanel();
        showNotification('Signature added successfully!', 'success');
    } catch (error) {
        console.error('Signature failed:', error);
        showNotification('Failed to add signature: ' + error.message, 'error');
    }
}

/**
 * Handle hand tool toggle
 */
function handleHandTool() {
    const handBtn = document.getElementById('handToolBtn');
    const isActive = viewer.toggleHandTool();

    if (isActive) {
        handBtn.classList.add('active');
    } else {
        handBtn.classList.remove('active');
    }
}

/**
 * Show tool panel (now using FloatingPanel)
 */
function showToolPanel(content, title = 'Tool Panel', icon = 'ti-tool') {
    // Clean up content by removing old close button and h3 title if present
    let cleanContent = content;

    // Remove close button
    cleanContent = cleanContent.replace(/<button[^>]*class="close-btn"[^>]*>[\s\S]*?<\/button>/gi, '');

    // Extract title from h3 if title not explicitly provided and remove h3
    const h3Match = cleanContent.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3Match && title === 'Tool Panel') {
        // Extract text from h3 (removing icons)
        const h3Content = h3Match[1].replace(/<i[^>]*>[\s\S]*?<\/i>/gi, '').trim();
        if (h3Content) {
            title = h3Content;
        }
        // Extract icon from h3 if present
        const iconMatch = h3Match[1].match(/<i[^>]*class="[^"]*?(ti-[^"\s]+)/i);
        if (iconMatch && icon === 'ti-tool') {
            icon = iconMatch[1];
        }
    }
    cleanContent = cleanContent.replace(/<h3[^>]*>[\s\S]*?<\/h3>/gi, '');

    // Remove tool-content wrapper divs (content is already wrapped by FloatingPanel)
    cleanContent = cleanContent.replace(/<div[^>]*class="tool-content"[^>]*>/gi, '');
    cleanContent = cleanContent.replace(/<\/div>\s*$/gi, ''); // Remove last closing div

    // Use floating panel manager to create draggable panel
    return window.FloatingPanelManager.create('tool-panel', title, icon, cleanContent);
}

/**
 * Close tool panel
 */
function closeToolPanel() {
    // Close the floating panel
    window.FloatingPanelManager.close('tool-panel');

    // Clear any active preview states
    if (imagePreviewState.image || imagePreviewState.isActive) {
        imagePreviewState = {
            image: null,
            imageData: null,
            isDragging: false,
            isResizing: false,
            dragStart: { x: 0, y: 0 },
            resizeCorner: null,
            originalBounds: null,
            originalImageSize: null,
            isActive: false
        };
        // Re-render current page to clear preview
        if (viewer && viewer.currentPage) {
            viewer.renderPage(viewer.currentPage);
        }
    }

    if (signaturePreviewState.image || signaturePreviewState.isActive) {
        signaturePreviewState = {
            image: null,
            isActive: false,
            isDragging: false,
            isResizing: false,
            dragStart: { x: 0, y: 0 },
            resizeCorner: null,
            originalBounds: null
        };
        // Re-render current page to clear preview
        if (viewer && viewer.currentPage) {
            viewer.renderPage(viewer.currentPage);
        }
    }
}

/**
 * Update metadata display
 */
function updateMetadataDisplay() {
    // Update info bar (new location)
    const fileNameEl = document.getElementById('infoFileName');
    if (fileNameEl) {
        if (currentFileName) {
            const shortName = currentFileName.length > 25
                ? currentFileName.substring(0, 22) + '...'
                : currentFileName;
            fileNameEl.textContent = shortName;
            fileNameEl.title = currentFileName;
        } else {
            fileNameEl.textContent = '-';
            fileNameEl.title = '';
        }
    }

    // Page count
    const pagesEl = document.getElementById('infoPages');
    if (pagesEl) {
        if (viewer.totalPages > 0) {
            pagesEl.textContent = viewer.totalPages;
        } else {
            pagesEl.textContent = '-';
        }
    }

    // File size
    const fileSizeEl = document.getElementById('infoFileSize');
    if (fileSizeEl) {
        if (currentPDFData) {
            const sizeKB = (currentPDFData.byteLength / 1024).toFixed(1);
            const sizeMB = (currentPDFData.byteLength / (1024 * 1024)).toFixed(2);

            if (currentPDFData.byteLength < 1024 * 1024) {
                fileSizeEl.textContent = `${sizeKB} KB`;
            } else {
                fileSizeEl.textContent = `${sizeMB} MB`;
            }
        } else {
            fileSizeEl.textContent = '-';
        }
    }

    // Memory usage
    const memoryEl = document.getElementById('infoMemory');
    if (memoryEl && performance && performance.memory) {
        const usedMB = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
        memoryEl.textContent = `${usedMB} MB`;
    }

    // Edit count
    const editsEl = document.getElementById('infoEdits');
    if (editsEl) {
        editsEl.textContent = editHistory.length;
    }
}

/**
 * Show edit history details
 */
function showEditHistory() {
    if (editHistory.length === 0) {
        return;
    }

    // Create edit history list HTML
    const editsList = editHistory.map((edit, index) => {
        return `<li style="padding: 0.5rem; background: var(--background); border-radius: 6px; font-size: 0.875rem;">
            <strong>${index + 1}.</strong> ${edit}
        </li>`;
    }).join('');

    // Replace metadata content temporarily
    const metadataContent = document.querySelector('.metadata-content');
    const originalContent = metadataContent.innerHTML;

    metadataContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <h3 style="font-size: 1rem; font-weight: 600; color: var(--text); margin: 0;">
                <i class="ti ti-history"></i> Edit History
            </h3>
            <button onclick="closeEditHistory()" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0.25rem;">
                <i class="ti ti-x"></i>
            </button>
        </div>
        <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
            ${editsList}
        </ul>
    `;

    // Store original content for restoration
    window._originalMetadataContent = originalContent;
}

/**
 * Close edit history and restore metadata
 */
function closeEditHistory() {
    const metadataContent = document.querySelector('.metadata-content');
    if (window._originalMetadataContent) {
        metadataContent.innerHTML = window._originalMetadataContent;
        delete window._originalMetadataContent;
        // Re-setup click listener
        updateMetadataDisplay();
    }
}

/**
 * Update memory usage display
 */
function updateMemoryUsage() {
    const memoryEl = document.getElementById('metaMemory');

    // Exit if element doesn't exist (memory display is optional)
    if (!memoryEl) return;

    if (performance.memory) {
        const usedMB = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
        const totalMB = (performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1);
        memoryEl.textContent = `${usedMB} / ${totalMB} MB`;
    } else {
        // Fallback if memory API not available
        if (currentPDFData) {
            const estimatedMB = (currentPDFData.byteLength / (1024 * 1024)).toFixed(1);
            memoryEl.textContent = `~${estimatedMB} MB`;
        } else {
            memoryEl.textContent = '-';
        }
    }
}

/**
 * Save current state to undo stack
 */
function saveStateForUndo() {
    if (!currentPDFData) return;

    // Save current state
    const state = {
        pdfData: currentPDFData.slice(0), // Create a copy
        fileName: currentFileName,
        editHistory: [...editHistory],
        timestamp: Date.now()
    };

    undoStack.push(state);

    // Limit stack size
    if (undoStack.length > MAX_UNDO_STACK) {
        undoStack.shift(); // Remove oldest
    }

    // Clear redo stack when new action is performed
    redoStack = [];

    // Update undo/redo button states
    updateUndoRedoButtons();
}

/**
 * Undo last action
 */
async function undo() {
    if (undoStack.length === 0) {
        showNotification('Nothing to undo', 'warning');
        return;
    }

    // Save current state to redo stack
    const currentState = {
        pdfData: currentPDFData.slice(0),
        fileName: currentFileName,
        editHistory: [...editHistory],
        timestamp: Date.now()
    };
    redoStack.push(currentState);

    // Restore previous state
    const previousState = undoStack.pop();
    currentPDFData = previousState.pdfData;
    currentFileName = previousState.fileName;
    editHistory = previousState.editHistory;

    // Update active document
    const activeDoc = getActiveDocument();
    if (activeDoc) {
        activeDoc.pdfData = currentPDFData;
        activeDoc.editHistory = [...editHistory];
    }

    // Reload viewer
    await viewer.loadPDF(currentPDFData.slice(0));

    // Auto-save to cache
    if (currentCacheId && currentPDFData) {
        try {
            await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
            await updateRecentDocuments();
        } catch (error) {
            console.error('Failed to auto-save after undo:', error);
        }
    }

    updateMetadataDisplay();
    updateTabsUI();
    updateUndoRedoButtons();
    showNotification('Action undone', 'success');
}

/**
 * Redo last undone action
 */
async function redo() {
    if (redoStack.length === 0) {
        showNotification('Nothing to redo', 'warning');
        return;
    }

    // Save current state back to undo stack
    const currentState = {
        pdfData: currentPDFData.slice(0),
        fileName: currentFileName,
        editHistory: [...editHistory],
        timestamp: Date.now()
    };
    undoStack.push(currentState);

    // Restore redo state
    const redoState = redoStack.pop();
    currentPDFData = redoState.pdfData;
    currentFileName = redoState.fileName;
    editHistory = redoState.editHistory;

    // Update active document
    const activeDoc = getActiveDocument();
    if (activeDoc) {
        activeDoc.pdfData = currentPDFData;
        activeDoc.editHistory = [...editHistory];
    }

    // Reload viewer
    await viewer.loadPDF(currentPDFData.slice(0));

    // Auto-save to cache
    if (currentCacheId && currentPDFData) {
        try {
            await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
            await updateRecentDocuments();
        } catch (error) {
            console.error('Failed to auto-save after redo:', error);
        }
    }

    updateMetadataDisplay();
    updateTabsUI();
    updateUndoRedoButtons();
    showNotification('Action redone', 'success');
}

/**
 * Update undo/redo button states
 */
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    if (undoBtn) {
        undoBtn.disabled = undoStack.length === 0;
        undoBtn.title = undoStack.length > 0
            ? `Undo (${undoStack.length} actions available)`
            : 'Nothing to undo';
    }

    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
        redoBtn.title = redoStack.length > 0
            ? `Redo (${redoStack.length} actions available)`
            : 'Nothing to redo';
    }
}

/**
 * Search functionality
 */

function setupSearchHandlers() {
    const searchBtn = document.getElementById('searchBtn');
    const searchBar = document.getElementById('searchBar');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const prevMatch = document.getElementById('prevMatch');
    const nextMatch = document.getElementById('nextMatch');
    const caseSensitive = document.getElementById('caseSensitive');
    const wholeWord = document.getElementById('wholeWord');

    // Toggle search bar
    searchBtn.addEventListener('click', () => {
        const isVisible = searchBar.style.display !== 'none';
        searchBar.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible) {
            searchInput.focus();
        } else {
            clearSearch();
        }
    });

    // Perform search
    searchInput.addEventListener('input', debounce(async () => {
        await performSearch();
    }, 300));

    // Search options change
    caseSensitive.addEventListener('change', async () => {
        if (searchQuery) await performSearch();
    });

    wholeWord.addEventListener('change', async () => {
        if (searchQuery) await performSearch();
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearch();
    });

    // Navigate matches
    prevMatch.addEventListener('click', () => navigateToPreviousMatch());
    nextMatch.addEventListener('click', () => navigateToNextMatch());

    // Enter key to go to next match
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                navigateToPreviousMatch();
            } else {
                navigateToNextMatch();
            }
        }
    });
}

async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();

    if (!query) {
        clearSearch();
        return;
    }

    searchQuery = query;

    const caseSensitive = document.getElementById('caseSensitive').checked;
    const wholeWord = document.getElementById('wholeWord').checked;

    try {
        showNotification('Searching...', 'info', 1000);

        // Perform search
        searchMatches = await viewer.searchText(query, { caseSensitive, wholeWord });

        // Update results display
        updateSearchResults();

        // If matches found, highlight first one
        if (searchMatches.length > 0) {
            currentMatchIndex = 0;
            await navigateToMatch(0);
            showNotification(`Found ${searchMatches.length} match${searchMatches.length > 1 ? 'es' : ''}`, 'success');
        } else {
            showNotification('No matches found', 'warning');
            viewer.clearSearchHighlights();
        }
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Search failed: ' + error.message, 'error');
    }
}

function updateSearchResults() {
    const resultsSpan = document.getElementById('searchResults');
    const prevBtn = document.getElementById('prevMatch');
    const nextBtn = document.getElementById('nextMatch');

    if (searchMatches.length === 0) {
        resultsSpan.textContent = '0 / 0';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    } else {
        resultsSpan.textContent = `${currentMatchIndex + 1} / ${searchMatches.length}`;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }
}

async function navigateToNextMatch() {
    if (searchMatches.length === 0) return;

    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    await navigateToMatch(currentMatchIndex);
}

async function navigateToPreviousMatch() {
    if (searchMatches.length === 0) return;

    currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    await navigateToMatch(currentMatchIndex);
}

async function navigateToMatch(index) {
    if (index < 0 || index >= searchMatches.length) return;

    const match = searchMatches[index];

    // Navigate to the page if different
    if (match.pageNum !== viewer.currentPage) {
        viewer.currentPage = match.pageNum;
        await viewer.renderPage(match.pageNum);
    }

    // Highlight matches
    viewer.highlightSearchResults(searchMatches, index);

    // Update results display
    updateSearchResults();
}

function clearSearch() {
    searchQuery = '';
    searchMatches = [];
    currentMatchIndex = -1;
    viewer.clearSearchHighlights();
    updateSearchResults();
}

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Add edit to history
 */
async function addEditToHistory(editType) {
    // Save state before adding to history
    saveStateForUndo();
    const timestamp = new Date().toLocaleTimeString();
    editHistory.push(`${editType} (${timestamp})`);

    // Update active document
    const activeDoc = getActiveDocument();
    if (activeDoc) {
        activeDoc.editHistory = [...editHistory];
        activeDoc.pdfData = currentPDFData;
    }

    // Auto-save to cache if document is already cached
    if (currentCacheId && currentPDFData) {
        try {
            await pdfCache.updatePDF(currentCacheId, currentPDFData, currentPDFData.byteLength);
            await updateRecentDocuments(); // Refresh the recent documents list
            console.log('PDF auto-saved to cache');
        } catch (error) {
            console.error('Failed to auto-save PDF to cache:', error);
        }
    }

    updateMetadataDisplay();
    updateTabsUI();
}

/**
 * Update recent documents display
 */
async function updateRecentDocuments() {
    const recentDocsList = document.getElementById('recentDocsList');
    if (!recentDocsList) return;

    try {
        const recentPDFs = await pdfCache.getRecentPDFs();

        if (recentPDFs.length === 0) {
            recentDocsList.innerHTML = '<div class="recent-docs-empty">No recent documents</div>';
            return;
        }

        recentDocsList.innerHTML = recentPDFs.map(pdf => `
            <div class="recent-doc-item" data-pdf-id="${pdf.id}">
                <div class="recent-doc-content" onclick="openRecentDocument(${pdf.id})">
                    <div class="recent-doc-name" title="${pdf.fileName}">${pdf.fileName}</div>
                    <div class="recent-doc-meta">
                        <span class="recent-doc-size">${pdfCache.formatBytes(pdf.size)}</span>
                        <span class="recent-doc-time">${pdfCache.formatDate(pdf.timestamp)}</span>
                    </div>
                </div>
                <button class="recent-doc-menu-btn" onclick="event.stopPropagation(); toggleRecentDocMenu(${pdf.id})" title="Options">
                    <i class="ti ti-dots-vertical"></i>
                </button>
                <div class="recent-doc-menu" id="menu-${pdf.id}" style="display: none;">
                    <button onclick="deleteRecentDocument(${pdf.id})" class="menu-item menu-item-danger">
                        <i class="ti ti-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error updating recent documents:', error);
        recentDocsList.innerHTML = '<div class="recent-docs-empty">Error loading recent documents</div>';
    }
}

/**
 * Open a recent document from cache
 */
async function openRecentDocument(id) {
    try {
        const pdfRecord = await pdfCache.getPDF(id);
        if (!pdfRecord) {
            showNotification('Document not found in cache', 'error');
            return;
        }

        // Clear current state
        allUploadedFiles = [];
        tools.clearPDFs();

        // Load the cached PDF
        const arrayBuffer = pdfRecord.data;
        allUploadedFiles.push({ data: arrayBuffer, name: pdfRecord.fileName });
        tools.addPDF(arrayBuffer, pdfRecord.fileName);

        // Create document
        const doc = createDocument(arrayBuffer, pdfRecord.fileName);

        // Store cache ID for auto-save
        currentCacheId = id;

        // Show viewer area
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('viewerArea').style.display = 'flex';

        // Switch to document
        await switchToDocument(doc.id);

        showNotification(`Opened: ${pdfRecord.fileName}`, 'success');
    } catch (error) {
        console.error('Error opening recent document:', error);
        showNotification('Failed to open document: ' + error.message, 'error');
    }
}

/**
 * Toggle recent document menu
 */
function toggleRecentDocMenu(id) {
    // Close all other menus first
    document.querySelectorAll('.recent-doc-menu').forEach(menu => {
        if (menu.id !== `menu-${id}`) {
            menu.style.display = 'none';
        }
    });

    // Toggle this menu
    const menu = document.getElementById(`menu-${id}`);
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

/**
 * Delete a recent document from cache
 */
async function deleteRecentDocument(id) {
    try {
        await pdfCache.removePDF(id);
        await updateRecentDocuments();
        showNotification('Document removed from cache', 'success');
    } catch (error) {
        console.error('Error deleting document:', error);
        showNotification('Failed to delete document: ' + error.message, 'error');
    }
}

/**
 * Clear cache
 */
async function clearCache() {
    const confirmed = confirm('Are you sure you want to clear all cached documents?');
    if (!confirmed) return;

    try {
        await pdfCache.clearCache();
        await updateRecentDocuments();
        showNotification('Cache cleared successfully', 'success');
    } catch (error) {
        console.error('Error clearing cache:', error);
        showNotification('Failed to clear cache: ' + error.message, 'error');
    }
}

// Close recent doc menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.recent-doc-item')) {
        document.querySelectorAll('.recent-doc-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Initialize cache and load recent documents on startup
(async function() {
    try {
        await pdfCache.init();
        await signatureLibrary.init();
        await updateRecentDocuments();

        // Setup clear cache button
        const clearCacheBtn = document.getElementById('clearCacheBtn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', clearCache);
        }
    } catch (error) {
        console.error('Error initializing cache:', error);
    }
})();
