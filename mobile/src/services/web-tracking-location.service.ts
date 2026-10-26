// Mantém a assinatura enquanto a página está oculta: aproveita qualquer fix
// entregue pelo navegador. A suspensão do sistema continua fora do nosso controle.
export function watchWebTrackingLocation(
  onPosition: PositionCallback,
  onError: PositionErrorCallback,
  geolocation: Geolocation = navigator.geolocation,
) {
  let generation = 0;
  let watchId: number | null = null;
  let removed = false;

  function refresh() {
    if (removed) return;
    const current = ++generation;
    if (watchId !== null) geolocation.clearWatch(watchId);
    const position: PositionCallback = value => {
      if (!removed && current === generation) onPosition(value);
    };
    const error: PositionErrorCallback = value => {
      if (!removed && current === generation) onError(value);
    };
    geolocation.getCurrentPosition(position, error, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
    watchId = geolocation.watchPosition(position, error, { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 });
  }

  refresh();
  return {
    refresh,
    remove() {
      removed = true;
      generation++;
      if (watchId !== null) geolocation.clearWatch(watchId);
      watchId = null;
    },
  };
}
