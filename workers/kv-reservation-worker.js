/**
 * Bruchbühne Reservations - Simplified Cloudflare KV Worker
 * Features:
 * - Cloudflare KV storage (simpler than D1)
 * - MailChannels email confirmations (FREE!)
 * - Real-time availability
 * - Admin dashboard
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // GET /availability - Return available shows
      if (url.pathname === '/availability' && request.method === 'GET') {
        return await handleAvailability(env, corsHeaders);
      }

      // POST /reserve - Create reservation
      if (url.pathname === '/reserve' && request.method === 'POST') {
        return await handleReservation(request, env, corsHeaders);
      }

      // GET /admin/reservations - List all reservations (requires auth)
      if (url.pathname === '/admin/reservations' && request.method === 'GET') {
        return await handleAdminReservations(request, env, corsHeaders);
      }

      // GET /admin/shows - List all shows (requires auth)
      if (url.pathname === '/admin/shows' && request.method === 'GET') {
        return await handleAdminShows(request, env, corsHeaders);
      }

      // DELETE /admin/reservations/:id - Delete a reservation (requires auth)
      if (url.pathname.startsWith('/admin/reservations/') && request.method === 'DELETE') {
        const reservationId = url.pathname.split('/').pop();
        return await handleDeleteReservation(request, env, corsHeaders, reservationId);
      }

      // GET /favicon.ico - Return a simple favicon
      if (url.pathname === '/favicon.ico') {
        return new Response(null, { status: 204 });
      }

      // GET / - Redirect to main website
      if (url.pathname === '/') {
        return Response.redirect('https://bruchbuehne.de', 307);
      }

      // GET /admin - Admin dashboard HTML
      if (url.pathname === '/admin' || url.pathname === '/admin/') {
        return handleAdminDashboard();
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Get availability for all upcoming shows
 */
