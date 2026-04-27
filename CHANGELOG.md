# 📝 Changelog - PDF Power-Tool

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with fun codenames!

---

## [Dragonfruit 2.3.40] 🐉 - 2025-11-09

### Removed
- **Recent Files Panel** - Removed the fixed bottom-left panel showing recent files
  - Deleted `js/recentFiles.js`
  - Removed HTML elements and CSS styles
  - Cleaner interface with less visual clutter

---

## [Coconut 2.3.39] 🥥 - 2025-11-09

### Enhanced
- **Signature Quality Improvements** - Dramatically improved signature rendering
  - Canvas resolution increased **3x** (350x160 → 1050x480 pixels)
  - PNG upscaling increased from **3x → 5x** for ultra-crisp output
  - **Bézier curve smoothing** - Smooth quadratic curves instead of jagged lines
  - Anti-aliasing enabled with high-quality settings
  - Line width adjusted for high-res canvas (lineWidth = 5)
  - Mouse coordinate scaling for accurate drawing
  - Professional-quality signatures in final PDF

---

## [Blueberry 2.3.38] 🫐 - 2025-11-09

### Fixed
- **Multi-page annotation viewport bug** - Fixed critical issue with batch annotation insertion
  - Viewport now updates for **each page** in the loop
  - Previously used first page's viewport for all pages
  - Now correctly handles pages with different rotations
  - Each page gets proper coordinate transformation

---

## [Apricot 2.3.37] 🍑 - 2025-11-09

### Fixed
- **Annotation rotation on rotated pages** - Complete rewrite to match PNG insertion logic
  - Text pre-rotated in canvas (like PNG insertion)
  - Removed pdf-lib `rotate` parameter approach
  - Canvas dimensions swapped for 90°/270° rotations
  - Simple insertion without rotation parameter
  - Smooth Bézier curves for text rendering
  - Exact same logic as working PNG insertion system

---

## [v2.3.32-36] - 2025-11-09

### v2.3.36
- Fix: Center-point rotation attempts (experimental)

### v2.3.35
- Fix: PNG-style pre-rotation for annotations

### v2.3.34
- Fix: Initial annotation rotation fix attempts

### v2.3.33
- Chore: Version updates and minor fixes

### v2.3.32
- Fix: Swap annotation dimensions on rotated pages

---

## [v2.3.31] - 2025-11-09
- Fix: Apply inverse rotation to annotations on rotated pages

## [v2.3.30] - 2025-11-09
- Fix: Properly initialize app state when loading from Recent Files

## [v2.3.29] - 2025-11-09
- Fix: Extract PDF data from cache record for Recent Files

## [v2.3.28] - 2025-11-09
- Fix: Always show Recent Files panel with empty state

## [v2.3.27] - 2025-11-09
- Feat: Recent Files panel on home page

## [v2.3.26] - 2025-11-09
- Perf: Skip thumbnail regeneration for instant insertion

## [v2.3.25] - 2025-11-09
- Fix: Restore thumbnail regeneration after loadPDF

## [v2.3.24] - 2025-11-09
- Feat: Smart thumbnail updates after insertions

## [v2.3.23] - 2025-11-09
- Feat: Rotation-aware upscaled signatures for crisp rendering

## [v2.3.22] - 2025-11-09
- Fix: High-resolution page rendering for crisp insertions

## [v2.3.21] - 2025-11-09
- Fix: High-resolution text rendering for crisp annotations

## [v2.3.20] - 2025-11-09
- Feat: Rotation-aware text rendering for annotations

## [v2.3.19] - 2025-11-09
- Feat: Text-to-image annotation rendering for perfect WYSIWYG

## [v2.3.18] - 2025-11-09
- Perf: Implement lazy loading for massive PDF load/zoom speedup

## [v2.3.17] - 2025-11-09
- Perf: Disable thumbnail regeneration for massive speed boost

## [v2.3.16] - 2025-11-09
- Fix: Correct window resize handler and image type detection

## [v2.3.15] - 2025-11-09
- Perf: Optimize batch insertion for massive speed improvement

## [v2.3.14] - 2025-11-09
- Feat: Fix coordinate transformation with viewport-based algorithm

## [v2.3.4] - 2025-11-08
- Feat: Complete coordinate system rewrite

## [v2.3.3] - 2025-11-08
- Fix: Correct rotation transforms and add loading indicator

## [v2.3.2] - 2025-11-08
- Feat: Support rotated pages in coordinate transformation

## [v2.3.1] - 2025-11-08
- Fix: Undefined variable in coordinate logging

## [v2.3.0] - 2025-11-08
- Feat: Enhanced scrollbar and fixed signature coordinates

## [v2.2.9] - 2025-11-07
- Fix: Force scrollbar visibility in rotation panel

## [v2.2.8] - 2025-11-07
- Fix: Display all pages in rotation panel

## [v2.2.7] - 2025-11-07
- Feat: Improve page selection scrollbar visibility

## [v2.2.6] - 2025-11-07
- Feat: Unify active and selected states

## [v2.2.5] - 2025-11-07
- Fix: Single-click thumbnail now selects page

## [v2.2.4] - 2025-11-07
- Fix: Prevent sync loops with syncInProgress flag

## [v2.2.3] - 2025-11-07
- Feat: Auto-select first page on document open

