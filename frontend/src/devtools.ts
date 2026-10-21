export function registerDevTools(): void {
  if (!import.meta.env.DEV) {
    return;
  }
  if (new URLSearchParams(window.location.search).has('no-devtools')) {
    return;
  }
  void import('react-scan')
    .then(({ scan }) => {
      scan({ enabled: true, showToolbar: false });
    })
    .catch(() => undefined);
  void import('react-grab')
    .then(({ init }) => {
      init();
    })
    .catch(() => undefined);
  void import('react-grab/styles.css').catch(() => undefined);
}
