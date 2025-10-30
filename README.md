# PDF Power-Tool

A minimalist, client-side JavaScript PDF reader and editor. All operations happen locally in your browser with zero server-side processing.

## Features

- **View PDFs**: Powered by PDF.js for reliable rendering
- **Merge PDFs**: Combine multiple PDF documents into one
- **Split PDFs**: Extract individual pages as separate files
- **Rotate Pages**: Rotate pages by 90, 180, or 270 degrees
- **Compress**: Optimize PDF file size
- **Insert Images**: Add images (PNG, JPG) to PDF pages
- **Annotate**: Add text annotations and shapes
- **Sign**: Add digital signatures

## Technology Stack

- **HTML5, CSS3, Vanilla JavaScript** - Pure client-side application
- **PDF.js** - Mozilla's PDF rendering engine
- **PDF-lib** - PDF creation and modification
- **Tabler Icons** - Complete icon set

## Design Philosophy

- **Minimalist**: 3-color flat design palette
- **Client-Side**: All processing happens in your browser
- **Privacy**: Your files never leave your computer
- **Modern**: Clean, intuitive interface with generous whitespace

## Color Palette

- **Primary**: `#3B82F6` (Bright Blue)
- **Background**: `#F8FAFC` (Light Gray)
- **Text**: `#1E293B` (Dark Slate)

## Getting Started

1. Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge)
2. Drag and drop a PDF file or click to browse
3. Use the sidebar tools to manipulate your PDF
4. Download the modified result

## File Structure

```
PDFreader/
├── index.html          # Main application page
├── css/
│   └── style.css       # Minimalist styles
├── js/
│   ├── app.js          # Main application logic
│   ├── pdfViewer.js    # PDF.js viewer wrapper
│   └── pdfTools.js     # PDF-lib manipulation tools
└── README.md
```

## Browser Compatibility

Works in all modern browsers that support:
- FileReader API
- Canvas API
- ES6+ JavaScript
- PDF.js and PDF-lib libraries

## Development

No build process required. Simply open `index.html` in your browser to start developing.

## Demo Functions

### Merge PDFs (Proof of Concept)

```javascript
const tools = new PDFTools();

// Load multiple PDFs
tools.addPDF(arrayBuffer1, 'file1.pdf');
tools.addPDF(arrayBuffer2, 'file2.pdf');

// Merge them
const mergedPDF = await tools.mergePDFs([arrayBuffer1, arrayBuffer2]);

// Download result
tools.downloadPDF(mergedPDF, 'merged.pdf');
```

### Split PDF

```javascript
const splitPDFs = await tools.splitPDF(arrayBuffer);
// Returns array of single-page PDFs
```

### Rotate Pages

```javascript
const rotatedPDF = await tools.rotatePDF(
    arrayBuffer,
    [0, 1, 2], // pages to rotate
    90 // degrees
);
```

## License

MIT License - Feel free to use and modify

## Contributing

This is a proof-of-concept project. Contributions welcome!
