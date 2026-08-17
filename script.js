/* ============================================================= */
/* SUNA FILMS MEDIA — Landing /ai — comportement                 */
/* ============================================================= */
(function () {
  const unlockBtn = document.getElementById('unlockBtn');
  const modal     = document.getElementById('leadModal');
  const backdrop  = document.getElementById('modalBackdrop');
  const closeBtn  = document.getElementById('closeModal');
  const form      = document.getElementById('leadForm');
  const overlay   = document.getElementById('lockOverlay');
  const wrap      = document.getElementById('calendarWrap');
  const calendar  = document.querySelector('.lp-booking__calendar');

  let lastFocused = null;

  // Wrapper sûr : Clarity peut ne pas être chargé (bloqueur de pub, réseau lent).
  function track(name, key, value) {
    try {
      if (typeof clarity === 'undefined') return;
      if (name)  clarity('event', name);
      if (key)   clarity('set', key, value);
    } catch (e) { /* le tracking ne doit jamais casser le tunnel */ }
  }

  // ===== Attribution Meta : fbclid + cookies _fbc / _fbp =====
  function getCookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return m ? decodeURIComponent(m.pop()) : '';
  }

  // Au chargement : mémorise le fbclid de l'URL (persiste si l'utilisateur reste/revient).
  (function persistFbclid() {
    try {
      var fromUrl = new URLSearchParams(location.search).get('fbclid');
      if (fromUrl) localStorage.setItem('sfm_fbclid', fromUrl);
    } catch (e) { /* localStorage indisponible : on lira l'URL au submit */ }
  })();

  // Renvoie les identifiants d'attribution Meta à joindre au lead.
  function getFbData() {
    var fbclid = '';
    try { fbclid = localStorage.getItem('sfm_fbclid') || ''; } catch (e) {}
    if (!fbclid) {
      try { fbclid = new URLSearchParams(location.search).get('fbclid') || ''; } catch (e) {}
    }

    var fbc = getCookie('_fbc');
    // Si le cookie _fbc n'existe pas encore mais qu'on a le fbclid, on reconstruit
    // le format attendu par Meta : fb.1.<timestamp>.<fbclid>
    if (!fbc && fbclid) {
      fbc = 'fb.1.' + Date.now() + '.' + fbclid;
    }

    return {
      fbclid: fbclid,
      fbc: fbc,
      fbp: getCookie('_fbp'),
      landing_url: location.href,
    };
  }

  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      const first = form.querySelector('input[name="nom"]');
      if (first) first.focus();
    }, 100);
  }

  function closeModalFn() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  // TOUS les CTAs "Prendre mon rendez-vous" ouvrent le form d'abord
  document.querySelectorAll('.lp-track-cta').forEach((btn) => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var src = this.dataset.cta || 'unknown';
      if (typeof fbq !== 'undefined') {
        fbq('trackCustom', 'ClickBookCTA', { source: src });
      }
      track('click_cta', 'cta_source', src);
      if (wrap && wrap.classList.contains('is-unlocked')) {
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        openModal();
      }
    });
  });

  if (unlockBtn) unlockBtn.addEventListener('click', openModal);
  if (backdrop)  backdrop.addEventListener('click', closeModalFn);
  if (closeBtn)  closeBtn.addEventListener('click', closeModalFn);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModalFn();
  });

  // Submit du form → serverless function Vercel → GHL + email
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Validation native (novalidate sur le form → on déclenche manuellement)
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const data = new FormData(form);

      // Vérif honeypot
      if (data.get('website')) {
        console.warn('Bot détecté');
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      const fb = getFbData();
      const payload = {
        nom: data.get('nom') || '',
        telephone: data.get('telephone') || '',
        courriel: data.get('courriel') || '',
        domaine: data.get('domaine') || '',
        // Attribution Meta
        fbclid: fb.fbclid,
        fbc: fb.fbc,
        fbp: fb.fbp,
        landing_url: fb.landing_url,
      };

      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Server error');
          return res.json();
        })
        .then(() => {
          if (typeof fbq !== 'undefined') fbq('track', 'Lead');
          track('lead_submitted', 'lead', 'yes');
          track('calendar_unlocked', 'domaine', payload.domaine || 'non renseigne');
          if (overlay)  overlay.classList.add('is-hidden');
          if (calendar) calendar.classList.add('is-unlocked');
          if (wrap)     wrap.classList.add('is-unlocked');
          closeModalFn();
          setTimeout(() => {
            if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        })
        .catch((err) => {
          console.error(err);
          track('lead_error', 'lead', 'error');
          alert("Une erreur s'est produite. Vérifie ta connexion et réessaie.");
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  // ===== Slider Impact : flèches prev/next =====
  (function initSliders() {
    document.querySelectorAll('[data-slider]').forEach(function (slider) {
      var track = slider.querySelector('[data-track]');
      var prev  = slider.querySelector('[data-prev]');
      var next  = slider.querySelector('[data-next]');
      if (!track) return;

      function step() {
        var card = track.querySelector('.lp-icard');
        var gap = 18;
        return card ? card.offsetWidth + gap : track.clientWidth * 0.8;
      }
      function update() {
        if (!prev || !next) return;
        var max = track.scrollWidth - track.clientWidth - 2;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max;
      }
      if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
      if (next) next.addEventListener('click', function () { track.scrollBy({ left:  step(), behavior: 'smooth' }); });
      track.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    });
  })();

  // ===== VSL : bouton « Activer le son » =====
  // L'autoplay est imposé muet par les navigateurs. Au 1er clic (geste utilisateur),
  // on réactive le son via l'API YouTube. Fallback : rechargement de l'iframe non-muet.
  (function initUnmute() {
    var btn = document.getElementById('unmuteBtn');
    var iframe = document.getElementById('vslPlayer');
    if (!btn || !iframe) return;

    var player = null;

    // Charge l'API IFrame YouTube
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = function () {
      try {
        player = new YT.Player('vslPlayer');
      } catch (e) { /* fallback gérera */ }
    };

    function hideOverlay() {
      btn.classList.add('is-hidden');
    }

    btn.addEventListener('click', function () {
      var done = false;
      if (player && typeof player.unMute === 'function') {
        try {
          player.unMute();
          player.setVolume(100);
          player.playVideo();
          done = true;
        } catch (e) { done = false; }
      }
      // Fallback : recharge la vidéo avec le son actif (le clic autorise l'audio)
      if (!done) {
        var base = 'https://www.youtube.com/embed/QQHwfrj70tM';
        iframe.src = base + '?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1&controls=1&enablejsapi=1';
      }
      hideOverlay();
      if (typeof fbq !== 'undefined') fbq('trackCustom', 'VideoUnmute');
      track('video_unmuted', 'unmuted', 'yes');
    });
  })();

  // Écoute le widget de réservation GHL : RDV confirmé → pixel Schedule.
  // Le format des messages GHL n'est pas documenté de façon stable, donc on filtre
  // sur l'origine LeadConnector/msgsndr + des mots-clés de réservation, avec anti-doublon.
  // Source de vérité côté business = les workflows GHL ; ceci sert au tracking pub.
  var scheduleFired = false;
  window.addEventListener('message', function (e) {
    if (scheduleFired) return;
    var origin = e.origin || '';
    if (!/leadconnectorhq\.com|msgsndr\.com|gohighlevel\.com/i.test(origin)) return;

    var raw = '';
    try { raw = typeof e.data === 'string' ? e.data : JSON.stringify(e.data || ''); } catch (x) {}
    // Ignore les messages de simple redimensionnement du widget
    if (/height|resize|setheight/i.test(raw) && !/appoint|book|schedul|confirm/i.test(raw)) return;

    if (/appointment.?booked|booking.?(success|complete|confirmed)|schedul|slotbooked/i.test(raw)) {
      scheduleFired = true;
      if (typeof fbq !== 'undefined') fbq('track', 'Schedule');
      track('booking_scheduled', 'booked', 'yes');
    }
  });
})();
