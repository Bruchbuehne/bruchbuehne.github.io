/**
 * Theme Toggle - Dark Mode Implementation
 * Allows users to toggle between light and dark themes
 * Respects system preference by default, with user override saved in localStorage
 */

class ThemeToggle {
  constructor() {
    this.theme = this.getTheme();
    this.initToggle();
    this.listen();
  }

  /**
   * Get current theme from HTML attribute
   */
  getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  /**
   * Set theme on HTML element and save to localStorage
   */
  setTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update toggle button aria-label
    this.updateToggleButton();
  }

  /**
   * Toggle between light and dark themes
   */
  toggle() {
    const newTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  /**
   * Update toggle button aria-label for accessibility
   */
  updateToggleButton() {
    const toggle = document.querySelector('[data-theme-toggle]');
    if (toggle) {
      const label = this.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      toggle.setAttribute('aria-label', label);
    }
  }

  /**
   * Initialize toggle button
   */
  initToggle() {
    this.updateToggleButton();
  }

  /**
   * Listen for events
   */
  listen() {
    // Listen for toggle button clicks
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-theme-toggle]') || e.target.closest('[data-theme-toggle]')) {
        e.preventDefault();
        this.toggle();
      }
    });

    // Listen for keyboard activation (Enter/Space)
    document.addEventListener('keydown', (e) => {
      const toggle = document.querySelector('[data-theme-toggle]');
      if (toggle && (toggle === e.target || toggle.contains(e.target))) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggle();
        }
      }
    });

    // Listen for system preference changes (only if user hasn't set a preference)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only update if user hasn't explicitly set a preference
      if (!localStorage.getItem('theme')) {
        const systemTheme = e.matches ? 'dark' : 'light';
        this.setTheme(systemTheme);
      }
    });
  }
}

// Initialize theme toggle when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ThemeToggle());
} else {
  new ThemeToggle();
}
