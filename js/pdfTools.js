/**
 * PDF Tools Module
 * Handles PDF manipulation using PDF-lib
 */

class PDFTools {
    constructor() {
        this.loadedPDFs = [];
    }

    /**
     * Store loaded PDF data
     * @param {ArrayBuffer} arrayBuffer - PDF data
     * @param {string} fileName - Original file name
     */
    addPDF(arrayBuffer, fileName) {
        this.loadedPDFs.push({
            data: arrayBuffer,
            name: fileName
        });
        console.log('PDF added to collection:', fileName);
    }

    /**
     * PROOF OF CONCEPT: Merge two or more PDF files
     * @param {Array<ArrayBuffer>} pdfArrayBuffers - Array of PDF data
     * @returns {Promise<Uint8Array>} Merged PDF as bytes
     */
    async mergePDFs(pdfArrayBuffers) {
        try {
            // Create a new PDF document
            const mergedPdf = await PDFLib.PDFDocument.create();

            // Iterate through each PDF
            for (let i = 0; i < pdfArrayBuffers.length; i++) {
                const pdfBuffer = pdfArrayBuffers[i];

                // Load the PDF
                const pdf = await PDFLib.PDFDocument.load(pdfBuffer);

                // Copy all pages from this PDF
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

                // Add each page to the merged document
                copiedPages.forEach((page) => {
                    mergedPdf.addPage(page);
                });

                console.log(`Merged PDF ${i + 1}/${pdfArrayBuffers.length}`);
            }

            // Serialize the merged PDF to bytes
            const mergedPdfBytes = await mergedPdf.save();

            console.log('PDFs merged successfully');
            return mergedPdfBytes;
        } catch (error) {
            console.error('Error merging PDFs:', error);
            throw error;
        }
    }

    /**
     * Split a PDF into individual pages
     * @param {ArrayBuffer} pdfArrayBuffer - PDF data
     * @returns {Promise<Array<Uint8Array>>} Array of single-page PDFs
     */
    async splitPDF(pdfArrayBuffer, splitAfterPage = null) {
        try {
            const pdf = await PDFLib.PDFDocument.load(pdfArrayBuffer);
            const pageCount = pdf.getPageCount();
            const splitPDFs = [];

            // If splitAfterPage is specified, split into two PDFs
            if (splitAfterPage !== null && splitAfterPage > 0 && splitAfterPage < pageCount) {
                // Create Part 1 (pages 1 to splitAfterPage)
                const pdf1 = await PDFLib.PDFDocument.create();
                const pages1 = await pdf1.copyPages(pdf, Array.from({ length: splitAfterPage }, (_, i) => i));
                pages1.forEach(page => pdf1.addPage(page));
                const pdfBytes1 = await pdf1.save();
                splitPDFs.push(pdfBytes1);

                // Create Part 2 (pages splitAfterPage+1 to end)
                const pdf2 = await PDFLib.PDFDocument.create();
                const pages2 = await pdf2.copyPages(pdf, Array.from({ length: pageCount - splitAfterPage }, (_, i) => i + splitAfterPage));
                pages2.forEach(page => pdf2.addPage(page));
                const pdfBytes2 = await pdf2.save();
                splitPDFs.push(pdfBytes2);

                console.log(`PDF split into 2 parts: Part 1 (${splitAfterPage} pages), Part 2 (${pageCount - splitAfterPage} pages)`);
            } else {
                // Default behavior: split into individual pages
                for (let i = 0; i < pageCount; i++) {
                    // Create a new document for this page
                    const newPdf = await PDFLib.PDFDocument.create();

                    // Copy the page
                    const [copiedPage] = await newPdf.copyPages(pdf, [i]);
                    newPdf.addPage(copiedPage);

                    // Save the page as a PDF
                    const pdfBytes = await newPdf.save();
                    splitPDFs.push(pdfBytes);

                    console.log(`Split page ${i + 1}/${pageCount}`);
                }

                console.log('PDF split successfully into individual pages');
            }

            return splitPDFs;
        } catch (error) {
            console.error('Error splitting PDF:', error);
            throw error;
        }
    }

