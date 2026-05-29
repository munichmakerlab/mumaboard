const { app, BrowserWindow } = require("electron");
const path = require("path");

// NW.js `chromium-args` replacement.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
// Kiosk user has no chrome-sandbox suid helper; required on Raspberry Pi OS.
app.commandLine.appendSwitch("no-sandbox");
// NOTE: the Ozone backend (Wayland vs X11) is selected by Electron BEFORE this
// script runs, so it cannot be set with app.commandLine here. It is chosen via
// the ELECTRON_OZONE_PLATFORM_HINT env var, set by scripts/start-kiosk.sh.
// On Raspberry Pi OS this MUST be "wayland" ("auto" wrongly picks X11). Launch
// the app with `npm run kiosk` (or scripts/start-kiosk.sh), not bare `electron .`.

// Refuse to start a second copy (e.g. if an autostart entry fires twice).
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "MumaBoard",
    // A MAXIMIZED frameless window, NOT true fullscreen: under labwc a fullscreen
    // surface is stacked above wlr-layer-shell, which hides the on-screen keyboard
    // (squeekboard). A normal maximized toplevel sits below the OSK overlay so the
    // keyboard is visible when a field is focused.
    frame: false,
    backgroundColor: "#0b0e14",
    webPreferences: {
      preload: path.join(__dirname, "app", "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
      // Membership form is loaded inside an <iframe> (a subframe) by app.js.
      nodeIntegrationInSubFrames: true,
      sandbox: false,
      webviewTag: false
    }
  });

  mainWindow.maximize();
  mainWindow.loadFile(path.join("app", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
