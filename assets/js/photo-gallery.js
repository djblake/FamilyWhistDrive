/**
 * Photo Gallery System
 * Auto-scans tournament photo folders and creates responsive galleries
 */

class PhotoGallery {
    constructor() {
        this.galleries = new Map();
        this.currentLightbox = null;
        this.supportedFormats = ['jpg', 'jpeg', 'png', 'webp'];
        
        // Initialize lightbox
        this.initializeLightbox();
    }

    /**
     * Scan and load photos for a specific tournament
     */
    async loadTournamentPhotos(tournamentYear) {
        const photosPath = `/tournaments/${tournamentYear}/photos/`;
        
        try {
            // In a real implementation, this would scan the directory
            // For now, we'll use a predefined list based on our sample structure
            const samplePhotos = this.getSamplePhotos(tournamentYear);
            
            const gallery = {
                year: tournamentYear,
                path: photosPath,
                photos: samplePhotos,
                totalPhotos: samplePhotos.length
            };
            
            this.galleries.set(tournamentYear, gallery);
            return gallery;
            
        } catch (error) {
            console.error(`Error loading photos for ${tournamentYear}:`, error);
            return null;
        }
    }

    /**
     * Get sample photos for demonstration
     */
    getSamplePhotos(year) {
        const basePhotos = [
            {
                filename: 'tournament_start.jpg',
                caption: `${year} Tournament Opening Ceremony - The Most Prestigious Family Competition Begins`,
                date: `${year}-12-25`,
                type: 'event'
            },
            {
                filename: 'round_4_action.jpg',
                caption: `Round 4 Intensity - Strategic Warfare at Table 3`,
                date: `${year}-12-25`,
                type: 'gameplay'
            },
            {
                filename: 'mid_tournament_break.jpg',
                caption: `Strategic Discussions During the Traditional Tea Break`,
                date: `${year}-12-25`,
                type: 'social'
            },
            {
                filename: 'intense_final_rounds.jpg',
                caption: `The Championship Hangs in the Balance - Final Rounds Drama`,
                date: `${year}-12-25`,
                type: 'gameplay'
            },
            {
                filename: 'victory_celebration.jpg',
                caption: `Champion Emerges Victorious - Another Year of Glory`,
                date: `${year}-12-25`,
                type: 'celebration'
            },
            {
                filename: 'group_photo.jpg',
                caption: `The Complete ${year} Tournament Participants - Four Generations United`,
                date: `${year}-12-25`,
                type: 'group'
            },
            {
                filename: 'trophy_presentation.jpg',
                caption: `The Prestigious Ruston Family Trophy Changes Hands Once Again`,
                date: `${year}-12-25`,
                type: 'ceremony'
            },
            {
                filename: 'family_gathering.jpg',
                caption: `Beyond Competition - The Heart of Family Tradition`,
                date: `${year}-12-25`,
                type: 'family'
            }
        ];

        // Add year-specific variations
        if (year === 2023) {
            basePhotos.push({
                filename: 'margaret_victory_speech.jpg',
                caption: 'Margaret Wilson\'s Championship Victory Speech - "Three in a Row!"',
                date: `${year}-12-25`,
                type: 'celebration'
            });
        }

        if (year === 2022) {
            basePhotos.push({
                filename: 'emma_youngest_winner.jpg',
                caption: 'Emma Jones Makes History - Youngest Champion Ever at Age 21',
                date: `${year}-12-25`,
                type: 'milestone'
            });
        }

        return basePhotos.map(photo => ({
            ...photo,
            url: `/tournaments/${year}/photos/${photo.filename}`,
            thumbnailUrl: `/tournaments/${year}/photos/thumbs/${photo.filename}`,
            fullUrl: `/tournaments/${year}/photos/full/${photo.filename}`
        }));
    }

    /**
     * Create photo gallery HTML for a tournament
     */
    createGalleryHTML(tournamentYear, containerSelector) {
        const gallery = this.galleries.get(tournamentYear);
        if (!gallery) {
            console.warn(`No gallery found for tournament ${tournamentYear}`);
            return;
        }

        const container = document.querySelector(containerSelector);
        if (!container) {
            console.warn(`Container ${containerSelector} not found`);
            return;
        }

        // Create gallery HTML
        const galleryHTML = `
            <div class="photo-gallery" data-year="${tournamentYear}">
                <div class="gallery-header">
                    <h3 class="gallery-title">
                        <span class="gallery-icon">📸</span>
                        ${tournamentYear} Tournament Photos
                    </h3>
                    <p class="gallery-subtitle">${gallery.totalPhotos} photos capturing the championship moments</p>
                </div>
                <div class="photo-grid">
                    ${gallery.photos.map(photo => this.createPhotoCard(photo, tournamentYear)).join('')}
                </div>
            </div>
        `;

        container.innerHTML = galleryHTML;

        // Add click handlers
        this.attachPhotoHandlers(container);
    }

