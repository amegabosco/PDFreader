/**
 * Internationalization (i18n) System
 * Supports French (default) and English
 */

const translations = {
    fr: {
        // Sidebar
        'app.title': 'PDF Tool',
        'upload.pdf': 'Téléverser PDF',
        'recent.documents': 'Documents récents',
        'clear.cache': 'Vider le cache',
        'no.recent': 'Aucun document récent',

        // Quick Actions
        'quick.actions': 'Actions rapides',
        'tool.split': 'Découper',
        'tool.merge': 'Fusionner',
        'tool.rotate': 'Pivoter',
        'tool.compress': 'Compresser',
        'tool.image': 'Image',
        'tool.annotate': 'Annoter',
        'tool.sign': 'Signer',

        // Tab Bar
        'tab.new': 'Nouveau',
        'tab.close': 'Fermer',

        // Info Bar
        'info.file': 'Fichier',
        'info.pages': 'Pages',
        'info.size': 'Taille',
        'info.modified': 'Modifié',
        'info.history': 'Historique',
        'info.no.edits': 'Aucune modification',
        'info.memory': 'Mémoire',

        // Navigation
        'nav.page': 'Page',
        'nav.of': 'sur',
        'nav.previous': 'Précédent',
        'nav.next': 'Suivant',
        'nav.thumbnails': 'Miniatures',
        'nav.search': 'Rechercher',
        'nav.single.page': 'Page unique',
        'nav.scroll.view': 'Vue défilante',

        // Zoom
        'zoom.in': 'Zoom avant',
        'zoom.out': 'Zoom arrière',
        'zoom.reset': 'Réinitialiser',
        'zoom.fit.width': 'Ajuster à la largeur',
        'zoom.fit.page': 'Ajuster à la page',

        // Validate buttons
        'validate.all': 'Valider tout',
        'cancel.all': 'Annuler tout',

        // Split panel
        'split.title': 'Découper le PDF',
        'split.mode': 'Mode',
        'split.by.range': 'Par plage',
        'split.every.page': 'Chaque page',
        'split.start.page': 'Page de début',
        'split.end.page': 'Page de fin',
        'split.execute': 'Découper',
        'split.info': 'Sélectionnez les pages à extraire dans un nouveau PDF.',

        // Merge panel
        'merge.title': 'Fusionner les PDFs',
        'merge.files': 'Fichiers à fusionner',
        'merge.add': 'Ajouter PDF',
        'merge.execute': 'Fusionner',
        'merge.info': 'Ajoutez plusieurs PDFs et fusionnez-les en un seul document.',
        'merge.no.files': 'Aucun fichier ajouté',

        // Rotate panel
        'rotate.title': 'Pivoter les pages',
        'rotate.pages': 'Pages à pivoter',
        'rotate.all': 'Toutes',
        'rotate.current': 'Actuelle',
        'rotate.custom': 'Personnalisé',
        'rotate.select.all': 'Tout sélectionner',
        'rotate.select.none': 'Tout désélectionner',
        'rotate.angle': 'Angle',
        'rotate.90': '90° droite',
        'rotate.180': '180°',
        'rotate.270': '90° gauche',
        'rotate.info': 'Sélectionnez les pages et l\'angle de rotation.',

        // Compress panel
        'compress.title': 'Compresser le PDF',
        'compress.quality': 'Qualité',
        'compress.high': 'Haute',
        'compress.medium': 'Moyenne',
        'compress.low': 'Basse',
        'compress.execute': 'Compresser',
        'compress.info': 'Réduisez la taille du fichier en compressant les images.',

        // Image panel
        'image.title': 'Insérer une image',
        'image.file': 'Fichier image',
        'image.select': 'Sélectionner',
        'image.scale': 'Échelle',
        'image.rotation': 'Rotation',
        'image.add': 'Ajouter à la page',
        'image.info': 'Après avoir sélectionné l\'image, dessinez un cadre sur le PDF pour la placer.',

        // Annotation panel
        'annotate.title': 'Ajouter une annotation',
        'annotate.text': 'Texte',
        'annotate.placeholder': 'Entrez le texte...',
        'annotate.date': 'Date',
        'annotate.time': 'Heure',
        'annotate.both': 'Les deux',
        'annotate.font.size': 'Taille',
        'annotate.color': 'Couleur',
        'annotate.add': 'Ajouter à la page',
        'annotate.saved': 'Annotations sauvegardées',
        'annotate.info': 'Après avoir saisi le texte, cliquez sur "Ajouter à la page" puis dessinez un cadre où placer le texte.',

        // Signature panel
        'sign.title': 'Ajouter une signature',
        'sign.saved': 'Signatures sauvegardées',
        'sign.draw': 'Dessiner la signature',
        'sign.clear': 'Effacer',
        'sign.save': 'Sauvegarder',
        'sign.add': 'Ajouter',
        'sign.pen.color': 'Couleur du stylo',
        'sign.info': 'Dessinez votre signature, sauvegardez-la dans la bibliothèque, puis cliquez sur "Ajouter" pour la placer sur le PDF.',
        'sign.no.saved': 'Aucune signature sauvegardée',
        'sign.loading': 'Chargement des signatures...',

        // Colors
        'color.black': 'Noir',
        'color.blue': 'Bleu',
        'color.red': 'Rouge',
        'color.green': 'Vert',

        // Buttons
        'btn.close': 'Fermer',
        'btn.cancel': 'Annuler',
        'btn.save': 'Sauvegarder',
        'btn.delete': 'Supprimer',
        'btn.load': 'Charger',

        // Notifications
        'notify.pdf.loaded': 'PDF chargé avec succès',
        'notify.no.pdf': 'Veuillez charger un PDF d\'abord',
        'notify.processing': 'Traitement en cours...',
        'notify.success': 'Opération réussie',
        'notify.error': 'Erreur',
        'notify.draw.box': 'Dessinez un cadre sur le PDF pour placer votre',

        // Language toggle
        'language': 'Langue',
        'lang.french': 'Français',
        'lang.english': 'English'
    },

    en: {
        // Sidebar
        'app.title': 'PDF Tool',
        'upload.pdf': 'Upload PDF',
        'recent.documents': 'Recent Documents',
        'clear.cache': 'Clear Cache',
        'no.recent': 'No recent documents',

        // Quick Actions
        'quick.actions': 'Quick Actions',
        'tool.split': 'Split',
        'tool.merge': 'Merge',
        'tool.rotate': 'Rotate',
        'tool.compress': 'Compress',
        'tool.image': 'Image',
        'tool.annotate': 'Annotate',
        'tool.sign': 'Sign',

        // Tab Bar
        'tab.new': 'New',
        'tab.close': 'Close',

        // Info Bar
        'info.file': 'File',
        'info.pages': 'Pages',
        'info.size': 'Size',
        'info.modified': 'Modified',
        'info.history': 'History',
        'info.no.edits': 'No edits yet',
        'info.memory': 'Memory',

        // Navigation
        'nav.page': 'Page',
        'nav.of': 'of',
        'nav.previous': 'Previous',
        'nav.next': 'Next',
        'nav.thumbnails': 'Thumbnails',
        'nav.search': 'Search',
        'nav.single.page': 'Single Page',
        'nav.scroll.view': 'Scroll View',

        // Zoom
        'zoom.in': 'Zoom In',
        'zoom.out': 'Zoom Out',
        'zoom.reset': 'Reset',
        'zoom.fit.width': 'Fit Width',
        'zoom.fit.page': 'Fit Page',

        // Validate buttons
        'validate.all': 'Validate All',
        'cancel.all': 'Cancel All',

        // Split panel
        'split.title': 'Split PDF',
        'split.mode': 'Mode',
        'split.by.range': 'By Range',
        'split.every.page': 'Every Page',
        'split.start.page': 'Start Page',
        'split.end.page': 'End Page',
        'split.execute': 'Split',
        'split.info': 'Select pages to extract into a new PDF.',

        // Merge panel
        'merge.title': 'Merge PDFs',
        'merge.files': 'Files to Merge',
        'merge.add': 'Add PDF',
        'merge.execute': 'Merge',
        'merge.info': 'Add multiple PDFs and merge them into a single document.',
        'merge.no.files': 'No files added',

        // Rotate panel
        'rotate.title': 'Rotate Pages',
        'rotate.pages': 'Pages to Rotate',
        'rotate.all': 'All',
        'rotate.current': 'Current',
        'rotate.custom': 'Custom',
        'rotate.select.all': 'Select All',
        'rotate.select.none': 'Select None',
        'rotate.angle': 'Angle',
        'rotate.90': '90° Right',
        'rotate.180': '180°',
        'rotate.270': '90° Left',
        'rotate.info': 'Select pages and rotation angle.',

        // Compress panel
        'compress.title': 'Compress PDF',
        'compress.quality': 'Quality',
        'compress.high': 'High',
        'compress.medium': 'Medium',
        'compress.low': 'Low',
        'compress.execute': 'Compress',
        'compress.info': 'Reduce file size by compressing images.',

        // Image panel
        'image.title': 'Insert Image',
        'image.file': 'Image File',
        'image.select': 'Select',
        'image.scale': 'Scale',
        'image.rotation': 'Rotation',
        'image.add': 'Add to Page',
        'image.info': 'After selecting the image, draw a box on the PDF to place it.',

        // Annotation panel
        'annotate.title': 'Add Text Annotation',
        'annotate.text': 'Text',
        'annotate.placeholder': 'Enter text...',
        'annotate.date': 'Date',
        'annotate.time': 'Time',
        'annotate.both': 'Both',
        'annotate.font.size': 'Font Size',
        'annotate.color': 'Color',
        'annotate.add': 'Add to Page',
        'annotate.saved': 'Saved Annotations',
        'annotate.info': 'After entering text, click "Add to Page" then draw a box where you want to place the text.',

        // Signature panel
        'sign.title': 'Add Signature',
        'sign.saved': 'Saved Signatures',
        'sign.draw': 'Draw Signature',
        'sign.clear': 'Clear',
        'sign.save': 'Save',
        'sign.add': 'Add',
        'sign.pen.color': 'Pen Color',
        'sign.info': 'Draw your signature, save it to library, then click "Add" to place it on the PDF.',
        'sign.no.saved': 'No saved signatures',
        'sign.loading': 'Loading signatures...',

        // Colors
        'color.black': 'Black',
        'color.blue': 'Blue',
        'color.red': 'Red',
        'color.green': 'Green',

        // Buttons
        'btn.close': 'Close',
        'btn.cancel': 'Cancel',
        'btn.save': 'Save',
        'btn.delete': 'Delete',
        'btn.load': 'Load',

        // Notifications
        'notify.pdf.loaded': 'PDF loaded successfully',
        'notify.no.pdf': 'Please load a PDF first',
        'notify.processing': 'Processing...',
        'notify.success': 'Operation successful',
        'notify.error': 'Error',
        'notify.draw.box': 'Draw a box on the PDF to place your',

        // Language toggle
        'language': 'Language',
        'lang.french': 'Français',
        'lang.english': 'English'
    }
};

