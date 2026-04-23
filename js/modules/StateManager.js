/**
 * State Manager
 * Holds the application state
 */

// Multi-document state
let documents = []; // Array of open documents
let activeDocumentId = null; // Currently active document ID
let nextDocumentId = 1; // Auto-increment ID

// Legacy state (for backward compatibility)
let currentPDFData = null;
let currentFileName = '';
let currentCacheId = null; // ID of the current PDF in cache (for auto-save)
let allUploadedFiles = []; // Store all uploaded files for merge
let editHistory = []; // Track all edits made
let originalFileSize = 0; // Store original file size

// Undo/Redo system
let undoStack = []; // Stack of previous states
let redoStack = []; // Stack of undone states
const MAX_UNDO_STACK = 20; // Maximum number of undo states

// Search system
let searchMatches = []; // All search results
let currentMatchIndex = -1; // Index of current match
let searchQuery = ''; // Current search query
