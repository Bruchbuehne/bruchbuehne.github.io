// Navbar functionality

// Handle favicon load error
document.addEventListener('DOMContentLoaded', () => {
  const navIcon = document.getElementById('nav-icon');
  if (navIcon) {
    navIcon.addEventListener('error', function() {
      this.style.display = 'none';
    });
  }
});
