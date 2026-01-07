(function() {
  const theme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const preferredTheme = theme || (systemPrefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', preferredTheme);
})();
