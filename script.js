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
      if (typeof fbq !== 'undefined') {
        fbq('trackCustom', 'ClickBookCTA', { source: this.dataset.cta || 'unknown' });
      }
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

      const payload = {
        nom: data.get('nom') || '',
        telephone: data.get('telephone') || '',
        courriel: data.get('courriel') || '',
        domaine: data.get('domaine') || '',
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
          alert("Une erreur s'est produite. Vérifie ta connexion et réessaie.");
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  // Écoute Calendly : event scheduled → pixel Schedule
  window.addEventListener('message', (e) => {
    if (typeof e.data === 'object' && e.data && e.data.event &&
        typeof e.data.event === 'string' && e.data.event.indexOf('calendly.event_scheduled') === 0) {
      if (typeof fbq !== 'undefined') fbq('track', 'Schedule');
    }
  });
})();
