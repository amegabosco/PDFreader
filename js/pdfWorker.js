/**
 * PDF Worker - Background processing for heavy PDF operations
 * Runs in separate thread to avoid blocking UI
 */

// Import PDF-lib in worker context
importScripts('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');

const { PDFDocument, rgb, degrees } = PDFLib;

/**
 * Handle messages from main thread
 */
self.addEventListener('message', async (e) => {
    const { id, operation, data } = e.data;

    try {
        let result;

        switch (operation) {
            case 'merge':
                result = await mergePDFs(data);
                break;
            case 'split':
                result = await splitPDF(data);
                break;
            case 'rotate':
                result = await rotatePDF(data);
                break;
            case 'reorder':
                result = await reorderPDF(data);
                break;
            case 'compress':
                result = await compressPDF(data);
                break;
            case 'insertObjects':
                result = await insertObjects(data);
                break;
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }

        // Send success response with zero-copy transfer
        if (Array.isArray(result)) {
            // split returns an array of Uint8Array
            const transferables = result.map(r => r.buffer);
            self.postMessage({ id, success: true, result }, transferables);
        } else if (result && result.buffer instanceof ArrayBuffer) {
            // Single Uint8Array (merge, rotate, reorder, compress, insertObjects)
            self.postMessage({ id, success: true, result }, [result.buffer]);
        } else {
            self.postMessage({ id, success: true, result });
        }

    } catch (error) {
        // Send error response
        self.postMessage({
            id,
            success: false,
            error: error.message
        });
    }
});

/**
 * Merge multiple PDFs
 */
async function mergePDFs(data) {
    const { pdfs } = data; // Array of ArrayBuffers

    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < pdfs.length; i++) {
        const pdf = await PDFDocument.load(pdfs[i]);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

        for (const page of pages) {
            mergedPdf.addPage(page);
        }

        // Report progress
        self.postMessage({
            progress: ((i + 1) / pdfs.length) * 100,
            message: `Merging document ${i + 1} of ${pdfs.length}...`
        });
    }

    const mergedBytes = await mergedPdf.save();
    return mergedBytes;
}

/**
 * Split PDF into individual pages or ranges
 */
async function splitPDF(data) {
    const { pdfData, splitAt } = data; // splitAt is page number or array of page numbers

    const pdf = await PDFDocument.load(pdfData);
    const totalPages = pdf.getPageCount();
    const results = [];

    if (Array.isArray(splitAt)) {
        // Split at multiple points
        let startPage = 0;
        for (let i = 0; i < splitAt.length; i++) {
            const endPage = splitAt[i];
            const newPdf = await PDFDocument.create();

            const pages = await newPdf.copyPages(pdf, Array.from(
                { length: endPage - startPage },
                (_, k) => startPage + k
            ));

            for (const page of pages) {
                newPdf.addPage(page);
            }

            const bytes = await newPdf.save();
            results.push(bytes);
            startPage = endPage;

            // Report progress
            self.postMessage({
                progress: ((i + 1) / splitAt.length) * 100,
                message: `Creating split ${i + 1} of ${splitAt.length}...`
            });
        }

        // Add remaining pages
        if (startPage < totalPages) {
            const newPdf = await PDFDocument.create();
            const pages = await newPdf.copyPages(pdf, Array.from(
                { length: totalPages - startPage },
                (_, k) => startPage + k
            ));
            for (const page of pages) {
                newPdf.addPage(page);
            }
            const bytes = await newPdf.save();
            results.push(bytes);
        }
    } else {
        // Split into two parts at single page
        const firstPdf = await PDFDocument.create();
        const secondPdf = await PDFDocument.create();

        const firstPages = await firstPdf.copyPages(pdf, Array.from(
            { length: splitAt },
            (_, i) => i
        ));
        const secondPages = await secondPdf.copyPages(pdf, Array.from(
            { length: totalPages - splitAt },
            (_, i) => splitAt + i
        ));

        for (const page of firstPages) {
            firstPdf.addPage(page);
        }
        for (const page of secondPages) {
            secondPdf.addPage(page);
        }

        results.push(await firstPdf.save());
        results.push(await secondPdf.save());
    }

    return results;
}

/**
 * Rotate pages in PDF
 */
async function rotatePDF(data) {
    const { pdfData, pageIndices, rotation } = data; // rotation: 90, 180, 270

    const pdf = await PDFDocument.load(pdfData);
    const pages = pdf.getPages();

    const indicesToRotate = pageIndices || pages.map((_, i) => i);

    for (let i = 0; i < indicesToRotate.length; i++) {
        const pageIndex = indicesToRotate[i];
        const page = pages[pageIndex];

        // Get current rotation and add new rotation
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees(currentRotation + rotation));

        // Report progress
        if (i % 10 === 0 || i === indicesToRotate.length - 1) {
            self.postMessage({
                progress: ((i + 1) / indicesToRotate.length) * 100,
                message: `Rotating page ${i + 1} of ${indicesToRotate.length}...`
            });
        }
    }

    const rotatedBytes = await pdf.save();
    return rotatedBytes;
}

