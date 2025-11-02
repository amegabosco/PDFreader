/**
 * Floating Panel Manager
 * Creates draggable floating panels for tool interfaces
 */

class FloatingPanel {
    constructor(title, icon) {
        this.title = title;
        this.icon = icon;
        this.panel = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isMinimized = false;
    }

    /**
     * Create and show the floating panel
     */
    create(content) {
        // Remove existing panel if any
        if (this.panel) {
            this.panel.remove();
        }

        // Create panel element
        this.panel = document.createElement('div');
        this.panel.className = 'floating-panel';

        // Create header
        const header = document.createElement('div');
        header.className = 'floating-panel-header';
        header.innerHTML = `
            <div class="floating-panel-title">
                <i class="ti ${this.icon}"></i>
                <span>${this.title}</span>
            </div>
            <div class="floating-panel-controls">
                <button class="floating-panel-btn minimize-btn" title="Minimize">
                    <i class="ti ti-minus"></i>
                </button>
                <button class="floating-panel-btn close-btn" title="Close">
                    <i class="ti ti-x"></i>
                </button>
            </div>
        `;

        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'floating-panel-content';
        if (typeof content === 'string') {
            contentContainer.innerHTML = content;
        } else {
            contentContainer.appendChild(content);
        }

        // Assemble panel
        this.panel.appendChild(header);
        this.panel.appendChild(contentContainer);

        // Add to document
        document.body.appendChild(this.panel);

        // Center panel on screen
        this.center();

        // Setup interactions
        this.setupDrag(header);
        this.setupControls(header);

        // Animate in
        setTimeout(() => {
            this.panel.classList.add('show');
        }, 10);

        return this.panel;
    }

    /**
     * Center panel on screen (aligned with recent documents sidebar)
     */
    center() {
        const rect = this.panel.getBoundingClientRect();

        // Align left edge with the recent documents section (sidebar width = 280px)
        const sidebarWidth = 280;
        const x = sidebarWidth + 20; // 20px padding from sidebar edge
        const y = Math.max(60, (window.innerHeight - rect.height) / 2 - 40); // Offset from top

        this.panel.style.left = x + 'px';
        this.panel.style.top = y + 'px';
    }

    /**
     * Setup drag functionality
     */
    setupDrag(header) {
        header.style.cursor = 'move';

        header.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on a button
            if (e.target.closest('button')) return;

            this.isDragging = true;
            const rect = this.panel.getBoundingClientRect();
            this.dragOffset.x = e.clientX - rect.left;
            this.dragOffset.y = e.clientY - rect.top;

            this.panel.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;

            // Keep panel within viewport
            const rect = this.panel.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;

            this.panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            this.panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.panel.classList.remove('dragging');
            }
        });
    }

    /**
     * Setup panel controls (minimize, close)
     */
    setupControls(header) {
        const minimizeBtn = header.querySelector('.minimize-btn');
        const closeBtn = header.querySelector('.close-btn');
        const content = this.panel.querySelector('.floating-panel-content');

        minimizeBtn.addEventListener('click', () => {
            this.isMinimized = !this.isMinimized;

            if (this.isMinimized) {
                content.style.display = 'none';
                minimizeBtn.innerHTML = '<i class="ti ti-plus"></i>';
                minimizeBtn.title = 'Expand';
            } else {
                content.style.display = 'block';
                minimizeBtn.innerHTML = '<i class="ti ti-minus"></i>';
                minimizeBtn.title = 'Minimize';
            }
        });

        closeBtn.addEventListener('click', () => {
            this.close();
        });
    }

    /**
     * Close and remove panel
     */
    close() {
        if (this.panel) {
            this.panel.classList.remove('show');
            setTimeout(() => {
                if (this.panel && this.panel.parentNode) {
                    this.panel.remove();
                }
                this.panel = null;
            }, 200);
        }
    }

    /**
     * Get panel element
     */
    getPanel() {
        return this.panel;
    }

    /**
     * Check if panel is open
     */
    isOpen() {
        return this.panel !== null && this.panel.parentNode;
    }
}

// Global instance manager
window.FloatingPanelManager = {
    panels: {},

    create(id, title, icon, content) {
        // Close existing panel with same ID
        if (this.panels[id]) {
            this.panels[id].close();
        }

        // Create new panel
        const panel = new FloatingPanel(title, icon);
        panel.create(content);
        this.panels[id] = panel;

        return panel;
    },

    close(id) {
        if (this.panels[id]) {
            this.panels[id].close();
            delete this.panels[id];
        }
    },

    closeAll() {
        Object.keys(this.panels).forEach(id => {
            this.close(id);
        });
    }
};
