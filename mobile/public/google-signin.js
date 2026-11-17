// CSS compatibility exception is confined to this document. JavaScript remains
// external-only. Credentials are sent solely to our same-origin parent window.
(() => {
  let initialized = false;
  const notify = data => parent.postMessage(data, location.origin);
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || initialized) return;
    const data = event.data;
    if (data?.type !== 'sync-google-init' || typeof data.clientId !== 'string' ||
        !/^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(data.clientId)) return;
    initialized = true;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onerror = () => notify({ type: 'sync-google-error' });
    script.onload = () => {
      const api = window.google?.accounts?.id;
      if (!api) { notify({ type: 'sync-google-error' }); return; }
      api.initialize({ client_id: data.clientId, auto_select: false, callback: response => {
        if (typeof response.credential === 'string') notify({ type: 'sync-google-credential', credential: response.credential });
      } });
      api.renderButton(document.getElementById('button'), {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', locale: 'pt-BR',
        width: Math.min(400, Math.max(200, Number(data.width) || 280)),
      });
      notify({ type: 'sync-google-ready' });
    };
    document.head.appendChild(script);
  });
})();
