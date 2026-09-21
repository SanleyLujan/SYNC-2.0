jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { currentState: 'active', addEventListener: jest.fn() },
}));
import { AppState, Platform } from 'react-native';
import { isAppForeground, onAppForegroundChange } from './app-foreground';

it('follows the native foreground state and removes its listener', () => {
  (Platform as any).OS = 'android';
  (AppState as any).currentState = 'active';
  let changed!: () => void;
  const remove = jest.fn();
  (AppState.addEventListener as jest.Mock).mockImplementation((_, callback) => {
    changed = callback; return { remove };
  });
  expect(isAppForeground()).toBe(true);
  const listener = jest.fn();
  const unsubscribe = onAppForegroundChange(listener);
  (AppState as any).currentState = 'background'; changed();
  expect(listener).toHaveBeenLastCalledWith(false);
  (AppState as any).currentState = 'inactive'; changed();
  expect(listener).toHaveBeenLastCalledWith(false);
  (AppState as any).currentState = 'active'; changed();
  expect(listener).toHaveBeenLastCalledWith(true);
  unsubscribe(); expect(remove).toHaveBeenCalledTimes(1);
});

it('treats a hidden browser tab and page exit as inactive, then resumes on return', () => {
  (Platform as any).OS = 'web';
  const documentEvents = new Map<string, () => void>();
  const windowEvents = new Map<string, () => void>();
  const page: any = { visibilityState: 'visible',
    addEventListener: (name: string, fn: () => void) => documentEvents.set(name, fn),
    removeEventListener: (name: string) => documentEvents.delete(name),
  };
  (globalThis as any).document = page;
  (globalThis as any).window = {
    addEventListener: (name: string, fn: () => void) => windowEvents.set(name, fn),
    removeEventListener: (name: string) => windowEvents.delete(name),
  };
  try {
    const listener = jest.fn();
    const unsubscribe = onAppForegroundChange(listener);
    expect(isAppForeground()).toBe(true);
    page.visibilityState = 'hidden'; documentEvents.get('visibilitychange')!();
    expect(listener).toHaveBeenLastCalledWith(false);
    page.visibilityState = 'visible'; documentEvents.get('visibilitychange')!();
    expect(listener).toHaveBeenLastCalledWith(true);
    windowEvents.get('pagehide')!(); expect(listener).toHaveBeenLastCalledWith(false);
    windowEvents.get('pageshow')!(); expect(listener).toHaveBeenLastCalledWith(true);
    unsubscribe();
    expect(documentEvents.size).toBe(0); expect(windowEvents.size).toBe(0);
  } finally {
    delete (globalThis as any).document; delete (globalThis as any).window;
    (Platform as any).OS = 'android';
  }
});
