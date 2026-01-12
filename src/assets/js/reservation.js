document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('reservation-container');
  if (!container) return;

  const WORKER_URL = container.dataset.workerUrl;
  let shows = [];

  // Fetch available shows on page load
  async function loadShows() {
    try {
      const response = await fetch(`${WORKER_URL}/availability`);
      if (!response.ok) throw new Error('Failed to load shows');

      shows = await response.json();

      if (shows.length === 0) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('no-shows').style.display = 'block';
        return;
      }

      populateShowsSelect();
      document.getElementById('loading').style.display = 'none';
      document.getElementById('reservation-form').style.display = 'block';
    } catch (error) {
      console.error('Error loading shows:', error);
      document.getElementById('loading').textContent = 'Fehler beim Laden der Vorstellungen. Bitte lade die Seite neu.';
    }
  }

  // Populate the shows dropdown
  function populateShowsSelect() {
    const select = document.getElementById('datum');
    
    // Get pre-selected show title from URL
    const urlParams = new URLSearchParams(window.location.search);
    const preSelectedTitle = urlParams.get('show');
    
    let hasPreSelection = false;

    shows.forEach(show => {
      const option = document.createElement('option');
      option.value = show.dateFormatted; // Worker expects formatted date
      option.textContent = `${show.date} — ${show.location}`;
      option.dataset.showId = show.id;
      option.dataset.remaining = show.remaining;
      option.dataset.capacity = show.capacity;
      option.dataset.title = show.title;

      if (show.remaining === 0) {
        option.disabled = true;
        option.textContent += ' (Ausverkauft)';
      }

      // Pre-select if title matches
      if (preSelectedTitle && show.title === preSelectedTitle && show.remaining > 0 && !hasPreSelection) {
        option.selected = true;
        hasPreSelection = true;
      }

      select.appendChild(option);
    });
    
    // Trigger change event if pre-selected
    if (hasPreSelection) {
      select.dispatchEvent(new Event('change'));
    }
  }

  // Update availability info when show is selected
  const datumSelect = document.getElementById('datum');
  if (datumSelect) {
    datumSelect.addEventListener('change', function() {
      const selected = this.options[this.selectedIndex];
      const remaining = selected.dataset.remaining;
      const capacity = selected.dataset.capacity;
      const infoEl = document.getElementById('availability-info');

      if (remaining) {
        infoEl.textContent = `Noch ${remaining} von ${capacity} Plätzen verfügbar`;
        infoEl.style.color = remaining < 10 ? 'var(--color-accent)' : 'var(--color-muted)';
      } else {
        infoEl.textContent = '';
      }
    });
  }

  // Show/hide herkunft details field
  const herkunftSelect = document.getElementById('herkunft');
  if (herkunftSelect) {
    herkunftSelect.addEventListener('change', function() {
      const detailsGroup = document.getElementById('herkunft-details-group');
      if (this.value === 'Social Media' || this.value === 'Sonstiges') {
          detailsGroup.style.display = 'block';
      } else {
          detailsGroup.style.display = 'none';
      }
    });
  }

  // Handle form submission
  const form = document.getElementById('reservation-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const submitBtn = document.getElementById('submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Wird gesendet...';

      const formData = new FormData(this);

      try {
        const response = await fetch(`${WORKER_URL}/reserve`, {
          method: 'POST',
          body: formData
        });

        const result = await response.text();

        if (response.ok && result.includes('OK')) {
          document.getElementById('reservation-form').style.display = 'none';
          document.getElementById('success-message').style.display = 'block';
        } else {
          throw new Error(result);
        }
      } catch (error) {
        console.error('Error submitting reservation:', error);
        document.getElementById('reservation-form').style.display = 'none';
        document.getElementById('error-text').textContent = error.message || 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
        document.getElementById('error-message').style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reservierung absenden';
      }
    });
  }

  // Reload button handlers
  const reloadSuccessBtn = document.getElementById('reload-success-btn');
  const reloadErrorBtn = document.getElementById('reload-error-btn');

  if (reloadSuccessBtn) {
    reloadSuccessBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  if (reloadErrorBtn) {
    reloadErrorBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // Load shows on page load
  loadShows();
});
