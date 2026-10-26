import { watchWebTrackingLocation } from './web-tracking-location.service';

it('entrega fixes enquanto oculto, reinicia na volta e ignora callbacks de assinaturas antigas', () => {
  const watches: PositionCallback[] = [];
  const current: PositionCallback[] = [];
  const errors: PositionErrorCallback[] = [];
  const geolocation = {
    getCurrentPosition: jest.fn(success => current.push(success)),
    watchPosition: jest.fn((success, error) => { watches.push(success); errors.push(error); return watches.length; }),
    clearWatch: jest.fn(),
  } as unknown as Geolocation;
  const onPosition = jest.fn(), onError = jest.fn();
  const subscription = watchWebTrackingLocation(onPosition, onError, geolocation);
  const point = { timestamp: 1_000 } as GeolocationPosition;
  watches[0](point); // Nenhuma condição de visibilidade descarta o fix.
  expect(onPosition).toHaveBeenCalledWith(point);
  subscription.refresh();
  expect(geolocation.clearWatch).toHaveBeenCalledWith(1);
  current[0](point); watches[0](point);
  expect(onPosition).toHaveBeenCalledTimes(1);
  watches[1](point);
  expect(onPosition).toHaveBeenCalledTimes(2);
  subscription.remove();
  current[1](point); watches[1](point); errors[1]({ code: 1 } as GeolocationPositionError);
  subscription.refresh();
  expect(onPosition).toHaveBeenCalledTimes(2);
  expect(onError).not.toHaveBeenCalled();
  expect(geolocation.watchPosition).toHaveBeenCalledTimes(2);
  expect(geolocation.clearWatch).toHaveBeenLastCalledWith(2);
});
