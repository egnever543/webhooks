/**
 * Classifica o tráfego de uma visita como "pago" ou "grátis" (orgânico),
 * a partir da URL de entrada (query string) e, como reforço, do referrer.
 *
 * Sinais de PAGO:
 *  - IDs de clique de anúncio: gclid, gbraid, wbraid (Google Ads),
 *    msclkid (Microsoft/Bing), ttclid (TikTok), twclid (X/Twitter).
 *  - utm_medium indicando mídia paga: cpc, ppc, paid, paidsearch,
 *    paid-social, display, cpm, banner.
 *
 * Qualquer outra coisa (orgânico, direto, redes sociais sem marcação,
 * e-mail, etc.) é tratada como "grátis".
 */
const PAID_CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid'];
const PAID_MEDIUMS = new Set([
  'cpc', 'ppc', 'paid', 'paidsearch', 'paid-search', 'paid-social',
  'paidsocial', 'display', 'cpm', 'banner',
]);

export function classifyTraffic(url: string): 'paid' | 'free' {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    // Pode vir só a query string ("?a=b" ou "a=b").
    params = new URLSearchParams(url.replace(/^\?/, ''));
  }

  for (const id of PAID_CLICK_IDS) {
    if (params.has(id)) return 'paid';
  }
  const medium = (params.get('utm_medium') || '').toLowerCase().trim();
  if (PAID_MEDIUMS.has(medium)) return 'paid';

  return 'free';
}