async function handleAvailability(env, corsHeaders) {
  const showsJson = await env.RESERVATIONS.get('shows');
  const shows = showsJson ? JSON.parse(showsJson) : [];

  // Filter to only future shows
  const now = new Date();
  const upcomingShows = shows.filter(show => {
    const showDate = new Date(show.date);
    return showDate >= now;
  }).map(show => ({
    id: show.id,
    title: show.title,
    date: show.dateFormatted,
    location: show.location,
    capacity: show.capacity,
    reserved: show.reserved || 0,
    remaining: show.capacity - (show.reserved || 0)
  }));

  return new Response(JSON.stringify(upcomingShows), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Create a new reservation
 */
async function handleReservation(request, env, corsHeaders) {
  const data = await request.formData();

  // Extract and validate form data
  const name = data.get('name')?.trim();
  const email = data.get('email')?.trim().toLowerCase();
  const tickets = parseInt(data.get('anzahl'));
  const showDateFormatted = data.get('datum');
  const source = data.get('herkunft') || '';
  const sourceDetails = data.get('herkunft_details') || '';

  // Validation
  if (!name || !email || !tickets || !showDateFormatted) {
    return new Response('Bitte alle Pflichtfelder ausfüllen', {
      status: 400,
      headers: corsHeaders
    });
  }

  if (!isValidEmail(email)) {
    return new Response('Ungültige E-Mail-Adresse', {
      status: 400,
      headers: corsHeaders
    });
  }

  if (tickets < 1 || tickets > 10) {
    return new Response('Bitte zwischen 1 und 10 Karten reservieren', {
      status: 400,
      headers: corsHeaders
    });
  }

  // Get shows from KV
  const showsJson = await env.RESERVATIONS.get('shows');
  const shows = showsJson ? JSON.parse(showsJson) : [];

  // Find show by formatted date (frontend sends formatted date)
  const show = shows.find(s => s.dateFormatted === showDateFormatted);

  if (!show) {
    return new Response('Vorstellung nicht gefunden', {
      status: 404,
      headers: corsHeaders
    });
  }

  // Check availability
  const remaining = show.capacity - (show.reserved || 0);
  if (remaining < tickets) {
    return new Response(`Nur noch ${remaining} Karten verfügbar`, {
      status: 400,
      headers: corsHeaders
    });
  }

  // Create reservation
  const reservationId = crypto.randomUUID();
  const reservation = {
    id: reservationId,
    showId: show.id,
    showTitle: show.title,
    showDate: show.date,
    showDateFormatted: show.dateFormatted,
    location: show.location,
    name,
    email,
    tickets,
    source,
    sourceDetails,
    createdAt: new Date().toISOString()
  };

  // Save reservation to KV
  await env.RESERVATIONS.put(
    `reservation:${reservationId}`,
    JSON.stringify(reservation)
  );

  // Update show reserved count
  show.reserved = (show.reserved || 0) + tickets;
  await env.RESERVATIONS.put('shows', JSON.stringify(shows));

  // Extract show time from date string (e.g., "2025-07-07 19:00:00" -> "19:00")
  const showTime = show.date.split(' ')[1].substring(0, 5);

  // Send confirmation email
  await sendConfirmationEmail(env, {
    name,
    email,
    showTitle: show.title,
    showDate: show.dateFormatted,
    showTime: showTime,
    location: show.location,
    tickets
  });

  // Sync to Google Sheets (non-blocking - errors won't fail the reservation)
  if (env.GOOGLE_SHEETS_WEBHOOK) {
    try {
      await syncToGoogleSheets(env, reservation);
    } catch (error) {
      console.error('Google Sheets sync failed (non-critical):', error);
    }
  }

  return new Response('OK', { headers: corsHeaders });
}

/**
 * List all reservations (admin only)
 */
async function handleAdminReservations(request, env, corsHeaders) {
  // Simple auth check
  const auth = request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', {
      status: 401,
      headers: corsHeaders
    });
  }

  // List all reservation keys
  const list = await env.RESERVATIONS.list({ prefix: 'reservation:' });
  const reservations = [];

  for (const key of list.keys) {
    const resJson = await env.RESERVATIONS.get(key.name);
    if (resJson) {
      reservations.push(JSON.parse(resJson));
    }
  }

  // Sort by creation date (newest first)
  reservations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return new Response(JSON.stringify(reservations), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * List all shows (admin only)
 */
async function handleAdminShows(request, env, corsHeaders) {
  // Simple auth check
  const auth = request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', {
      status: 401,
      headers: corsHeaders
    });
  }

  const showsJson = await env.RESERVATIONS.get('shows');
  const shows = showsJson ? JSON.parse(showsJson) : [];

  return new Response(JSON.stringify(shows), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Delete a reservation (admin only)
 */
async function handleDeleteReservation(request, env, corsHeaders, reservationId) {
  // Auth check
  const auth = request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { ...corsHeaders, 'WWW-Authenticate': 'Bearer' }
    });
  }

  try {
    // Get the reservation
    const reservationData = await env.RESERVATIONS.get(`reservation:${reservationId}`);
    if (!reservationData) {
      return new Response(JSON.stringify({ error: 'Reservation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const reservation = JSON.parse(reservationData);

    // Get current shows
    const showsData = await env.RESERVATIONS.get('shows');
    const shows = showsData ? JSON.parse(showsData) : [];

    // Find the show and update reserved count
    const show = shows.find(s => s.id === reservation.showId);
    if (show) {
      show.reserved = Math.max(0, (show.reserved || 0) - reservation.tickets);
      await env.RESERVATIONS.put('shows', JSON.stringify(shows));
    }

    //Delete the reservation
    await env.RESERVATIONS.delete(`reservation:${reservationId}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Reservation deleted',
      freedTickets: reservation.tickets
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Send confirmation email using Cloudflare Email Workers (or MailChannels as fallback)
 */
async function sendConfirmationEmail(env, { name, email, showTitle, showDate, showTime, location, tickets }) {
  // Calculate box office opening time (15 minutes before show)
  const [hours, minutes] = showTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes - 15;
  const boxOfficeHours = Math.floor(totalMinutes / 60);
  const boxOfficeMinutes = totalMinutes % 60;
  const boxOfficeTime = `${String(boxOfficeHours).padStart(2, '0')}:${String(boxOfficeMinutes).padStart(2, '0')}`;

  const emailHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Space+Grotesk:wght@600;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #dd4462 0%, #4467dd 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      font-family: 'Space Grotesk', sans-serif;
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .header .emoji {
      font-size: 48px;
      display: block;
      margin-bottom: 16px;
      line-height: 1;
    }
    .content {
      padding: 40px 30px;
    }
    .content p {
      margin-bottom: 16px;
    }
    .greeting {
      font-size: 18px;
      color: #555;
      margin-bottom: 8px;
    }
    .intro {
      font-size: 16px;
      margin-bottom: 24px;
    }
    .ticket-info {
      background: linear-gradient(to right, rgba(221, 68, 98, 0.05) 0%, rgba(68, 103, 221, 0.05) 100%);
      padding: 24px;
      border-left: 4px solid #dd4462;
      margin: 24px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
    .ticket-info p {
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .ticket-info p:last-child {
      margin-bottom: 0;
    }
    .ticket-info strong {
      color: #dd4462;
      font-weight: 600;
      font-family: 'Space Grotesk', sans-serif;
      flex-shrink: 0;
      margin-right: 16px;
    }
    .ticket-info span {
      text-align: right;
      font-weight: 500;
    }
    .section-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #222;
      margin: 24px 0 16px 0;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0 0 24px 0;
    }
    ul li {
      padding: 12px 0 12px 32px;
      position: relative;
      border-bottom: 1px solid #eee;
    }
    ul li:last-child {
      border-bottom: none;
    }
    ul li:before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #dd4462;
      font-weight: bold;
      font-size: 18px;
    }
    ul li strong {
      color: #dd4462;
      font-weight: 600;
    }
    .closing {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 2px solid #f0f0f0;
    }
    .signature {
      font-weight: 600;
      color: #222;
      margin-top: 8px;
    }
    .footer {
      background: #f8f8f8;
      text-align: center;
      padding: 24px 30px;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #eee;
    }
    .footer p {
      margin-bottom: 8px;
    }
    .footer-note {
      font-size: 12px;
      color: #999;
      margin-top: 16px;
    }
    .website-link {
      color: #dd4462;
      text-decoration: none;
      font-weight: 600;
    }
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .header { padding: 30px 20px; }
      .header h1 { font-size: 24px; }
      .content { padding: 30px 20px; }
      .ticket-info { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="emoji">🎭</span>
      <h1>Reservierung bestätigt!</h1>
    </div>

    <div class="content">
      <p class="greeting">Hallo ${name},</p>

      <p class="intro">Deine Reservierung für <strong>${showTitle}</strong> wurde erfolgreich bestätigt!</p>

      <div class="ticket-info">
        <p><strong>Stück:</strong> <span>${showTitle}</span></p>
        <p><strong>Datum:</strong> <span>${showDate}</span></p>
        <p><strong>Ort:</strong> <span>${location}</span></p>
        <p><strong>Anzahl Karten:</strong> <span>${tickets}</span></p>
        <p><strong>Eintritt:</strong> <span>Auf Spendenbasis</span></p>
      </div>

      <h2 class="section-title">Wichtige Hinweise</h2>
      <ul>
        <li>Die Karten sind bis <strong>Einlass (${boxOfficeTime} Uhr)</strong> für dich reserviert</li>
        <li>Einlass ist ab <strong>${boxOfficeTime} Uhr</strong> (15 Minuten vor Vorstellungsbeginn)</li>
        <li>Das Stück beginnt um <strong>${showTime} Uhr</strong></li>
        <li>Bei Nichterscheinen bis Einlass werden die Karten wieder freigegeben</li>
      </ul>

      <div class="closing">
        <p>Wir freuen uns auf deinen Besuch!</p>
        <p class="signature">Viele Grüße,<br>Die Bruchbühne</p>
      </div>
    </div>

    <div class="footer">
      <p><strong>Bruchbühne Tübingen</strong> | <a href="https://bruchbuehne.de" class="website-link">bruchbuehne.de</a></p>
      <p class="footer-note">
        Diese E-Mail wurde automatisch generiert. Bei Fragen antworte einfach auf diese E-Mail.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const emailText = `
Reservierung bestätigt!

Hallo ${name},

Deine Reservierung für ${showTitle} wurde erfolgreich bestätigt!

Stück: ${showTitle}
Datum: ${showDate}
Ort: ${location}
Anzahl Karten: ${tickets}
Eintritt: Auf Spendenbasis

Wichtige Hinweise:
- Die Karten sind bis Einlass (${boxOfficeTime} Uhr) für dich reserviert
- Einlass ist ab ${boxOfficeTime} Uhr (15 Minuten vor Vorstellungsbeginn)
- Das Stück beginnt um ${showTime} Uhr
- Bei Nichterscheinen bis Einlass werden die Karten wieder freigegeben

Wir freuen uns auf deinen Besuch!

Viele Grüße,
Die Bruchbühne

---
Bruchbühne Tübingen | bruchbuehne.de
Diese E-Mail wurde automatisch generiert. Bei Fragen antworte einfach auf diese E-Mail.
  `.trim();

  try {
    // Use Resend API for email delivery
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Bruchbühne Tübingen <reservierungen@bruchbuehne.de>',
        to: [email],
        subject: `Reservierungsbestätigung - ${showTitle}`,
        html: emailHtml,
        text: emailText
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Resend API error:', errorData);
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('✅ Email sent successfully via Resend:', result.id);
    return true;
  } catch (error) {
    console.error('❌ Email send failed:', error);
    throw error;
  }
}

/**
 * Sync reservation to Google Sheets
 */
async function syncToGoogleSheets(env, reservation) {
  try {
    const response = await fetch(env.GOOGLE_SHEETS_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reservation)
    });

    if (!response.ok) {
      throw new Error(`Google Sheets API returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log('✅ Synced to Google Sheets:', result);
    return true;
  } catch (error) {
    console.error('❌ Google Sheets sync failed:', error);
    throw error;
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Admin Dashboard HTML
 */
function handleAdminDashboard() {
  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bruchbühne Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Serif:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-bg: #ececec;
      --color-surface: #fcfcfc;
      --color-text: #1d1d1f;
      --color-accent: #ff4e00;
      --color-accent-hover: #e04500;
      --color-border: #b0b0b0;
      --color-border-strong: #1d1d1f;
      --color-muted: #6e6e73;
      --color-success: #34c759;
      --color-warning: #ffce00;
      --color-danger: #ff3b30;
      
      --font-serif: 'IBM Plex Serif', serif;
      --font-mono: 'IBM Plex Mono', monospace;
      
      --space-sm: 1rem;
      --space-md: 2rem;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: var(--font-serif);
      color: var(--color-text);
      background-color: var(--color-bg);
      line-height: 1.5;
      min-height: 100vh;
      padding: var(--space-md);
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: var(--space-md);
      padding-bottom: var(--space-sm);
      border-bottom: 2px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .subtitle {
      font-family: var(--font-mono);
      font-size: 0.875rem;
      color: var(--color-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Auth Form */
    .auth-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
    }

    .auth-box {
      background: var(--color-surface);
      border: 2px solid var(--color-border-strong);
      padding: var(--space-md);
      width: 100%;
      max-width: 400px;
      position: relative;
      box-shadow: 4px 4px 0 rgba(0,0,0,0.1);
    }

    /* Dashboard Grid */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--space-sm);
      margin-bottom: var(--space-md);
    }

    .stat-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: var(--space-sm);
      position: relative;
    }
    
    .stat-card::before {
      content: '';
      position: absolute;
      top: -1px; left: -1px;
      width: 8px; height: 8px;
      border-top: 2px solid var(--color-border-strong);
      border-left: 2px solid var(--color-border-strong);
    }

    .stat-card h3 {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--color-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .stat-card .number {
      font-family: var(--font-mono);
      font-size: 2rem;
      font-weight: 600;
      color: var(--color-accent);
    }

    /* Sections */
    .section {
      margin-bottom: var(--space-md);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: var(--space-sm);
      position: relative;
    }
    
    .section h2 {
      font-family: var(--font-mono);
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: var(--space-sm);
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Tables */
    .table-wrapper {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font-mono);
      font-size: 0.875rem;
    }

    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px dashed var(--color-border);
    }

    th {
      font-weight: 600;
      color: var(--color-muted);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background-color: rgba(0,0,0,0.02); }

    /* Controls */
    input, button {
      font-family: var(--font-mono);
      font-size: 0.875rem;
      padding: 0.6em 1em;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      width: 100%;
      margin-bottom: 1rem;
      border-radius: 0;
    }

    input:focus {
      outline: none;
      border-color: var(--color-accent);
    }

    button {
      background: var(--color-surface);
      color: var(--color-text);
      border: 2px solid var(--color-border-strong);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      cursor: pointer;
      width: auto;
      margin-bottom: 0;
      box-shadow: 2px 2px 0 rgba(0,0,0,0.1);
      transition: all 0.1s;
    }

    button:hover {
      transform: translateY(-1px);
      box-shadow: 3px 3px 0 rgba(0,0,0,0.1);
      border-color: var(--color-accent);
      color: var(--color-accent);
    }

    button:active {
      transform: translateY(1px);
      box-shadow: 1px 1px 0 rgba(0,0,0,0.1);
    }

    .btn-login {
      width: 100%;
      background: var(--color-accent);
      color: white;
      border-color: var(--color-accent);
    }
    
    .btn-login:hover {
      color: white;
      background: var(--color-accent-hover);
    }

    .delete-btn {
      padding: 0.3em 0.6em;
      font-size: 0.75rem;
      border-color: var(--color-border);
      color: var(--color-danger);
    }
    
    .delete-btn:hover {
      border-color: var(--color-danger);
      color: var(--color-danger);
      background: rgba(255, 59, 48, 0.1);
    }

    .logout-btn {
      font-size: 0.75rem;
      padding: 0.4em 0.8em;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 6px;
      font-size: 0.7rem;
      border: 1px solid currentColor;
      text-transform: uppercase;
    }
    
    .badge.success { color: var(--color-success); border-color: var(--color-success); }
    .badge.warning { color: var(--color-warning); border-color: var(--color-warning); }
    .badge.danger { color: var(--color-danger); border-color: var(--color-danger); }
    
    .error {
      color: var(--color-danger);
      font-family: var(--font-mono);
      font-size: 0.875rem;
      margin-bottom: 1rem;
      padding: 0.5rem;
      border: 1px solid var(--color-danger);
      display: none;
    }

    .empty-state {
      text-align: center;
      padding: var(--space-md);
      color: var(--color-muted);
      font-family: var(--font-mono);
      font-style: italic;
    }
    
    .loading {
      text-align: center;
      padding: var(--space-md);
      font-family: var(--font-mono);
      color: var(--color-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Login Form -->
    <div id="auth-form" class="auth-wrapper">
      <div class="auth-box">
        <h2 style="font-family: var(--font-mono); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">Admin Access</h2>
        <div id="auth-error" class="error"></div>
        <input type="password" id="admin-token" placeholder="ADMIN TOKEN" autofocus>
        <button onclick="login()" class="btn-login">Unlock Terminal</button>
      </div>
    </div>

    <!-- Main Content -->
    <div id="content" class="content" style="display: none;">
      <header class="header">
        <div>
          <h1>Bruchbühne Admin</h1>
          <p class="subtitle">System Dashboard</p>
        </div>
        <button class="logout-btn" onclick="logout()">Disconnect</button>
      </header>

      <div class="stats" id="stats">
        <div class="stat-card">
          <h3>Total Reservations</h3>
          <div class="number" id="total-reservations">-</div>
        </div>
        <div class="stat-card">
          <h3>Tickets Sold</h3>
          <div class="number" id="total-tickets">-</div>
        </div>
        <div class="stat-card">
          <h3>Active Shows</h3>
          <div class="number" id="active-shows">-</div>
        </div>
        <div class="stat-card">
          <h3>Utilization</h3>
          <div class="number" id="utilization">-</div>
        </div>
      </div>

      <div class="section">
        <h2>
          <span>Reservations Log</span>
          <span style="font-size: 0.75rem; color: var(--color-muted);" id="res-count"></span>
        </h2>
        <div id="reservations-container" class="table-wrapper">
          <div class="loading">Loading data...</div>
        </div>
      </div>

      <div class="section">
        <h2>Production Status</h2>
        <div id="shows-container" class="table-wrapper">
          <div class="loading">Loading data...</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let token = localStorage.getItem('adminToken');

    // Check if already logged in
    if (token) {
      loadDashboard();
    }

    function login() {
      token = document.getElementById('admin-token').value;
      if (!token) {
        showError('ACCESS DENIED: Token required');
        return;
      }
      localStorage.setItem('adminToken', token);
      loadDashboard();
    }

    // Make functions globally accessible
    window.login = login;
    window.logout = logout;

    function logout() {
      localStorage.removeItem('adminToken');
      token = null;
      document.getElementById('auth-form').style.display = 'flex';
      document.getElementById('content').style.display = 'none';
    }

    function showError(message) {
      const errorEl = document.getElementById('auth-error');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }

    async function loadDashboard() {
      try {
        // Hide auth form, show content
        document.getElementById('auth-form').style.display = 'none';
        document.getElementById('content').style.display = 'block';

        // Fetch reservations and shows
        const [reservations, shows] = await Promise.all([
          fetchReservations(),
          fetchShows()
        ]);

        if (!reservations || !shows) {
          logout();
          showError('ACCESS DENIED: Invalid Token');
          return;
        }

        // Update stats
        updateStats(reservations, shows);

        // Render tables
        renderReservations(reservations);
        renderShows(shows);

      } catch (error) {
        console.error('Load error:', error);
        logout();
        showError('SYSTEM ERROR: Data load failed');
      }
    }

    async function fetchReservations() {
      const response = await fetch('/admin/reservations', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (!response.ok) return null;
      return response.json();
    }

    async function fetchShows() {
      const response = await fetch('/admin/shows', {
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (!response.ok) return null;
      return response.json();
    }

    function updateStats(reservations, shows) {
      const totalTickets = reservations.reduce((sum, r) => sum + r.tickets, 0);
      const futureShows = shows.filter(s => new Date(s.date) >= new Date());
      const totalCapacity = futureShows.reduce((sum, s) => sum + s.capacity, 0);
      const totalReserved = futureShows.reduce((sum, s) => sum + (s.reserved || 0), 0);
      const utilization = totalCapacity > 0 ? Math.round((totalReserved / totalCapacity) * 100) : 0;

      document.getElementById('total-reservations').textContent = reservations.length;
      document.getElementById('total-tickets').textContent = totalTickets;
      document.getElementById('active-shows').textContent = futureShows.length;
      document.getElementById('utilization').textContent = utilization + '%';
      document.getElementById('res-count').textContent = \`[\${reservations.length} ENTRIES]\`;
    }

    function renderReservations(reservations) {
      const container = document.getElementById('reservations-container');

      if (reservations.length === 0) {
        container.innerHTML = '<div class="empty-state">No active reservations found in database.</div>';
        return;
      }

      let tableRows = '';
      reservations.forEach(r => {
        tableRows += '<tr>';
        tableRows += '<td><strong>' + escapeHtml(r.name) + '</strong><br><span style="font-size:0.75em; color:var(--color-muted)">' + escapeHtml(r.email) + '</span></td>';
        tableRows += '<td>' + escapeHtml(r.showTitle) + '<br><span style="font-size:0.75em">' + escapeHtml(r.showDateFormatted) + '</span></td>';
        tableRows += '<td><span class="badge">' + r.tickets + ' TIX</span></td>';
        tableRows += '<td><span style="font-size:0.75em; color:var(--color-muted)">' + formatDate(r.createdAt) + '</span></td>';
        tableRows += '<td style="text-align:right"><button class="delete-btn" onclick="deleteReservation(&quot;' + r.id + '&quot;, &quot;' + escapeHtml(r.name) + '&quot;)">DEL</button></td>';
        tableRows += '</tr>';
      });

      const html = '<table><thead><tr>' +
        '<th>Contact</th><th>Production</th>' +
        '<th>QTY</th><th>Timestamp</th><th style="text-align:right">Action</th>' +
        '</tr></thead><tbody>' + tableRows + '</tbody></table>';
        
      container.innerHTML = html;
    }

    async function deleteReservation(reservationId, name) {
      if (!confirm('CONFIRM DELETION: ' + name + '?')) {
        return;
      }

      try {
        const response = await fetch('/admin/reservations/' + reservationId, {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });

        if (response.ok) {
          const result = await response.json();
          // Ideally toast, but alert is fine for now
          loadDashboard(); 
        } else {
          const error = await response.json();
          alert('ERROR: ' + (error.error || 'Unknown'));
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert('SYSTEM ERROR: Delete failed');
      }
    }

    window.deleteReservation = deleteReservation;

    function renderShows(shows) {
      const container = document.getElementById('shows-container');

      if (shows.length === 0) {
        container.innerHTML = '<div class="empty-state">No productions scheduled.</div>';
        return;
      }

      shows.sort((a, b) => new Date(a.date) - new Date(b.date));

      let showRows = '';
      shows.forEach(s => {
        const reserved = s.reserved || 0;
        const remaining = s.capacity - reserved;
        const percentage = Math.round((reserved / s.capacity) * 100);
        const isPast = new Date(s.date) < new Date();
        const isFull = remaining === 0;

        let statusBadge = '';
        if (isPast) {
          statusBadge = '<span class="badge" style="color:var(--color-muted); border-color:var(--color-muted)">PAST</span>';
        } else if (isFull) {
          statusBadge = '<span class="badge danger">SOLD OUT</span>';
        } else if (percentage > 80) {
          statusBadge = '<span class="badge warning">FILLING</span>';
        } else {
          statusBadge = '<span class="badge success">OPEN</span>';
        }

        showRows += '<tr>';
        showRows += '<td><strong>' + escapeHtml(s.title) + '</strong></td>';
        showRows += '<td>' + escapeHtml(s.dateFormatted) + '</td>';
        showRows += '<td>' + s.capacity + ' / <span style="color:var(--color-accent)">' + reserved + '</span></td>';
        showRows += '<td>' + statusBadge + '</td>';
        showRows += '</tr>';
      });

      const html = '<table><thead><tr>' +
        '<th>Title</th><th>Date</th>' +
        '<th>Cap / Res</th><th>Status</th>' +
        '</tr></thead><tbody>' + showRows + '</tbody></table>';
        
      container.innerHTML = html;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatDate(isoString) {
      const date = new Date(isoString);
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  </script>
</body>
</html>
  `.trim();

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
