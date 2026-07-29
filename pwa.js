(() => {
  const installButton = document.querySelector("#installApp");
  const scriptSource = document.currentScript?.src;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  let installPrompt = null;

  if (installButton && standalone) installButton.hidden = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installButton && !standalone) installButton.hidden = false;
  });

  installButton?.addEventListener("click", async () => {
    if (!installPrompt) return;
    installButton.disabled = true;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } finally {
      installPrompt = null;
      installButton.hidden = true;
      installButton.disabled = false;
    }
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    if (installButton) installButton.hidden = true;
  });

  if (!scriptSource || !("serviceWorker" in navigator) || location.protocol === "file:") return;

  const appRoot = new URL(".", scriptSource);
  const serviceWorkerUrl = new URL("sw.js", appRoot);
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(serviceWorkerUrl.href, { scope: appRoot.pathname }).catch(() => {});
  });
})();