    /**
     * Rotate specific pages in a PDF
     * @param {ArrayBuffer} pdfArrayBuffer - PDF data
     * @param {Array<number>} pageIndices - Pages to rotate (0-based)
     * @param {number} degrees - Rotation angle (90, 180, 270)
     * @returns {Promise<Uint8Array>} Modified PDF
     */
    async rotatePDF(pdfArrayBuffer, pageIndices, degrees) {
        try {
            const pdf = await PDFLib.PDFDocument.load(pdfArrayBuffer);

            // Validate degrees
            if (![90, 180, 270].includes(degrees)) {
                throw new Error('Rotation must be 90, 180, or 270 degrees');
            }

            // Rotate specified pages
            pageIndices.forEach(index => {
                const page = pdf.getPage(index);
                const currentRotation = page.getRotation().angle;
                page.setRotation(PDFLib.degrees(currentRotation + degrees));
            });

            const pdfBytes = await pdf.save();
            console.log('PDF rotated successfully');
            return pdfBytes;
        } catch (error) {
            console.error('Error rotating PDF:', error);
            throw error;
        }
    }

    /**
     * Compress a PDF (optimize and reduce file size)
     * @param {ArrayBuffer} pdfArrayBuffer - PDF data
     * @returns {Promise<Uint8Array>} Compressed PDF
     */
    async compressPDF(pdfArrayBuffer) {
        try {
            const pdf = await PDFLib.PDFDocument.load(pdfArrayBuffer);

            // Create a new PDF to copy into (this removes unused objects)
            const optimizedPdf = await PDFLib.PDFDocument.create();

            // Copy all pages to the new document
            const pageCount = pdf.getPageCount();
            const pageIndices = Array.from({ length: pageCount }, (_, i) => i);
            const copiedPages = await optimizedPdf.copyPages(pdf, pageIndices);

            copiedPages.forEach(page => {
                optimizedPdf.addPage(page);
            });

            // Copy metadata
            const title = pdf.getTitle();
            const author = pdf.getAuthor();
            const subject = pdf.getSubject();
            const keywords = pdf.getKeywords();

            if (title) optimizedPdf.setTitle(title);
            if (author) optimizedPdf.setAuthor(author);
            if (subject) optimizedPdf.setSubject(subject);
            if (keywords) optimizedPdf.setKeywords(keywords);

            // Save with maximum compression options
            const pdfBytes = await optimizedPdf.save({
                useObjectStreams: true,
                addDefaultPage: false,
                objectsPerTick: 50
            });

            console.log('PDF compressed/optimized successfully');
            console.log(`Original size: ${pdfArrayBuffer.byteLength} bytes, New size: ${pdfBytes.length} bytes`);
            return pdfBytes;
        } catch (error) {
            console.error('Error compressing PDF:', error);
            throw error;
        }
    }

    /**
     * Insert an image into a PDF page
     * @param {ArrayBuffer} pdfArrayBuffer - PDF data
     * @param {ArrayBuffer} imageBuffer - Image data
     * @param {string} imageType - 'png' or 'jpg'
     * @param {number} pageIndex - Page to insert image (0-based)
     * @param {Object} options - Position, size, rotation
     *   - coordsAlreadyTransformed: boolean - if true, Y coord is already in PDF space (v2.0.0)
     * @returns {Promise<Uint8Array>} Modified PDF
     */
    async insertImage(pdfArrayBuffer, imageBuffer, imageType, pageIndex, options = {}) {
        try {
            const pdf = await PDFLib.PDFDocument.load(pdfArrayBuffer);
            const page = pdf.getPage(pageIndex);
            const pageHeight = page.getHeight();

            // Embed the image
            let image;
            if (imageType === 'png') {
                image = await pdf.embedPng(imageBuffer);
            } else if (imageType === 'jpg' || imageType === 'jpeg') {
                image = await pdf.embedJpg(imageBuffer);
            } else {
                throw new Error('Unsupported image type');
            }

            // Use provided width/height or scale
            let width, height;
            if (options.width && options.height) {
                width = options.width;
                height = options.height;
            } else {
                const imageDims = image.scale(options.scale || 1);
                width = imageDims.width;
                height = imageDims.height;
            }

            // Determine Y coordinate based on whether coords are already transformed
            let pdfY;
            if (options.coordsAlreadyTransformed) {
                // v2.0.0: Coordinates already in PDF space from PNG overlay
                pdfY = options.y;
                console.log(`✅ [v2.0.0] Using pre-transformed coords: x=${options.x}, y=${pdfY}, width=${width}, height=${height}`);
            } else {
                // Legacy: Convert canvas Y coordinate (top-left origin) to PDF coordinate (bottom-left origin)
                pdfY = pageHeight - (options.y || 50) - height;
                console.log(`⚠️ [Legacy] Converting coords: x=${options.x}, canvas_y=${options.y}, pdf_y=${pdfY}, width=${width}, height=${height}`);
            }

            // Draw the image
            page.drawImage(image, {
                x: options.x || 50,
                y: pdfY,
                width: width,
                height: height,
                rotate: PDFLib.degrees(options.rotation || 0),
                opacity: options.opacity || 1
            });

            const pdfBytes = await pdf.save();
            console.log('Image inserted successfully');
            return pdfBytes;
        } catch (error) {
            console.error('Error inserting image:', error);
            throw error;
        }
    }

