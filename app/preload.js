// Electron shim for the one NW.js API the app uses: window.nw.App.startPath.
// __dirname here is the app/ directory (where the template PDF and *.config.js live).
// Runs in every frame because nodeIntegrationInSubFrames is enabled, so the
// membership-form iframe gets it too. require/process are already available in the
// renderer via nodeIntegration + contextIsolation:false.
window.nw = { App: { startPath: __dirname } };
