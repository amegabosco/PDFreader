# 🍫 Cacao 1.2.2 - Release Notes

**Date:** October 31, 2025

## 📦 What's New

### 🎯 Major Improvements

#### Transparent Loading Overlay
- Beautiful semi-transparent overlay with blur effect during PDF loading
- Real-time progress bar showing page rendering progress
- Live percentage display (0% → 100%)
- Smooth fade-in/fade-out animations
- Perfect for large multi-page documents

### 🐛 Critical Bug Fixes

#### Document Opening Position
- **Fixed:** Large documents now always open at page 1 (not page 10)
- **Cause:** Page tracking was detecting center page during render
- **Solution:** Scroll to top happens before tracking activation

#### Edit Operations
- **Fixed:** Rotation maintains current page position in scroll view
- **Fixed:** Compression maintains current page position in scroll view
- **Fixed:** Thumbnails refresh automatically after insertions

## 🔧 Technical Details

### Performance Optimizations
- Debounced zoom (150ms) prevents render lag
- Concurrent render protection
- Immediate scroll positioning (no requestAnimationFrame delay)

### Code Changes
- `renderScrollView()`: Progress tracking during render
- `setupScrollPageTracking()`: Activated after scroll positioning
- `validateAll()`: Thumbnail regeneration added
- `handleRotate()`: Uses `goToPage()` instead of `renderPage()`
- `handleCompress()`: Uses `goToPage()` instead of `renderPage()`

## 📊 Commits in This Release

1. `fix: Always start at first page on document load` (2cb55a5)
2. `feat: Add transparent loading overlay with progress bar` (6da0afb)
3. `chore: Bump version to 1.2.1` (5317133)
4. `fix: Maintain page position after rotation/compression and refresh thumbnails` (9d76550)
5. `fix: Force scroll to page 1 on document load to prevent wrong page detection` (bf75d11)
6. `chore: Bump version to 1.2.2` (39c54c4)

## 🧪 Testing

The application is served at: `http://localhost:8080`

### Test Priority
1. ✅ Large document opens at page 1
2. ✅ Loading overlay appears with progress
3. ✅ Rotation/compression maintain page position
4. ✅ Thumbnails refresh after insertion
5. ✅ Zoom is smooth without lag

## 🎨 UI/UX Enhancements

- Ultra-compact floating panels (200-280px)
- Minimal padding and spacing throughout
- Loading overlay with backdrop blur
- Real-time feedback during operations

## 📝 Known Issues

None reported.

## 🚀 Next Steps

All requested features have been implemented. The application is production-ready.

---

**Version:** 1.2.2  
**Codename:** Cacao 🍫  
**Previous Version:** 1.2.1
