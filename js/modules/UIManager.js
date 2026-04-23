/**
 * UI Manager
 * Handles UI updates and interactions
 */

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
 * Show recent documents floating panel (displayed by default on startup)
 */
async function showRecentDocsPanel() {
    const recentDocs = await pdfCache.getRecentPDFs();

    const content = `
        <div id="recentDocsFloatingList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 500px; overflow-y: auto; overflow-x: hidden;">
            ${recentDocs.length === 0 ?
            `<div style="text-align: center; color: #999; font-size: 0.875rem; padding: 3rem 1rem;">${i18n.t('no.recent')}</div>` :
            recentDocs.map(doc => `
                    <div class="recent-doc-item" style="display: flex; align-items: center; gap: 0.875rem; padding: 12px 14px; background: var(--white); border: 2px solid #e8e8e8; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;"
                         onclick="loadFromCache('${doc.id}')"
                         onmouseenter="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 4px 12px rgba(37, 99, 235, 0.15)'; this.style.transform='translateY(-2px)';"
                         onmouseleave="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'; this.style.transform='translateY(0)';">
                        <i class="ti ti-file-type-pdf" style="font-size: 2rem; color: var(--primary); flex-shrink: 0;"></i>
                        <div style="flex: 1; min-width: 0; overflow: hidden;">
                            <div style="font-size: 0.875rem; font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;" title="${doc.fileName}">${doc.fileName}</div>
                            <div style="font-size: 0.75rem; color: #666; white-space: nowrap;">${new Date(doc.timestamp).toLocaleString(i18n.getLanguage())}</div>
                        </div>
                    </div>
                `).join('')
        }
        </div>

        ${recentDocs.length > 0 ? `
            <div style="border-top: 2px solid #e8e8e8; padding: 12px 14px; margin-top: 1rem;">
                <button class="action-btn" onclick="clearAllCache()" style="width: 100%; background-color: #EF4444; font-size: 0.875rem; padding: 10px;">
                    <i class="ti ti-trash"></i> ${i18n.t('clear.cache')}
                </button>
            </div>
        ` : ''}
    `;

    // Use FloatingPanelManager directly with unique ID
    const panel = window.FloatingPanelManager.create(
        'recent-docs',
        i18n.t('recent.documents'),
        'ti-clock-history',
        content
    );

    // Position on left side (10px from left)
    if (panel) {
        panel.style.left = '10px';
        panel.style.top = '80px';
        panel.style.minWidth = '320px';
    }
}

/**
 * Refresh the recent documents panel content
 */
async function refreshRecentDocsPanel() {
    // Check if the panel exists
    const panel = window.FloatingPanelManager?.getPanel('recent-docs');
    if (!panel) {
        return; // Panel not visible, no need to update
    }

    // Find the content container
    const contentContainer = panel.querySelector('#recentDocsFloatingList');
    if (!contentContainer) {
        return;
    }

    // Get fresh data from cache
    const recentDocs = await pdfCache.getRecentPDFs();

    // Update the content
    const newContent = `
        ${recentDocs.length === 0 ?
            `<div style="text-align: center; color: #999; font-size: 0.875rem; padding: 3rem 1rem;">${i18n.t('no.recent')}</div>` :
            recentDocs.map(doc => `
                <div class="recent-doc-item" style="display: flex; align-items: center; gap: 0.875rem; padding: 12px 14px; background: var(--white); border: 2px solid #e8e8e8; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;"
                     onclick="loadFromCache('${doc.id}')"
                     onmouseenter="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 4px 12px rgba(37, 99, 235, 0.15)'; this.style.transform='translateY(-2px)';"
                     onmouseleave="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'; this.style.transform='translateY(0)';">
                    <i class="ti ti-file-type-pdf" style="font-size: 2rem; color: var(--primary); flex-shrink: 0;"></i>
                    <div style="flex: 1; min-width: 0; overflow: hidden;">
                        <div style="font-size: 0.875rem; font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;" title="${doc.fileName}">${doc.fileName}</div>
                        <div style="font-size: 0.75rem; color: #666; white-space: nowrap;">${new Date(doc.timestamp).toLocaleString(i18n.getLanguage())}</div>
                    </div>
                </div>
            `).join('')
        }
    `;

    contentContainer.innerHTML = newContent;

    // Update the clear cache button (it's outside the main container)
    const panelContent = panel.querySelector('.floating-panel-content');
    if (panelContent) {
        // Remove old button if exists
        const oldButton = panelContent.querySelector('.action-btn');
        if (oldButton) {
            oldButton.parentElement.remove();
        }

        // Add new button if there are docs
        if (recentDocs.length > 0) {
            const buttonHTML = `
                <div style="border-top: 2px solid #e8e8e8; padding: 12px 14px; margin-top: 1rem;">
                    <button class="action-btn" onclick="clearAllCache()" style="width: 100%; background-color: #EF4444; font-size: 0.875rem; padding: 10px;">
                        <i class="ti ti-trash"></i> ${i18n.t('clear.cache')}
                    </button>
                </div>
            `;
            panelContent.insertAdjacentHTML('beforeend', buttonHTML);
        }
    }
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
 * Enable tool buttons when a PDF is loaded
 */
function enableToolButtons() {
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(button => {
        button.removeAttribute('disabled');
    });
}
