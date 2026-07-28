/* Mobile navigation + reservation form feedback. */
(function () {
  'use strict';

  var toggle = document.querySelector('.nav-toggle');
  var panel = document.querySelector('.nav-mobile');

  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        panel.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) {
        panel.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });

    // The panel is desktop-hidden by CSS; drop the open state so it can't
    // reappear mid-resize with a stale aria-expanded.
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 860 && panel.classList.contains('is-open')) {
        panel.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // --- Reservas -----------------------------------------------------------
  var form = document.querySelector('.form');
  var status = document.querySelector('.form__status');
  if (!form || !status) return;

  var submit = form.querySelector('button[type="submit"]');
  var fecha = form.querySelector('#fecha');

  // No dejar elegir días pasados en el propio calendario.
  if (fecha && !fecha.min) fecha.min = new Date().toISOString().slice(0, 10);

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach(function (el) {
      el.hidden = true;
      el.textContent = '';
    });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
  }

  function showErrors(fields) {
    Object.keys(fields || {}).forEach(function (name) {
      var slot = form.querySelector('[data-error-for="' + name + '"]');
      var input = form.querySelector('[name="' + name + '"]');
      if (slot) {
        slot.textContent = fields[name];
        slot.hidden = false;
      }
      if (input) input.setAttribute('aria-invalid', 'true');
    });

    var first = form.querySelector('[aria-invalid]');
    if (first) first.focus();
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = 'form__status' + (kind ? ' form__status--' + kind : '');
    status.hidden = !message;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearErrors();

    var endpoint = form.dataset.endpoint;
    if (!endpoint) {
      setStatus(
        'El formulario todavía no está conectado. Llámanos al 611 51 05 50 y te reservamos la mesa.',
        'error'
      );
      return;
    }

    var payload = {};
    new FormData(form).forEach(function (value, key) {
      payload[key] = typeof value === 'string' ? value.trim() : value;
    });

    submit.disabled = true;
    setStatus('Enviando…', 'pending');

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        if (result.status === 200 && result.data.ok) {
          form.reset();
          setStatus(
            'Gracias — hemos recibido tu solicitud. Te llamamos en breve para confirmarla.',
            'ok'
          );
          return;
        }

        if (result.data.fields) showErrors(result.data.fields);
        setStatus(result.data.error || 'No hemos podido enviar la solicitud.', 'error');
      })
      .catch(function () {
        setStatus(
          'No hemos podido conectar. Revisa tu conexión o llámanos al 611 51 05 50.',
          'error'
        );
      })
      .finally(function () {
        submit.disabled = false;
      });
  });
})();
