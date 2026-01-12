document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('reservation-container');
  if (!container) return;

  const WORKER_URL = container.dataset.workerUrl;
  let shows = [];

  // Detect Android Chrome/WebView
  const isAndroidChrome = /Android.*Chrome|Android.*WebView/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  // Fetch available shows on page load
  async function loadShows(retryCount = 0) {
    try {
      // Add timeout to detect hanging requests (longer for Android due to known issues)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), isAndroidChrome ? 15000 : 10000);

      const response = await fetch(`${WORKER_URL}/availability`, {
        signal: controller.signal,
        cache: 'no-cache', // Prevent stale cache issues
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'omit' // Don't send credentials
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

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
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        workerUrl: WORKER_URL,
        userAgent: navigator.userAgent,
        isAndroidChrome: isAndroidChrome,
        timestamp: new Date().toISOString(),
        retryAttempt: retryCount
      });

      // Retry once on network errors (but not on timeouts or server errors)
      if (retryCount === 0 && (error.message.includes('Failed to fetch') || error.name === 'TypeError')) {
        console.log('Retrying request...');
        const loadingEl = document.getElementById('loading');
        loadingEl.textContent = 'Verbindungsfehler. Versuche erneut...';

        // Wait 2 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return loadShows(retryCount + 1);
      }

      const loadingEl = document.getElementById('loading');

      // Provide detailed error messages based on error type
      let errorMessage = 'Fehler beim Laden der Vorstellungen.<br><br>';

      if (error.name === 'AbortError') {
        errorMessage += '<strong>Zeitüberschreitung:</strong> Die Verbindung zum Reservierungsserver dauert zu lange.<br><br>';
        if (isAndroidChrome) {
          errorMessage += '<strong>Android Chrome Problem erkannt:</strong><br>';
          errorMessage += 'Versuche bitte folgendes:<br>';
          errorMessage += '• Deaktiviere "Lite-Modus" / "Datenspar-Modus" in Chrome (Einstellungen > Lite-Modus)<br>';
          errorMessage += '• Deaktiviere "Sicheres DNS" in Chrome (Einstellungen > Datenschutz und Sicherheit > Sicheres DNS verwenden)<br>';
          errorMessage += '• Lösche den Browser-Cache (Einstellungen > Datenschutz > Browserdaten löschen)<br>';
          errorMessage += '• Oder öffne diese Seite in einem anderen Browser (Firefox, Samsung Internet)<br>';
        } else {
          errorMessage += 'Bitte versuche es erneut.';
        }
      } else if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        errorMessage += '<strong>Verbindungsfehler:</strong> Die Verbindung zum Reservierungsserver konnte nicht hergestellt werden.<br><br>';
        if (isAndroidChrome) {
          errorMessage += '<strong>Häufige Ursachen auf Android Chrome:</strong><br>';
          errorMessage += '• <strong>Lite-Modus / Data Saver:</strong> Gehe zu Chrome-Einstellungen → Lite-Modus und deaktiviere ihn<br>';
          errorMessage += '• <strong>Sicheres DNS:</strong> Gehe zu Chrome-Einstellungen → Datenschutz und Sicherheit → Sicheres DNS verwenden und wähle "Mit aktuellem Dienstanbieter"<br>';
          errorMessage += '• <strong>DNS-Probleme:</strong> Wechsle temporär zu einem anderen WLAN/Mobilnetz<br>';
          errorMessage += '• <strong>WebView-Cache:</strong> Lösche den Browser-Cache unter Einstellungen<br><br>';
          errorMessage += '<strong>Alternative:</strong> Versuche es mit Firefox oder Samsung Internet Browser.';
        } else {
          errorMessage += 'Dies könnte an Netzwerkproblemen, DNS-Auflösung oder regionalen Einschränkungen liegen.<br><br>';
          errorMessage += 'Bitte versuche es später erneut oder kontaktiere uns direkt.';
        }
      } else {
        errorMessage += `<strong>Fehler:</strong> ${error.message}<br><br>`;
      }

      // Add diagnostic information
      const diagnostics = {
        Fehlertyp: error.name,
        Browser: navigator.userAgent.match(/(Firefox|Chrome|Safari|Edge|Opera)\/[\d.]+/)?.[0] || 'Unbekannt',
        AndroidChrome: isAndroidChrome ? 'Ja' : 'Nein',
        Zeit: new Date().toISOString(),
        URL: WORKER_URL,
        Versuche: retryCount + 1
      };

      errorMessage += '<br><br><details style="margin-top: 1rem; font-family: var(--font-mono); font-size: 0.75rem;">';
      errorMessage += '<summary style="cursor: pointer; color: var(--color-muted);">Technische Details (für Support)</summary>';
      errorMessage += '<pre style="margin-top: 0.5rem; padding: 0.5rem; background: var(--color-bg); border: 1px solid var(--color-border); overflow-x: auto;">';
      errorMessage += JSON.stringify(diagnostics, null, 2);
      errorMessage += '\n\nFehler: ' + error.message;
      errorMessage += '</pre></details>';

      errorMessage += '<br><button class="btn btn--secondary" id="reload-loading-btn">Erneut versuchen</button>';

      loadingEl.innerHTML = errorMessage;
      loadingEl.style.color = 'var(--color-text)';
      loadingEl.style.textAlign = 'left';
      loadingEl.style.maxWidth = '600px';
      loadingEl.style.margin = '0 auto';

      // Add event listener to reload button
      const reloadBtn = document.getElementById('reload-loading-btn');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
          loadingEl.innerHTML = '<div class="spinner"></div>Lade erneut...';
          loadShows(0);
        });
      }
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

  // Update availability info when show is selected (disabled to not show seat count)
  // const datumSelect = document.getElementById('datum');
  // if (datumSelect) {
  //   datumSelect.addEventListener('change', function() {
  //     const selected = this.options[this.selectedIndex];
  //     const remaining = selected.dataset.remaining;
  //     const capacity = selected.dataset.capacity;
  //     const infoEl = document.getElementById('availability-info');
  //
  //     if (remaining) {
  //       infoEl.textContent = `Noch ${remaining} von ${capacity} Plätzen verfügbar`;
  //       infoEl.style.color = remaining < 10 ? 'var(--color-accent)' : 'var(--color-muted)';
  //     } else {
  //       infoEl.textContent = '';
  //     }
  //   });
  // }

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
        // Add timeout to detect hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for submission

        const response = await fetch(`${WORKER_URL}/reserve`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          mode: 'cors', // Explicitly set CORS mode
          credentials: 'omit' // Don't send credentials
        });
        clearTimeout(timeoutId);

        const result = await response.text();

        if (response.ok && result.includes('OK')) {
          document.getElementById('reservation-form').style.display = 'none';
          document.getElementById('success-message').style.display = 'block';
        } else {
          throw new Error(result);
        }
      } catch (error) {
        console.error('Error submitting reservation:', error);
        console.error('Submission error details:', {
          name: error.name,
          message: error.message,
          workerUrl: WORKER_URL,
          isAndroidChrome: isAndroidChrome,
          timestamp: new Date().toISOString()
        });

        document.getElementById('reservation-form').style.display = 'none';

        let errorText = '';
        if (error.name === 'AbortError') {
          errorText = 'Die Anfrage hat zu lange gedauert. Bitte überprüfe deine Internetverbindung und versuche es erneut.';
        } else if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
          if (isAndroidChrome) {
            errorText = 'Verbindungsfehler auf Android Chrome. Bitte deaktiviere den "Lite-Modus" in den Chrome-Einstellungen oder versuche es mit einem anderen Browser (Firefox, Samsung Internet).';
          } else {
            errorText = 'Verbindungsfehler: Die Reservierung konnte nicht übermittelt werden. Bitte versuche es erneut oder kontaktiere uns direkt.';
          }
        } else {
          errorText = error.message || 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
        }

        document.getElementById('error-text').textContent = errorText;
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