    /**
     * Create individual photo card HTML
     */
    createPhotoCard(photo, year) {
        return `
            <div class="photo-card" data-photo="${photo.filename}" data-year="${year}">
                <div class="photo-container">
                    <div class="photo-placeholder">
                        <div class="photo-icon">🖼️</div>
                        <div class="photo-filename">${photo.filename}</div>
                    </div>
                    <div class="photo-overlay">
                        <button class="photo-view-btn" title="View Full Size">
                            <span class="icon">🔍</span>
                        </button>
                        <div class="photo-type-badge ${photo.type}">${this.formatPhotoType(photo.type)}</div>
                    </div>
                </div>
                <div class="photo-caption">
                    <h4 class="photo-title">${this.extractPhotoTitle(photo.caption)}</h4>
                    <p class="photo-description">${photo.caption}</p>
                    <div class="photo-meta">
                        <span class="photo-date">${this.formatDate(photo.date)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Extract photo title from caption
     */
    extractPhotoTitle(caption) {
        // Extract title before the first dash or use first part
        const parts = caption.split(' - ');
        return parts[0].length > 50 ? caption.substring(0, 50) + '...' : parts[0];
    }

    /**
     * Format photo type for display
     */
    formatPhotoType(type) {
        const types = {
            'event': 'Event',
            'gameplay': 'Action',
            'social': 'Social',
            'celebration': 'Victory',
            'group': 'Group',
            'ceremony': 'Ceremony',
            'family': 'Family',
            'milestone': 'Historic'
        };
        return types[type] || 'Photo';
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Attach click handlers to photos
     */
    attachPhotoHandlers(container) {
        const photoCards = container.querySelectorAll('.photo-card');
        
        photoCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const year = card.dataset.year;
                const filename = card.dataset.photo;
                this.openLightbox(year, filename);
            });
        });
    }

    /**
     * Initialize lightbox functionality
     */
    initializeLightbox() {
        // Create lightbox HTML
        const lightboxHTML = `
            <div id="photo-lightbox" class="lightbox-overlay">
                <div class="lightbox-container">
                    <button class="lightbox-close" title="Close">&times;</button>
                    <button class="lightbox-prev" title="Previous">‹</button>
                    <button class="lightbox-next" title="Next">›</button>
                    <div class="lightbox-content">
                        <div class="lightbox-image-container">
                            <div class="lightbox-placeholder">
                                <div class="lightbox-icon">🖼️</div>
                                <div class="lightbox-text">Photo Preview</div>
                            </div>
                        </div>
                        <div class="lightbox-info">
                            <h3 class="lightbox-title"></h3>
                            <p class="lightbox-caption"></p>
                            <div class="lightbox-meta">
                                <span class="lightbox-date"></span>
                                <span class="lightbox-type"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to body if not exists
        if (!document.getElementById('photo-lightbox')) {
            document.body.insertAdjacentHTML('beforeend', lightboxHTML);
        }

        // Add event handlers
        this.attachLightboxHandlers();
    }

    /**
     * Attach lightbox event handlers
     */
    attachLightboxHandlers() {
        const lightbox = document.getElementById('photo-lightbox');
        const closeBtn = lightbox.querySelector('.lightbox-close');
        const prevBtn = lightbox.querySelector('.lightbox-prev');
        const nextBtn = lightbox.querySelector('.lightbox-next');

        closeBtn.addEventListener('click', () => this.closeLightbox());
        prevBtn.addEventListener('click', () => this.showPrevPhoto());
        nextBtn.addEventListener('click', () => this.showNextPhoto());

        // Close on overlay click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                this.closeLightbox();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.currentLightbox) {
                switch (e.key) {
                    case 'Escape':
                        this.closeLightbox();
                        break;
                    case 'ArrowLeft':
                        this.showPrevPhoto();
                        break;
                    case 'ArrowRight':
                        this.showNextPhoto();
                        break;
                }
            }
        });
    }

    /**
     * Open lightbox with specific photo
     */
    openLightbox(year, filename) {
        const gallery = this.galleries.get(year);
        if (!gallery) return;

        const photoIndex = gallery.photos.findIndex(p => p.filename === filename);
        if (photoIndex === -1) return;

        this.currentLightbox = {
            year: year,
            gallery: gallery,
            currentIndex: photoIndex
        };

        this.showCurrentPhoto();
        
        const lightbox = document.getElementById('photo-lightbox');
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close lightbox
     */
    closeLightbox() {
        const lightbox = document.getElementById('photo-lightbox');
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
        this.currentLightbox = null;
    }

    /**
     * Show current photo in lightbox
     */
    showCurrentPhoto() {
        if (!this.currentLightbox) return;

        const { gallery, currentIndex } = this.currentLightbox;
        const photo = gallery.photos[currentIndex];
        
        const lightbox = document.getElementById('photo-lightbox');
        const title = lightbox.querySelector('.lightbox-title');
        const caption = lightbox.querySelector('.lightbox-caption');
        const date = lightbox.querySelector('.lightbox-date');
        const type = lightbox.querySelector('.lightbox-type');

        title.textContent = this.extractPhotoTitle(photo.caption);
        caption.textContent = photo.caption;
        date.textContent = this.formatDate(photo.date);
        type.textContent = this.formatPhotoType(photo.type);

        // Update navigation buttons
        const prevBtn = lightbox.querySelector('.lightbox-prev');
        const nextBtn = lightbox.querySelector('.lightbox-next');
        
        prevBtn.style.display = currentIndex > 0 ? 'block' : 'none';
        nextBtn.style.display = currentIndex < gallery.photos.length - 1 ? 'block' : 'none';
    }

    /**
     * Show previous photo
     */
    showPrevPhoto() {
        if (!this.currentLightbox || this.currentLightbox.currentIndex <= 0) return;
        
        this.currentLightbox.currentIndex--;
        this.showCurrentPhoto();
    }

    /**
     * Show next photo
     */
    showNextPhoto() {
        if (!this.currentLightbox) return;
        
        const { gallery, currentIndex } = this.currentLightbox;
        if (currentIndex >= gallery.photos.length - 1) return;
        
        this.currentLightbox.currentIndex++;
        this.showCurrentPhoto();
    }

    /**
     * Get gallery for a tournament
     */
    getGallery(year) {
        return this.galleries.get(year);
    }

    /**
     * Get all loaded galleries
     */
    getAllGalleries() {
        return Array.from(this.galleries.values());
    }
}

// Export for use in other scripts
window.PhotoGallery = PhotoGallery;