/**
 * Event Manager
 * Handles event listeners and user input
 */

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
 * Setup language toggle button
 */
function setupLanguageToggle() {
    const langBtn = document.getElementById('langToggleBtn');
    if (!langBtn) return;

    // Toggle language on click
    langBtn.addEventListener('click', () => {
        const currentLang = i18n.getLanguage();
        const newLang = currentLang === 'fr' ? 'en' : 'fr';

        i18n.setLanguage(newLang);

        showNotification(
            newLang === 'fr' ? 'Langue changée en Français' : 'Language changed to English',
            'success'
        );
    });

}