/**
 * Reorder pages in PDF
 */
async function reorderPDF(data) {
    const { pdfData, fromPage, toPage } = data; // 1-indexed

    const pdf = await PDFDocument.load(pdfData);
    const totalPages = pdf.getPageCount();

    // Validate
    if (fromPage < 1 || fromPage > totalPages || toPage < 1 || toPage > totalPages) {
        throw new Error('Invalid page numbers');
    }

    if (fromPage === toPage) {
        return await pdf.save();
    }

    // Create new PDF with reordered pages
    const newPdf = await PDFDocument.create();

    // Build new page order
    const pageIndices = Array.from({ length: totalPages }, (_, i) => i);

    // Remove page from original position
    const [movedPageIndex] = pageIndices.splice(fromPage - 1, 1);

    // Insert at new position
    pageIndices.splice(toPage - 1, 0, movedPageIndex);

    // Copy pages in new order
    for (let i = 0; i < pageIndices.length; i++) {
        const [copiedPage] = await newPdf.copyPages(pdf, [pageIndices[i]]);
        newPdf.addPage(copiedPage);

        // Report progress
        if (i % 5 === 0 || i === pageIndices.length - 1) {
            self.postMessage({
                progress: ((i + 1) / pageIndices.length) * 100,
                message: `Reordering pages... ${i + 1}/${pageIndices.length}`
            });
        }
    }

    const reorderedBytes = await newPdf.save();
    return reorderedBytes;
}

/**
 * Compress PDF (basic optimization)
 */
async function compressPDF(data) {
    const { pdfData } = data;

    const pdf = await PDFDocument.load(pdfData);

    // Save with compression options
    const compressedBytes = await pdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50
    });

    const originalSize = pdfData.byteLength;
    const compressedSize = compressedBytes.byteLength;
    const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

    self.postMessage({
        progress: 100,
        message: `Compressed: ${reduction}% reduction`
    });

    return compressedBytes;
}

/**
 * Insert multiple objects (text, images, signatures) into PDF
 */
async function insertObjects(data) {
    const { pdfData, objects } = data;

    const pdf = await PDFDocument.load(pdfData);
    const pages = pdf.getPages();
    const totalObjects = objects.length;

    for (let i = 0; i < totalObjects; i++) {
        const obj = objects[i];
        const pageIndex = obj.pageIndex;
        
        if (pageIndex < 0 || pageIndex >= pages.length) {
            console.warn(`Invalid page index ${pageIndex}, skipping object`);
            continue;
        }

        const page = pages[pageIndex];
        // pageHeight is not strictly needed unless we were doing coord conversion here, 
        // but we expect coords to be passed in PDF space.

        // Report progress
        if (i % 5 === 0 || i === totalObjects - 1) {
            self.postMessage({
                progress: ((i + 1) / totalObjects) * 100,
                message: `Inserting object ${i + 1} of ${totalObjects}...`
            });
        }

        try {
            if (obj.type === 'image' || obj.type === 'signature') {
                // Embed image
                let image;
                if (obj.imageType === 'png') {
                    image = await pdf.embedPng(obj.imageData);
                } else if (obj.imageType === 'jpg' || obj.imageType === 'jpeg') {
                    image = await pdf.embedJpg(obj.imageData);
                } else {
                    console.warn('Unsupported image type:', obj.imageType);
                    continue;
                }

                // Draw image
                page.drawImage(image, {
                    x: obj.x,
                    y: obj.y,
                    width: obj.width,
                    height: obj.height,
                    rotate: degrees(obj.rotation || 0),
                    opacity: obj.opacity || 1
                });

            } else if (obj.type === 'text') {
                // Draw text
                const { text, fontSize, color } = obj;
                
                // Parse color
                let r = 0, g = 0, b = 0;
                if (color) {
                    r = color.r || color[0] || 0;
                    g = color.g || color[1] || 0;
                    b = color.b || color[2] || 0;
                }

                page.drawText(text, {
                    x: obj.x,
                    y: obj.y,
                    size: fontSize,
                    color: rgb(r, g, b)
                });
            }
        } catch (err) {
            console.error(`Error inserting object ${i}:`, err);
        }
    }

    const pdfBytes = await pdf.save();
    return pdfBytes;
}
