// Pannellum is loaded as a global from the CDN <Script> in app/layout.jsx.
// Components mount before the script finishes — this resolves once the global
// is available so the caller can build a viewer.
export function waitForPannellum() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.pannellum) return resolve(window.pannellum);
    const id = setInterval(() => {
      if (typeof window !== 'undefined' && window.pannellum) {
        clearInterval(id);
        resolve(window.pannellum);
      }
    }, 30);
  });
}
