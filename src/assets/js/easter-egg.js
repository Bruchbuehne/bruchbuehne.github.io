/**
 * Easter Egg: 'times'
 * Triggers Times New Roman font and a special console message.
 */

(function() {
  const code = 'times';
  let buffer = '';
  
  document.addEventListener('keydown', (e) => {
    // Append key to buffer
    buffer += e.key.toLowerCase();
    
    // Keep buffer only as long as the code
    if (buffer.length > code.length) {
      buffer = buffer.slice(buffer.length - code.length);
    }
    
    // Check for match
    if (buffer === code) {
      activateTimesNewRoman();
    }
  });

  function activateTimesNewRoman() {
    // Change CSS variables to use Times New Roman
    document.documentElement.style.setProperty('--font-serif', '"Times New Roman", Times, serif');
    document.documentElement.style.setProperty('--font-mono', '"Times New Roman", Times, serif'); // Chaos mode: everything is Times
    
    // Log message
    console.log('Für Ilea');
  }
})();
