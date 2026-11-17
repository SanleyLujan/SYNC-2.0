import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';

it.each([
  'https://example.invalid/api/users/me',
  'https://example.invalid/api/activities/live/fictitious-token',
  'https://example.invalid/storage/v1/object/sign/private/selfie.jpg?token=fictitious',
  'https://example.invalid/google-signin.html',
  'https://example.invalid/google-signin.js',
  'https://example.invalid/google-signin.css',
])('service worker não guarda/reutiliza dados sensíveis: %s', url => {
  const listeners: Record<string, Function> = {};
  runInNewContext(readFileSync(resolve(__dirname,'../../public/service-worker.js'),'utf8'), {
    URL, self: { location: { origin: 'https://example.invalid' }, addEventListener: (event: string, fn: Function) => { listeners[event] = fn; } },
  });
  const respondWith = jest.fn();
  listeners.fetch({ request: { method:'GET',url,headers: {has:()=>false} }, respondWith });
  expect(respondWith).not.toHaveBeenCalled();
});
