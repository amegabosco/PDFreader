# 📝 Changelog - PDF Power-Tool

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with fun codenames!

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
  - Info bar with document stats
  - Pending objects system (validate all)
  - Web Workers for heavy operations

- **UI/UX**
  - Minimalist flat design
  - 3-color palette (Blue, Gray, Black)
  - Tabler Icons throughout
  - Smooth animations
  - Responsive notifications
  - Keyboard shortcuts

- **Technical**
  - 100% client-side (no server)
  - PDF.js for rendering
  - PDF-lib for manipulation
  - IndexedDB for caching
  - Web Workers for performance
  - File System Access API

---

## Version History Summary

| Version | Date | Codename | Major Features |
|---------|------|----------|----------------|
| 1.0.0 | 2025-10-31 | Cacao 🍫 | Mouse wheel nav, Floating panels, UI refactor |
| 1.0.0 | 2025-10-30 | Banane 🍌 | Initial release, All core features |

---

## Upcoming Versions

### [Cacao 1.1.0] - Planned
- Migrate all tool panels to FloatingPanel system
- Comprehensive button testing
- Additional performance optimizations
- Bug fixes from user feedback

### [Datte 1.0.0] - Future
- Password-protected PDF support
- Bookmarks/outline navigation
- Virtual scrolling for large documents
- Export pages as images
- Watermark functionality

---

## Development Stats

### Cacao 1.0.0
- **Commits**: 15 new commits
- **Files changed**: 12
- **Lines added**: 847
- **Lines removed**: 3,821 (cleanup!)
- **New features**: 6
- **Bug fixes**: 5
- **Performance improvements**: 3

### Banane 1.0.0
- **Commits**: 40 initial commits
- **Total features**: 15
- **Files created**: 10 JavaScript modules
- **CSS lines**: ~1,500
- **Total functionality**: Complete PDF toolkit

---

**Note**: This project follows a fun versioning scheme where each major version gets a fruit or emoji codename. We don't take ourselves too seriously, but we take our code seriously! 🚀

**Developed with 🚀 by Yao 🇹🇬**
