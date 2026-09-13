// Screens and flow. Plain English on every screen; never a refund we didn't get from the API.
(function () {
  'use strict';

  var api = window.ReturnRateApi;
  var scan = window.ReturnRateScan;
  var $ = function (id) { return document.getElementById(id); };

  var screens = {};
  Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (el) {
    screens[el.dataset.screen] = el;
  });

  function show(name) {
    Object.keys(screens).forEach(function (k) { screens[k].hidden = (k !== name); });
    document.body.dataset.screen = name;
    window.scrollTo(0, 0);
    if (name !== 'start') scan.stop();
    var h = screens[name].querySelector('.refund, .lead, h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  // The words for each class. Nothing else is ever shown as a class.
  var KIND = {
    regular: 'Pop, water, juice or beer',
    liquor: 'Wine or spirits',
    none: 'Milk and plant milks have no refund',
    brewer: 'Refillable local beer bottle (not part of the MMSB program)'
  };

  function renderAnswer(item) {
    var verdict = $('verdict');
    verdict.className = 'verdict';
    var accepted = item.accepted === true || (item.accepted === undefined && item.class !== 'none');
    verdict.textContent = accepted ? 'Yes, we take this' : "No, we don't take this";
    if (!accepted) verdict.classList.add('no');
    var refund = $('refund');
    refund.className = 'refund';
    if (accepted && typeof item.refund_cents === 'number' && item.refund_cents > 0) {
      refund.textContent = item.refund_cents + '¢' + (item.depot_policy ? ' at APCO' : '');
    } else {
      refund.textContent = 'No refund';
      refund.classList.add('none');
    }
    var size = item.size_ml ? (item.size_ml >= 1000 ? (item.size_ml / 1000) + ' L' : item.size_ml + ' mL') : '';
    $('product').textContent = [item.name, size].filter(Boolean).join(', ');
    $('kind').textContent = KIND[item.class] || '';
    // 'none' covers more than milk; the Worker's one-sentence why says which.
    if (item.class === 'none' && item.why) $('kind').textContent = item.why;
    $('why').textContent = (item.class === 'none') ? '' : (item.why || '');
    show('answer');
  }

  // The label photo (unknown screen) and the barcode photo (start screen).
  function onLabelPhoto(ev) {
    var f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    show('busy'); $('busy-text') && ($('busy-text').textContent = 'Reading the label…');
    api.label(f, lastUpc).then(function (r) {
      if (r.status === 'known') return renderAnswer(r.item);
      if (r.status === 'unknown') { $('unknown-verdict').textContent = r.verdict || 'Try another photo'; $('unknown-name').textContent = r.name || ''; $('unknown-text').textContent = r.message; $('unknown-upc').textContent = ''; return show('unknown'); }
      if (r.status === 'busy') { $('offline-reason').textContent = r.message; return show('offline'); }
      if (r.status === 'bad') { $('unknown-text').textContent = r.message; return show('unknown'); }
      $('offline-reason').textContent = r.message; show('offline');
    });
  }
  $('label-photo').addEventListener('change', onLabelPhoto);
  $('label-photo-start').addEventListener('change', onLabelPhoto);
  $('barcode-photo').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    show('busy');
    scan.decodeImage(f).then(function (upc) {
      if (upc) { $('upc').value = upc; return check(upc); }
      showStart(); typeError("We couldn't find a barcode in that photo. Try again closer, or type the number.");
    });
  });

  var lastUpc = '';
  function check(upc) {
    lastUpc = upc;
    show('busy');
    api.lookup(upc).then(function (r) {
      if (r.status === 'known') return renderAnswer(r.item);
      if (r.status === 'unknown') { $('unknown-verdict').textContent = r.verdict || 'Take a photo of it'; $('unknown-name').textContent = r.name || ''; $('unknown-text').textContent = r.message || api.UNKNOWN_TEXT; $('unknown-upc').textContent = 'Number ' + upc; return show('unknown'); }
      if (r.status === 'bad') { showStart(); return typeError(r.message); }
      if (r.status === 'busy') { $('offline-reason').textContent = r.message; return show('offline'); }
      $('offline-reason').textContent = r.message || 'Your phone looks offline. Try again when you have a signal, or ask at the counter.';
      show('offline');
    });
  }

  function typeError(msg) {
    var e = $('type-error');
    e.textContent = msg || '';
    e.hidden = !msg;
  }

  var cameraNote = $('camera-note');
  function note(text) { cameraNote.textContent = text; cameraNote.hidden = !text; }

  function startCamera() {
    if (/[?&]camera=off(&|$)/.test(location.search)) { note('Camera is off. Type the number below.'); return; }
    note('');
    scan.start($('video'), function (upc) { $('upc').value = upc; check(upc); })
      .then(function () { note(''); })
      .catch(function (e) {
        var why = e && e.reason;
        if (why === 'refused') note("Camera is off, and that's fine. Type the number below.");
        else if (why === 'unsupported') note("This browser can't use the camera here. Type the number below.");
        else note("We can't reach the camera. Type the number below.");
        $('upc').focus({ preventScroll: true });
      });
  }

  function showStart() {
    typeError('');
    show('start');
    startCamera();
  }

  $('type-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var upc = scan.normalise($('upc').value);
    if (!upc) return typeError("That doesn't look like a barcode number. It's 8, 12 or 13 digits.");
    check(upc);
  });
  $('upc').addEventListener('input', function () { typeError(''); });

  Array.prototype.forEach.call(document.querySelectorAll('.again'), function (b) {
    if (b.id === 'retry') return;
    b.addEventListener('click', function () { $('upc').value = ''; showStart(); });
  });
  $('retry').addEventListener('click', function () { if (lastUpc) check(lastUpc); else showStart(); });

  window.addEventListener('offline', function () {
    if (document.body.dataset.screen === 'busy') { $('offline-reason').textContent = 'Your phone looks offline. Try again when you have a signal, or ask at the counter.'; show('offline'); }
  });

  showStart();
})();