class I18n {
    constructor() {
        // Check localStorage for saved language preference, default to French
        this.currentLang = localStorage.getItem('pdfTool_language') || 'fr';
        console.log('🌍 Language initialized:', this.currentLang);
    }

    /**
     * Get translated text for a key
     */
    t(key) {
        const text = translations[this.currentLang]?.[key];
        if (!text) {
            console.warn(`⚠️ Translation missing for key: ${key} (${this.currentLang})`);
            return key;
        }
        return text;
    }

    /**
     * Change language
     */
    setLanguage(lang) {
        if (!translations[lang]) {
            console.error(`❌ Language not supported: ${lang}`);
            return;
        }

        this.currentLang = lang;
        localStorage.setItem('pdfTool_language', lang);
        console.log('🌍 Language changed to:', lang);

        // Trigger UI update
        this.updateUI();
    }

    /**
     * Get current language
     */
    getLanguage() {
        return this.currentLang;
    }

    /**
     * Update all UI text elements
     */
    updateUI() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key);

            // Update text content or specific attributes
            if (el.hasAttribute('data-i18n-placeholder')) {
                el.placeholder = text;
            } else if (el.hasAttribute('data-i18n-title')) {
                el.title = text;
            } else {
                el.textContent = text;
            }
        });

        console.log('✅ UI updated with language:', this.currentLang);
    }
}

// Create global instance
const i18n = new I18n();
