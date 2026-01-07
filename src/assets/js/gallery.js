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

  open(index) {
    this.currentIndex = index;
    this.updateLightbox();
    this.lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    this.lightbox.focus();
  }

  close() {
    this.lightbox.hidden = true;
    document.body.style.overflow = '';
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    this.updateLightbox();
  }

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
    this.updateLightbox();
  }

  updateLightbox() {
    const img = this.images[this.currentIndex].querySelector('img');
    this.lightboxImage.src = img.src;
    this.lightboxImage.alt = img.alt;
    this.counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
  }

  bindEvents() {
    this.images.forEach((item, index) => {
      item.addEventListener('click', () => this.open(index));
    });

    const closeBtn = this.lightbox.querySelector('[data-gallery-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const prevBtn = this.lightbox.querySelector('[data-gallery-prev]');
    const nextBtn = this.lightbox.querySelector('[data-gallery-next]');

    if (prevBtn) prevBtn.addEventListener('click', () => this.prev());
    if (nextBtn) nextBtn.addEventListener('click', () => this.next());

    this.lightbox.addEventListener('click', (e) => {
      if (e.target === this.lightbox) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (!this.lightbox.hidden) {
        switch (e.key) {
          case 'Escape': this.close(); break;
          case 'ArrowRight': this.next(); break;
          case 'ArrowLeft': this.prev(); break;
        }
      }
    });

    let touchStartX = 0;
    let touchEndX = 0;

    this.lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    this.lightbox.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? this.next() : this.prev();
      }
    });
  }
}

function initGalleries() {
  document.querySelectorAll('.gallery').forEach(gallery => new Gallery(gallery));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGalleries);
} else {
  initGalleries();
}
