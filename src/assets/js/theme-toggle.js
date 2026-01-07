class ThemeToggle {
  constructor() {
    this.theme = this.getTheme();
    this.initToggle();
    this.listen();
  }

  getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  setTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.updateToggleButton();
  }

  toggle() {
    const newTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  updateToggleButton() {
    const toggle = document.querySelector('[data-theme-toggle]');
    if (toggle) {
      const label = this.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      toggle.setAttribute('aria-label', label);
    }
  }

  initToggle() {
    this.updateToggleButton();
  }

  listen() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-theme-toggle]') || e.target.closest('[data-theme-toggle]')) {
        e.preventDefault();
        this.toggle();
      }
    });

    document.addEventListener('keydown', (e) => {
      const toggle = document.querySelector('[data-theme-toggle]');
      if (toggle && (toggle === e.target || toggle.contains(e.target))) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggle();
        }
      }
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        const systemTheme = e.matches ? 'dark' : 'light';
        this.setTheme(systemTheme);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ThemeToggle());
} else {
  new ThemeToggle();
}
