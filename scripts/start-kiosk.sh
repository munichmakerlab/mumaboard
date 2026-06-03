#!/usr/bin/env bash
# Launch MumaBoard fullscreen kiosk on Raspberry Pi OS (64-bit).
set -euo pipefail

# Resolve project root regardless of where this is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# X11 fallback (not used on Pi OS labwc, but harmless): 5-minute DPMS sleep.
if command -v xset >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
  xset s 300 300 || true
  xset +dpms || true
  xset dpms 300 300 300 || true
fi

# Hide the desktop panel for a borderless kiosk. On Raspberry Pi OS the panel
# (wf-panel-pi) is kept alive by an lwrespawn wrapper, so kill the wrapper first
# (otherwise it restarts the panel within ~1s), then the panel itself. Done before
# launching Electron so the window maximizes over the full screen.
pkill -f "lwrespawn /usr/bin/wf-panel-pi" 2>/dev/null || true
pkill -x wf-panel-pi 2>/dev/null || true

# Ensure the system on-screen keyboard (squeekboard) is running. It is shown
# on text-field focus via its DBus interface (sm.puri.OSK0) by the membership form.
if command -v squeekboard >/dev/null 2>&1 && ! pgrep -x squeekboard >/dev/null 2>&1; then
  squeekboard >/dev/null 2>&1 &
fi

# Pick the Ozone backend: Wayland if a Wayland session is present, else X11.
# This env hint is read by Electron early enough to take effect (a command-line
# --ozone-platform flag or app.commandLine switch is applied too late on the Pi).
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  export ELECTRON_OZONE_PLATFORM_HINT=wayland
else
  export ELECTRON_OZONE_PLATFORM_HINT=x11
fi

# --no-sandbox is also set in electron-main.js; harmless to repeat.
exec npx electron . --no-sandbox
