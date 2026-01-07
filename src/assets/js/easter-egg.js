(function() {
  const code = 'times';
  let buffer = '';

  document.addEventListener('keydown', (e) => {
    buffer += e.key.toLowerCase();
    if (buffer.length > code.length) {
      buffer = buffer.slice(buffer.length - code.length);
    }
    if (buffer === code) {
      document.documentElement.style.setProperty('--font-serif', '"Times New Roman", Times, serif');
      document.documentElement.style.setProperty('--font-mono', '"Times New Roman", Times, serif');
      console.log('Für Ilea');
    }
  });
})();
