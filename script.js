/* ============================================================= */
/* SUNA FILMS MEDIA — Landing /ai — comportement                 */
/* ============================================================= */
(function () {
  const form         = document.getElementById('leadForm');
  const applyModal   = document.getElementById('applyModal');
  const applyBackdrop= document.getElementById('applyBackdrop');
  const applyClose   = document.getElementById('applyClose');
  let   lastFocused  = null;

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

  // Ouvre / ferme la modal du formulaire d'application
  function openApplyModal() {
    if (!applyModal) return;
    lastFocused = document.activeElement;
    applyModal.classList.add('is-open');
    applyModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (form && typeof form._stepShow === 'function') form._stepShow(0, false);
    setTimeout(function () {
      var first = form && form.querySelector('input[name="nom"]');
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
    }, 120);
  }
  function closeApplyModal() {
    if (!applyModal) return;
    applyModal.classList.remove('is-open');
    applyModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  // TOUS les CTAs "Applique pour travailler avec nous" ouvrent la modal
  document.querySelectorAll('.lp-track-cta').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var src = this.dataset.cta || 'unknown';
      if (typeof fbq !== 'undefined') fbq('trackCustom', 'ClickBookCTA', { source: src });
      track('click_cta', 'cta_source', src);
      openApplyModal();
    });
  });
  if (applyBackdrop) applyBackdrop.addEventListener('click', closeApplyModal);
  if (applyClose)    applyClose.addEventListener('click', closeApplyModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && applyModal && applyModal.classList.contains('is-open')) closeApplyModal();
  });

  // ===== Formulaire multi-étapes (une question à la fois) =====
  (function initSteps() {
    if (!form) return;
    var steps = Array.prototype.slice.call(form.querySelectorAll('.lp-apply__step'));
    if (!steps.length) return;
    var bar = document.getElementById('applyBar');
    var num = document.getElementById('applyStepNum');
    var domaineInput = document.getElementById('lead-domaine');
    var cur = 0;

    function show(i, focus) {
      steps.forEach(function (s, idx) { s.classList.toggle('is-active', idx === i); });
      cur = i;
      if (bar) bar.style.width = ((i + 1) / steps.length * 100) + '%';
      if (num) num.textContent = (i + 1);
      if (focus !== false) {
        var inp = steps[i].querySelector('input:not([type=hidden])');
        setTimeout(function () { if (inp) { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } } }, 80);
      }
    }
    function validCurrent() {
      var inp = steps[cur].querySelector('input:not([type=hidden])');
      if (inp && !inp.checkValidity()) { inp.reportValidity(); return false; }
      return true;
    }
    form.querySelectorAll('[data-next]').forEach(function (btn) {
      btn.addEventListener('click', function () { if (validCurrent() && cur < steps.length - 1) show(cur + 1); });
    });
    form.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', function () { if (cur > 0) show(cur - 1); });
    });
    // Choix du domaine
    form.querySelectorAll('.lp-apply__choice').forEach(function (c) {
      c.addEventListener('click', function () {
        form.querySelectorAll('.lp-apply__choice').forEach(function (x) { x.classList.remove('is-selected'); });
        c.classList.add('is-selected');
        if (domaineInput) domaineInput.value = c.dataset.value || '';
      });
    });
    // Entrée = étape suivante (sauf dernière)
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && cur < steps.length - 1) {
        e.preventDefault();
        if (validCurrent()) show(cur + 1);
      }
    });
    // expose pour le handler submit
    form._stepShow = show;
    show(0, false);
  })();

  // Submit du form → serverless function Vercel → GHL + email
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Validation native (novalidate sur le form → on déclenche manuellement)
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      // Le domaine (étape 4) doit être choisi
      var domaineEl = document.getElementById('lead-domaine');
      if (domaineEl && !domaineEl.value) {
        var choices = form.querySelector('.lp-apply__choices');
        if (choices) choices.classList.add('is-error');
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

          // Pré-remplit le widget GHL avec les infos saisies
          var iframe = document.getElementById('ghlBooking');
          if (iframe) {
            var parts = (payload.nom || '').trim().split(/\s+/);
            var first = parts.shift() || '';
            var last = parts.join(' ');
            var qs = [];
            if (first) qs.push('first_name=' + encodeURIComponent(first));
            if (last)  qs.push('last_name=' + encodeURIComponent(last));
            if (payload.courriel)  qs.push('email=' + encodeURIComponent(payload.courriel));
            if (payload.telephone) qs.push('phone=' + encodeURIComponent(payload.telephone));
            iframe.src = 'https://api.leadconnectorhq.com/widget/booking/SUZpHLDFesSyKJdqzXlI' + (qs.length ? '?' + qs.join('&') : '');
          }

          // Déverrouille le calendrier sur la page
          var cal     = document.querySelector('.lp-booking__calendar');
          var overlay = document.getElementById('lockOverlay');
          var wrap    = document.getElementById('calendarWrap');
          if (cal)     cal.classList.add('is-unlocked');
          if (overlay) overlay.classList.add('is-hidden');
          closeApplyModal();
          setTimeout(function () {
            if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 350);
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
    var bar = document.getElementById('vslBar');
    var barTimer = null;
    // Barre "fake" pilotée par la durée réelle :
    //  - atteint 50 % en 30 s (temps réel écoulé)
    //  - puis progresse normalement jusqu'à la fin de la vidéo
    function startBar() {
      if (barTimer || !bar) return;
      bar.style.transition = 'width 0.25s linear';
      barTimer = setInterval(function () {
        if (!player || typeof player.getCurrentTime !== 'function') return;
        var dur = 0, cur = 0, rate = 1.2;
        try {
          dur  = player.getDuration()     || 0;
          cur  = player.getCurrentTime()  || 0;
          rate = player.getPlaybackRate() || 1.2;
        } catch (e) { return; }
        if (dur <= 0) return; // métadonnées pas encore prêtes
        var wallElapsed = cur / rate;   // secondes réelles écoulées
        var wallTotal   = dur / rate;   // durée réelle de lecture
        var pct;
        if (wallTotal <= 30) {
          pct = (wallElapsed / wallTotal) * 100;
        } else if (wallElapsed <= 30) {
          pct = (wallElapsed / 30) * 50;                       // 0 → 50 % en 30 s
        } else {
          pct = 50 + ((wallElapsed - 30) / (wallTotal - 30)) * 50; // 50 → 100 % ensuite
        }
        pct = Math.max(0, Math.min(100, pct));
        bar.style.width = pct + '%';
        if (pct >= 100) { clearInterval(barTimer); barTimer = null; }
      }, 200);
    }

    // Charge l'API IFrame YouTube
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = function () {
      try {
        player = new YT.Player('vslPlayer', {
          events: {
            onReady: function (e) {
              try { e.target.setPlaybackRate(1.2); } catch (x) {} // lecture ×1.2
            },
            onStateChange: function (e) {
              if (e.data === 1) { // PLAYING
                startBar();
                try { e.target.setPlaybackRate(1.2); } catch (x) {} // re-force ×1.2
              }
            }
          }
        });
      } catch (e) { /* fallback gérera */ }
    };

    // Filet de sécurité : si l'API tarde, on lance la barre après le chargement.
    window.addEventListener('load', function () { setTimeout(startBar, 1500); });

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
        var base = 'https://www.youtube.com/embed/Aot3s447dFA';
        iframe.src = base + '?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1&controls=0&disablekb=1&enablejsapi=1';
      }
      startBar();
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
