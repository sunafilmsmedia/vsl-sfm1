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
          // Redirige vers la page /rdv (vidéo + calendrier), en passant les infos pour pré-remplir
          var qp = new URLSearchParams();
          qp.set('name', payload.nom);
          qp.set('email', payload.courriel);
          qp.set('phone', payload.telephone);
          setTimeout(function () {
            window.location.href = '/rdv?' + qp.toString();
          }, 250);
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

  // ===== VSL : miniature → lecture au clic (pas d'autoplay) =====
  (function initVideoFacade() {
    var VIDEO_ID = 'QQHwfrj70tM';
    var facade = document.getElementById('videoFacade');
    var box = facade && facade.closest('.lp-hero__video');
    if (!facade || !box) return;

    var player = null;
    function setRate() {
      try {
        player = new YT.Player('vslPlayer', {
          events: {
            onReady: function (e) {
              try { e.target.setPlaybackRate(1.2); e.target.playVideo(); } catch (x) {}
            }
          }
        });
      } catch (e) {}
    }

    facade.addEventListener('click', function () {
      // Le clic (geste utilisateur) autorise la lecture AVEC le son
      var iframe = document.createElement('iframe');
      iframe.id = 'vslPlayer';
      iframe.title = 'Vidéo Suna Films Media';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
      iframe.src = 'https://www.youtube.com/embed/' + VIDEO_ID +
        '?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1&controls=1&enablejsapi=1';
      box.appendChild(iframe);
      facade.remove();

      if (typeof fbq !== 'undefined') fbq('trackCustom', 'VideoPlay');
      track('video_play', 'played', 'yes');

      // Lecture ×1.2 via l'API
      if (window.YT && window.YT.Player) {
        setRate();
      } else {
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
        window.onYouTubeIframeAPIReady = setRate;
      }
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
