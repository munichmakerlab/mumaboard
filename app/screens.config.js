window.DASHBOARD_SCREENS = [
  {
    id: "mumadisplay",
    label: "MumaDisplay",
    url: "http://10.10.20.67:8123/dashboard-mumadisplay/0?disable_sidebar=1&kiosk=1",
    statusHint:
      "If this page does not load, check network access and whether the target allows embedding."
  },
  {
    id: "membership-form",
    label: "Membership Form",
    url: "membership-form.html",
    statusHint: "Fill, sign with finger, and save to the members SMB share."
  },
  {
    id: "tram-departures",
    label: "Tram Departures",
    url: "tram-monitor.html",
    statusHint: "Live departures widget from MVV."
  },
  {
    id: "broken-tools",
    label: "Broken Tools",
    url: "broken-tools.html",
    statusHint: "Report broken tools and mark them fixed. Saved to ~/.mumaboard/broken-tools.json."
  }
];
