/**
 * Gallery Component - Lightweight Image Lightbox
 * Displays production images in a grid with lightbox functionality
 * Supports keyboard navigation and touch gestures
 */

class Gallery {
  constructor(container) {
    this.container = container;
    this.images = Array.from(container.querySelectorAll('[data-gallery-item]'));
    this.lightbox = container.querySelector('[data-gallery-lightbox]');

    if (!this.lightbox || this.images.length === 0) return;

    this.lightboxImage = this.lightbox.querySelector('[data-gallery-lightbox-image]');
    this.counter = this.lightbox.querySelector('[data-gallery-counter]');
    this.currentIndex = 0;

    this.bindEvents();
  }

  /**
   * Open lightbox at specific image index
   */
  open(index) {
    this.currentIndex = index;
    this.updateLightbox();
    this.lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    this.lightbox.focus();
  }

  /**
   * Close lightbox
   */
  close() {
    this.lightbox.hidden = true;
    document.body.style.overflow = '';
  }

  /**
   * Navigate to next image
   */
  next() {
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    this.updateLightbox();
  }

  /**
   * Navigate to previous image
   */
  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
    this.updateLightbox();
  }

  /**
   * Update lightbox with current image
   */
  updateLightbox() {
    const img = this.images[this.currentIndex].querySelector('img');
    this.lightboxImage.src = img.src;
    this.lightboxImage.alt = img.alt;
    this.counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Open lightbox on thumbnail click
    this.images.forEach((item, index) => {
      item.addEventListener('click', () => this.open(index));
    });

    // Close button
    const closeBtn = this.lightbox.querySelector('[data-gallery-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Navigation buttons
    const prevBtn = this.lightbox.querySelector('[data-gallery-prev]');
    const nextBtn = this.lightbox.querySelector('[data-gallery-next]');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prev());
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.next());
    }

    // Close on backdrop click
    this.lightbox.addEventListener('click', (e) => {
      if (e.target === this.lightbox) {
        this.close();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.lightbox.hidden) {
        switch (e.key) {
          case 'Escape':
            this.close();
            break;
          case 'ArrowRight':
            this.next();
            break;
          case 'ArrowLeft':
            this.prev();
            break;
        }
      }
    });

    // Touch swipe support (simple implementation)
    let touchStartX = 0;
    let touchEndX = 0;

    this.lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    this.lightbox.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    });

    this.handleSwipe = () => {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          this.next(); // Swipe left
        } else {
          this.prev(); // Swipe right
        }
      }
    };
  }
}

// Initialize all galleries on the page
function initGalleries() {
  const galleries = document.querySelectorAll('.gallery');
  galleries.forEach(gallery => new Gallery(gallery));
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGalleries);
} else {
  initGalleries();
}
