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
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }

        // Send success response
        self.postMessage({
            id,
            success: true,
            result
        });

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

    console.log(`Worker: Reordering page ${fromPage} to position ${toPage} (total: ${totalPages})`);

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

    console.log('Worker: New page order:', pageIndices.map(i => i + 1));

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

console.log('PDF Worker initialized');
