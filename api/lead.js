export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { nom, telephone, courriel, domaine, fbclid, fbc, fbp, landing_url } = req.body || {};

  // Validation
  if (!nom || !telephone || !courriel) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(courriel)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const parts     = nom.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName  = parts.slice(1).join(' ') || '';

  // Jour vs nuit selon l'heure locale du Québec (gère automatiquement l'heure avancée).
  // Jour = 08:00–19:59, Nuit = 20:00–07:59.
  const now = new Date();
  let heureLocale;
  try {
    heureLocale = parseInt(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto',
        hour: 'numeric',
        hour12: false,
      }).format(now),
      10
    );
    if (heureLocale === 24) heureLocale = 0; // certains runtimes renvoient "24" pour minuit
  } catch (e) {
    heureLocale = now.getUTCHours(); // fallback improbable
  }
  const estJour  = heureLocale >= 8 && heureLocale < 20;
  const periode  = estJour ? 'jour' : 'nuit';

  const payload = {
    // Standard GHL
    firstName, lastName,
    full_name: nom, name: nom,
    email: courriel, phone: telephone,

    // Français (custom fields)
    nom, telephone, courriel, domaine,

    // Segmentation jour / nuit (heure du Québec) pour router vers la bonne automatisation
    periode,                              // "jour" | "nuit"
    lead_type: `lead_${periode}`,         // "lead_jour" | "lead_nuit"
    heure_quebec: heureLocale,            // 0–23, pour vérification

    // Attribution Meta (fbclid + cookies) pour matching Pixel / Conversions API
    fbclid: fbclid || '',
    fbc: fbc || '',
    fbp: fbp || '',
    landing_url: landing_url || req.headers.referer || '',

    // Metadata
    source: 'ai-landing-sunafilmsmedia',
    page: req.headers.referer || '',
    submitted_at: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
    user_agent: req.headers['user-agent'] || '',
  };

  try {
    // 1. Webhook GHL
    if (!process.env.GHL_WEBHOOK_URL) {
      console.error('GHL_WEBHOOK_URL not configured');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const ghlResp = await fetch(process.env.GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('[GHL]', ghlResp.status);

    // 2. Email de notification (via Resend si configuré)
    if (process.env.RESEND_API_KEY && process.env.NOTIF_EMAIL) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Landing AI <notif@sunafilmsmedia.com>',
          to: process.env.NOTIF_EMAIL,
          subject: `🔥 Nouveau lead AI — ${nom}`,
          html: `
            <h2>Nouveau lead depuis /ai</h2>
            <p><strong>Nom :</strong> ${nom}</p>
            <p><strong>Téléphone :</strong> ${telephone}</p>
            <p><strong>Courriel :</strong> ${courriel}</p>
            <p><strong>Domaine :</strong> ${domaine || '—'}</p>
            <hr>
            <p><small>Source: ${req.headers.referer || '—'}</small></p>
            <p><small>Submitted at: ${payload.submitted_at}</small></p>
          `,
        }),
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Lead handler error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