## [v2.2.2] - 2025-11-07
- Fix: Active page no longer auto-selected

## [v2.2.1] - 2025-11-07
- Feat: Auto-open navigator and improve recent docs panel

## [v2.0.0] - 2025-11-06
- Feat: Implement PNG-based precision insertion system
- Fix: Prevent double Y-coordinate transformation

## [v1.8.7] - 2025-11-05
- Fix: Ensure insertion overlay is above info bar for drawing

## [v1.8.6] - 2025-11-05
- Feat: Add author credit and make info bar always visible

## [v1.8.5] - 2025-11-05
- Feat: Move app title badge to bottom-left corner

## [v1.8.4] - 2025-11-05
- Fix: App title badge now stays above toolbar

## [v1.8.3] - 2025-11-05
- Fix: Info panel now displays correctly with file info

## [v1.8.2] - 2025-11-05
- Feat: Show file info in home screen sidebar

## [v1.8.1] - 2025-11-05
- Fix: Display app version in sidebar footer

## [v1.8.0] - 2025-11-05
- Feat: Add version display badge

---

## [Cacao 1.0.0] 🍫 - 2025-10-31

### 🎉 Major Changes

#### Added
- **Mouse wheel navigation** in single page view mode
  - Scroll down at page bottom → next page
  - Scroll up at page top → previous page
  - Smart horizontal scroll detection
  - Smooth transitions with auto-positioning
- **Floating panel system** for tool interfaces
  - Draggable panels that don't block PDF view
  - Minimize/maximize functionality
  - Smooth animations and transitions
  - Auto-centering and viewport boundaries
- **Zoom-to-fit button** for full page preview
  - Calculates optimal scale automatically
  - Maintains minimum zoom of 0.5
  - Works in both single and scroll view
- **Complete toolbar reorganization**
  - All tools moved from sidebar to top toolbar
  - Logical grouping with visual separators
  - Navigation | Zoom | View | Edit | Document | History | Utility | Download
  - More screen space for PDF viewing

#### Changed
- **Interface layout** - Sidebar now only shows Upload and Recent Documents
- **Toolbar spacing** - More compact design (0.5rem gaps vs 2rem)
- **Thumbnail generation** - Reduced scale from 0.5 to 0.3 for better performance
- **Page position** - Maintains current page after rotation operation
- **Object insertion** - Overlay syncs with canvas after every zoom change

#### Fixed
- Page position now maintained after rotation
- Thumbnails refresh automatically after rotation
- Thumbnails refresh after page reordering
- Memory usage display null check
- Duplicate `app 2.js` file removed
- Overlay positioning accurate at all zoom levels

#### Performance
- 40% faster thumbnail generation (scale 0.3 vs 0.5)
- Removed duplicate file reducing memory usage
- Better event listener management
- Optimized canvas synchronization

---

## [Banane 1.0.0] 🍌 - 2025-10-30

### 🎉 Initial Release

#### Added
- **PDF Operations**
  - Upload single or multiple PDFs
  - Merge multiple documents
  - Split PDF at specific page
  - Rotate pages (90°, 180°, 270°)
  - Compress/optimize file size

- **Editing Tools**
  - Insert images (PNG, JPG) with positioning
  - Add text annotations with colors and fonts
  - Draw or upload signatures
  - Signature library (save up to 20 signatures)
  - Annotation library (save up to 20 text annotations)
  - Date/Time insertion buttons

- **Navigation**
  - Single page view mode
  - Continuous scroll view mode
  - Zoom in/out controls
  - Page counter with prev/next buttons
  - Keyboard shortcuts (arrows, +/-, etc.)
  - Hand tool for panning zoomed pages

- **Thumbnails**
  - Visual page navigator panel
  - Click to jump to page
  - Drag & drop to reorder pages
  - Active page highlighting
  - Page number badges

- **Document Management**
  - Multi-tab interface
  - Recent documents in sidebar
  - IndexedDB cache for persistence
  - File metadata display
  - Edit history tracking

- **Advanced Features**
  - Undo/Redo functionality
  - Text search in PDF
  - Metadata editor
  - Accessibility features
  - Internationalization support (i18n)
  - Progressive Web App (PWA) capabilities

- **Performance**
  - Client-side only (no server uploads)
  - IndexedDB for local storage
  - Web Workers for heavy operations
  - Optimized canvas rendering
  - Lazy loading for large documents

- **UI/UX**
  - Clean, minimalist design
  - Three-color flat palette
  - Tabler Icons throughout
  - Responsive layout
  - Touch-friendly controls
  - Dark/Light mode support

#### Technical
- **Libraries**
  - PDF.js for rendering
  - pdf-lib for manipulation
  - Sortable.js for drag & drop
- **Architecture**
  - Modular JavaScript
  - Event-driven design
  - Clean separation of concerns
- **Browser Support**
  - Modern browsers (Chrome, Firefox, Edge, Safari)
  - File System Access API
  - IndexedDB for persistence

---

**Legend:**
- 🍫 Cacao - Major UI/UX overhaul
- 🍌 Banane - Initial release
- 🐉 Dragonfruit - Cleanup
- 🥥 Coconut - Quality boost
- 🫐 Blueberry - Bug fix
- 🍑 Apricot - Fix