    /**
     * Add text annotation to a PDF
     * @param {ArrayBuffer} pdfArrayBuffer - PDF data
     * @param {number} pageIndex - Page to annotate (0-based)
     * @param {string} text - Text to add
     * @param {Object} options - Position, size, color
     * @returns {Promise<Uint8Array>} Modified PDF
     */
    async addTextAnnotation(pdfArrayBuffer, pageIndex, text, options = {}) {
        try {
            const pdf = await PDFLib.PDFDocument.load(pdfArrayBuffer);
            const page = pdf.getPage(pageIndex);
            const pageHeight = page.getHeight();

            const fontSize = options.size || 12;

            // Convert canvas Y coordinate (top-left origin) to PDF coordinate (bottom-left origin)
            // In canvas, Y increases downward; in PDF, Y increases upward
            // We need to subtract the text position AND the font size to align properly
            const pdfY = pageHeight - (options.y || 50) - fontSize;

            console.log(`Adding text: "${text}" at x=${options.x}, canvas_y=${options.y}, pdf_y=${pdfY}, size=${fontSize}`);

            // Parse color - it might be an RGB object or array
            let r = 0, g = 0, b = 0;
            if (Array.isArray(options.color)) {
                [r, g, b] = options.color;
            } else if (options.color) {
                r = options.color.r || options.color[0] || 0;
                g = options.color.g || options.color[1] || 0;
                b = options.color.b || options.color[2] || 0;
            }

            console.log(`Text color: rgb(${r}, ${g}, ${b})`);

            // Draw text
            page.drawText(text, {
                x: options.x || 50,
                y: pdfY,
                size: fontSize,
                color: PDFLib.rgb(r, g, b)
            });

            const pdfBytes = await pdf.save();
            console.log('Text annotation added successfully');
            return pdfBytes;
        } catch (error) {
            console.error('Error adding text annotation:', error);
            throw error;
        }
    }

    /**
     * Reorder pages in PDF
     * @param {ArrayBuffer} pdfArrayBuffer - PDF data
     * @param {number} fromPage - Source page (1-indexed)
     * @param {number} toPage - Target position (1-indexed)
     * @returns {Promise<Uint8Array>} Modified PDF
     */
    async reorderPages(pdfArrayBuffer, fromPage, toPage) {
        try {
            const pdf = await PDFLib.PDFDocument.load(pdfArrayBuffer);
            const totalPages = pdf.getPageCount();

            console.log(`Reordering: Move page ${fromPage} to position ${toPage} (total: ${totalPages})`);

            // Validate page numbers
            if (fromPage < 1 || fromPage > totalPages || toPage < 1 || toPage > totalPages) {
                throw new Error('Invalid page numbers');
            }

            if (fromPage === toPage) {
                return new Uint8Array(pdfArrayBuffer);
            }

            // Create new PDF with reordered pages
            const newPdf = await PDFLib.PDFDocument.create();

            // Build new page order
            const pageIndices = [];
            for (let i = 0; i < totalPages; i++) {
                pageIndices.push(i);
            }

            // Remove page from original position
            const [movedPage] = pageIndices.splice(fromPage - 1, 1);

            // Insert at new position
            pageIndices.splice(toPage - 1, 0, movedPage);

            console.log('New page order:', pageIndices.map(i => i + 1));

            // Copy pages in new order
            for (const pageIndex of pageIndices) {
                const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
                newPdf.addPage(copiedPage);
            }

            const pdfBytes = await newPdf.save();
            console.log(`Pages reordered successfully, new PDF size: ${pdfBytes.length} bytes`);

            return pdfBytes;
        } catch (error) {
            console.error('Failed to reorder pages:', error);
            throw error;
        }
    }

    /**
     * Download a PDF file
     * @param {Uint8Array} pdfBytes - PDF data
     * @param {string} fileName - File name for download
     */
    downloadPDF(pdfBytes, fileName = 'document.pdf') {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();

        URL.revokeObjectURL(url);
        console.log('PDF downloaded:', fileName);
    }

    /**
     * Clear loaded PDFs
     */
    clearPDFs() {
        this.loadedPDFs = [];
    }
}
