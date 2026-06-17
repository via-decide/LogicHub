(function() {
  const host = window.location.hostname;
  let endpoint = '/api/analytics/event';
  
  // If on a different port/site, send to the central daxini.xyz API gateway
  if (window.location.port !== '3000' && host !== 'daxini.xyz') {
    endpoint = (host === 'localhost' || host === '127.0.0.1')
      ? 'http://localhost:3000/api/analytics/event'
      : 'https://daxini.xyz/api/analytics/event';
  }
  
  function logEvent(customPath, referrer = document.referrer) {
    let bandwidth = 1200; // default fallback
    try {
      const perf = window.performance;
      if (perf && typeof perf.getEntriesByType === 'function') {
        const nav = perf.getEntriesByType('navigation')[0];
        if (nav && nav.transferSize) {
          bandwidth = nav.transferSize;
        }
      }
    } catch (e) {}

    const payload = JSON.stringify({
      site: host,
      path: customPath,
      referrer: referrer,
      bandwidth: bandwidth
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'text/plain' }));
      } else {
        fetch(endpoint, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'text/plain' },
          keepalive: true
        }).catch(() => {});
      }
    } catch (err) {}
  }

  // 1. Log the page view entry
  logEvent(window.location.pathname);

  // 2. Track outbound click conversions
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && link.href) {
      try {
        const url = new URL(link.href);
        // Log outbound clicks only (different hostname)
        if (url.hostname !== window.location.hostname) {
          logEvent('outbound:' + link.href, window.location.pathname);
        }
      } catch (err) {}
    }
  });

  // 3. Track newsletter subscriptions
  window.addEventListener('newsletter:subscribed', () => {
    logEvent('event:newsletter_signup', window.location.pathname);
  });
})();
