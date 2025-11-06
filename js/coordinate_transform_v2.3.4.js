/**
 * SIMPLIFIED COORDINATE TRANSFORMATION v2.3.4
 *
 * Goal: Map box drawn on PNG preview to correct position in PDF
 *
 * Coordinate Spaces:
 * 1. Screen (CSS): Where user draws the box
 * 2. Canvas: PNG canvas rendered by PDF.js (with rotation applied)
 * 3. PDF: pdf-lib coordinate system (NO rotation, bottom-left origin)
 */

async function transformCoordinates_v234(boxOnScreen, pngCanvas, pageRotation, currentPDFData, pageNumber) {
    console.log('=== COORDINATE TRANSFORMATION v2.3.4 ===');

    // STEP 1: Get all dimensions
    const screenW = pngCanvas.offsetWidth;
    const screenH = pngCanvas.offsetHeight;
    const canvasW = pngCanvas.width;
    const canvasH = pngCanvas.height;

    console.log('Screen (displayed):', { w: screenW, h: screenH });
    console.log('Canvas (pixels):', { w: canvasW, h: canvasH });
    console.log('Rotation:', pageRotation, '°');

    // STEP 2: Convert screen to canvas coordinates
    const scaleX = canvasW / screenW;
    const scaleY = canvasH / screenH;

    const cx = boxOnScreen.x * scaleX;
    const cy = boxOnScreen.y * scaleY;
    const cw = boxOnScreen.width * scaleX;
    const ch = boxOnScreen.height * scaleY;

    console.log('Canvas coords:', { x: cx, y: cy, w: cw, h: ch });

    // STEP 3: Get PDF dimensions (unrotated)
    const pdfDoc = await PDFLib.PDFDocument.load(currentPDFData);
    const page = pdfDoc.getPage(pageNumber - 1);
    const pdfW = page.getWidth();
    const pdfH = page.getHeight();

    console.log('PDF (unrotated):', { w: pdfW, h: pdfH });

    // STEP 4: Transform based on rotation
    // Key: Canvas shows ROTATED view, PDF uses UNROTATED coordinates

    let pdfX, pdfY, pdfBoxW, pdfBoxH;
    const rot = ((pageRotation || 0) % 360 + 360) % 360;

    if (rot === 0) {
        // NO ROTATION
        // Direct mapping with Y-flip (canvas top-left → PDF bottom-left)
        const ratioX = pdfW / canvasW;
        const ratioY = pdfH / canvasH;

        pdfX = cx * ratioX;
        pdfY = (canvasH - cy - ch) * ratioY;  // Y-flip
        pdfBoxW = cw * ratioX;
        pdfBoxH = ch * ratioY;

    } else if (rot === 90) {
        // 90° CLOCKWISE
        // Canvas dimensions are swapped (width ↔ height)
        // Mapping: canvas(x,y) → pdf(canvasH-y-h, x)
        const ratioX = pdfW / canvasH;  // Note: pdfW maps to canvasH
        const ratioY = pdfH / canvasW;  // Note: pdfH maps to canvasW

        pdfX = (canvasH - cy - ch) * ratioX;
        pdfY = cx * ratioY;
        pdfBoxW = ch * ratioX;
        pdfBoxH = cw * ratioY;

    } else if (rot === 180) {
        // 180° ROTATION
        // Both axes flipped
        const ratioX = pdfW / canvasW;
        const ratioY = pdfH / canvasH;

        pdfX = (canvasW - cx - cw) * ratioX;
        pdfY = cy * ratioY;
        pdfBoxW = cw * ratioX;
        pdfBoxH = ch * ratioY;

    } else if (rot === 270) {
        // 270° COUNTER-CLOCKWISE
        // Canvas dimensions are swapped
        // Mapping: canvas(x,y) → pdf(y, canvasW-x-w)
        const ratioX = pdfW / canvasH;
        const ratioY = pdfH / canvasW;

        pdfX = cy * ratioX;
        pdfY = (canvasW - cx - cw) * ratioY;
        pdfBoxW = ch * ratioX;
        pdfBoxH = cw * ratioY;

    } else {
        console.warn('Unsupported rotation:', rot);
        const ratioX = pdfW / canvasW;
        const ratioY = pdfH / canvasH;
        pdfX = cx * ratioX;
        pdfY = (canvasH - cy - ch) * ratioY;
        pdfBoxW = cw * ratioX;
        pdfBoxH = ch * ratioY;
    }

    const result = { x: pdfX, y: pdfY, width: pdfBoxW, height: pdfBoxH };
    console.log('✅ PDF coords:', result);

    return result;
}
