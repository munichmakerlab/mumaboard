(function initDashboard() {
  const screens = Array.isArray(window.DASHBOARD_SCREENS) ? window.DASHBOARD_SCREENS : [];
  const tabsRoot = document.getElementById("tabs");
  const screensRoot = document.getElementById("screen-container");

  if (!tabsRoot || !screensRoot) {
    throw new Error("Dashboard root elements were not found.");
  }

  if (screens.length === 0) {
    screensRoot.innerHTML =
      '<div class="screen is-active"><div class="screen-status">No screens configured. Edit <code>screens.config.js</code>.</div></div>';
    return;
  }

  const byId = new Map();

  function setActive(id) {
    byId.forEach((entry, screenId) => {
      const active = screenId === id;
      entry.tab.classList.toggle("is-active", active);
      entry.tab.setAttribute("aria-selected", String(active));
      entry.tab.tabIndex = active ? 0 : -1;
      entry.panel.classList.toggle("is-active", active);
    });
  }

  screens.forEach((screen, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab-btn";
    tab.textContent = screen.label;
    tab.setAttribute("role", "tab");
    tab.id = `tab-${screen.id}`;
    tab.setAttribute("aria-controls", `panel-${screen.id}`);

    const panel = document.createElement("section");
    panel.className = "screen";
    panel.setAttribute("role", "tabpanel");
    panel.id = `panel-${screen.id}`;
    panel.setAttribute("aria-labelledby", tab.id);

    const iframe = document.createElement("iframe");
    iframe.src = screen.url;
    iframe.loading = "eager";
    iframe.title = screen.label;
    panel.appendChild(iframe);

    if (screen.statusHint) {
      const status = document.createElement("div");
      status.className = "screen-status";
      status.textContent = screen.statusHint;
      panel.appendChild(status);
    }

    tab.addEventListener("click", () => setActive(screen.id));
    tabsRoot.appendChild(tab);
    screensRoot.appendChild(panel);
    byId.set(screen.id, { tab, panel });

    if (index === 0) {
      setActive(screen.id);
    }
  });
})();
