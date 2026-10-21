export function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  return Reflect.get(navigator, 'standalone') === true;
}
