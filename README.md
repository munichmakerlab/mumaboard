# MumaBoard (Electron Monitor-Wall Dashboard)

Touch-first desktop dashboard for a Linux monitor wall, built with Electron.
Target hardware: **Raspberry Pi 4, Raspberry Pi OS 64-bit**.

## Features

- Top tab menu that stays visible at all times
- Fullscreen, frameless kiosk layout
- Multiple embedded screens (configured in one file)
- Starter tabs for:
  - MumaDisplay (Home Assistant dashboard)
  - Membership signup form (fill + finger signature + PDF export)
  - Tram departures

## Configure screens

Edit `app/screens.config.js` and replace each `url` with your real endpoint.

## Membership form workflow

- Membership tab uses `app/membership-form.html`
- PDF template file: `app/2026_Mitgliedsantrag_-_Bi-Lingual_-_Digital.pdf`
- SMB output paths are configured in `app/membership.config.js`
- Optional override at runtime: `MUMABOARD_NEW_MEMBERS_PATH=/your/mount/path`
- Saving to SMB uses `gio` — install with `sudo apt install gvfs-backends` on the Pi.

### On-screen keyboard

The form uses the **system touch keyboard** (`squeekboard`), not a built-in one.
When a text field is focused the form shows squeekboard via its DBus interface
(`sm.puri.OSK0`); squeekboard types into the focused field through the Wayland
virtual-keyboard protocol. Install it if missing: `sudo apt install squeekboard`.
The kiosk script starts squeekboard automatically if it isn't already running.

> The app window is **maximized**, not true-fullscreen, on purpose: under labwc a
> fullscreen surface stacks above the keyboard overlay and would hide it. To still
> get a borderless look, `scripts/start-kiosk.sh` kills the desktop panel
> (`wf-panel-pi` and its `lwrespawn` wrapper) before launching, so the maximized
> window fills the whole screen.

## Run on the Raspberry Pi

1. Install Node.js 20 LTS (e.g. via NodeSource or `sudo apt install nodejs npm`).
2. Copy this project to the Pi (e.g. `/home/pi/mumaboard`).
3. Install dependencies — this pulls the correct `linux-arm64` Electron build:

```bash
cd ~/mumaboard
npm install
```

4. Start the dashboard:

```bash
npm run kiosk        # scripts/start-kiosk.sh — use this on the Pi
```

> On Raspberry Pi OS use **`npm run kiosk`**, not bare `npm start`. The kiosk
> script sets `ELECTRON_OZONE_PLATFORM_HINT` so Electron selects the Wayland
> backend; without it Electron tries X11 and crashes with
> `Missing X server or $DISPLAY`. (`npm start` / `electron .` is for desktop
> X11 / macOS development only.)

## Auto-start on boot (kiosk)

1. Enable desktop autologin: `sudo raspi-config` → **System Options** → **Boot / Auto Login** → **Desktop Autologin**.
2. Install the autostart entry (edit the `Exec=` path inside it first if you cloned elsewhere than `/home/pi/mumaboard`):

```bash
mkdir -p ~/.config/autostart
cp scripts/mumaboard.desktop ~/.config/autostart/
```

3. Reboot. The dashboard launches fullscreen on the desktop session.

`~/.config/autostart` is honored by both X11 and the Wayland compositors (labwc / wayfire)
shipped with Raspberry Pi OS Bookworm. For Wayland, set idle/blanking timeouts to off in the
compositor config; on X11 the kiosk script disables blanking via `xset`.

### Display sleep

`scripts/start-kiosk.sh` runs `swayidle` so the display powers off (via `wlopm`)
after **5 minutes** idle and wakes on the next touch. Change `DISPLAY_IDLE_SECS`
in the script to adjust.

## Notes

- The MumaDisplay (Home Assistant) tab is embedded in an iframe. If it renders blank, HA is
  blocking embedding — set `http.use_x_frame_options: false` in HA `configuration.yaml`.
- Quitting kiosk mode: `Alt+F4`, or SSH in and `pkill -f electron`.

## Project paths

- App source: `app/`
- Electron main process: `electron-main.js`
- Renderer NW-compat shim: `app/preload.js`
- Kiosk launcher: `scripts/start-kiosk.sh`
- Autostart entry: `scripts/mumaboard.desktop`
