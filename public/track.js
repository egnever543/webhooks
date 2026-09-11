/*!
 * Webhook Monitor — pixel de visitas.
 * Uso:
 *   <script src="https://SEU-APP.vercel.app/track.js"
 *           data-client="acme" data-project="site-vendas"></script>
 * Dispara uma batida por carregamento de página. A classificação pago/grátis
 * é feita no servidor a partir da URL de entrada (gclid, utm_medium=cpc, etc.).
 */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var client = s.getAttribute('data-client');
  var project = s.getAttribute('data-project');
  if (!client || !project) return;

  var base;
  try { base = new URL(s.src).origin; } catch (e) { return; }
  var url = base + '/api/track/' + encodeURIComponent(client) + '/' + encodeURIComponent(project);
  var payload = JSON.stringify({ u: location.href, r: document.referrer });

  try {
    if (navigator.sendBeacon) {
      // Blob text/plain evita preflight CORS e não bloqueia a navegação.
      navigator.sendBeacon(url, new Blob([payload], { type: 'text/plain' }));
    } else {
      fetch(url, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'text/plain' },
        keepalive: true,
        mode: 'no-cors',
      });
    }
  } catch (e) { /* silencioso: rastreio nunca deve quebrar o site */ }
})();
