# 🚀 Project Kickoff: Minimalist, Client-Side JavaScript PDF Power-Tool

## 🎯 **Goal**

Develop a **single-page, client-side JavaScript PDF Reader/Editor** application. All file operations must occur **locally in the user's browser memory** (using technologies like the File System Access API and IndexedDB/localStorage for temporary session management, but **NO server-side processing**).

## ✨ **Design and User Experience (UX)**

The interface must adhere to a strict **modern, minimalist, and flat design** aesthetic.

* **Color Palette:** Strictly limited to **a maximum of 3 main flat colors** (e.g., a primary accent color, a background/surface color, and a text/icon color).
* **Iconography:** Use **Tabler Icons** exclusively for all UI elements.
* **Layout:** Clean, intuitive, and heavily utilizing **whitespace** to enhance focus and scannability. Use a modern, readable sans-serif font.
* **User Flow:** A clear, step-by-step workflow (Upload -> Select Action -> Process/View -> Download).

## 🛠️ **Core Technology Stack**

* **Language/Environment:** Pure HTML5, CSS3, and Vanilla JavaScript (or a lightweight modern framework like Vue/React if it simplifies the component structure, but the primary focus is client-side performance).
* **Core Libraries:**
    * **PDF-lib:** For all creation and modification tasks (Split, Merge, Rotate, Compress, Sign, Annotate, Image Insertion).
    * **PDF.js (Mozilla):** For robust and reliable PDF rendering and viewing.
    * **Tabler Icons:** For the entire icon set.

## ⚙️ **Required Functionality**

The application must implement the following PDF manipulation features, all operating client-side:

### **1. Core File Handling**

* **Load:** Allow users to open one or more PDF files via drag-and-drop or a file selector. Files are held in browser memory (`ArrayBuffer` or similar).
* **Read/View:** Display the loaded PDF using PDF.js.
* **Download:** Export the modified PDF as a new file.

### **2. Manipulation Tools (PDF-lib focus)**

* **Split:** Split a single PDF into multiple documents (e.g., split by page range or every single page).
* **Merge:** Combine multiple loaded PDF documents into a single new document.
* **Rotate Pages:** Rotate selected pages (or the entire document) by $90^{\circ}$, $180^{\circ}$, or $270^{\circ}$ increments.
* **Compress:** Implement a simple compression/optimization step (e.g., image quality reduction) using PDF-lib features.
* **Insert Image:** Allow a user to upload an image file (JPEG, PNG) and insert it onto a specific page. This tool requires the following sub-features:
    * **Scaling:** Adjust the image size.
    * **Cropping:** Crop the image before placement.
    * **Rotation:** Rotate the image on the canvas.
    * **Transparency:** Support for transparent PNGs.
* **Annotate:** Basic annotation capabilities (e.g., adding text boxes or simple shapes).
* **Sign:** A simple digital signature feature (e.g., drawing a signature with the mouse/touchpad or uploading a signature image and placing it).

## **❓ Specific Questions for the AI**

1.  Provide the **initial file structure** for the project (`index.html`, `style.css`, `app.js`, etc.).
2.  Generate the **basic HTML structure** for the minimalistic interface, including an area for the PDF viewer, a sidebar/menu for the tools, and a file upload area.
3.  Suggest a **minimalist, 3-color flat palette** (with hex codes) that aligns with the professional/tool aesthetic.
4.  Write the **initial JavaScript code snippet** for loading a file using `FileReader` and initializing the **PDF.js viewer**.
5.  Provide a **proof-of-concept JavaScript function** using **PDF-lib** for **merging two uploaded PDF files**.

**Deliverable:** A set of code snippets and structural outlines addressing all the points above.
