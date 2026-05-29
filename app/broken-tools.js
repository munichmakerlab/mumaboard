(function brokenToolsInit() {
  const fs = window.require("fs");
  const path = window.require("path");
  const os = window.require("os");
  const childProcess = window.require("child_process");

  // Persist to a plain text (JSON) file under the user's home so the list
  // survives reboots. Home is on the persistent SD card, unlike /tmp.
  const dataDir = path.join(os.homedir(), ".mumaboard");
  const dataFile = path.join(dataDir, "broken-tools.json");

  const nameInput = document.getElementById("toolName");
  const noteInput = document.getElementById("toolNote");
  const addBtn = document.getElementById("addBtn");
  const listNode = document.getElementById("toolList");
  const statusNode = document.getElementById("status");

  let tools = load();
  render();

  addBtn.addEventListener("click", addTool);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTool();
  });
  noteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTool();
  });

  setupSystemKeyboard();
  setupDragScroll(document.querySelector(".content"));

  function load() {
    try {
      const raw = fs.readFileSync(dataFile, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Missing or unreadable file -> start empty.
      return [];
    }
  }

  function save() {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(dataFile, JSON.stringify(tools, null, 2));
    } catch (error) {
      setStatus("Could not save: " + error.message, true);
    }
  }

  function addTool() {
    const name = nameInput.value.trim();
    const note = noteInput.value.trim();
    if (!name) {
      setStatus("Enter a tool name first.", true);
      nameInput.focus();
      return;
    }
    tools.unshift({ name, note, reportedAt: new Date().toISOString() });
    save();
    nameInput.value = "";
    noteInput.value = "";
    render();
    setStatus('Added "' + name + '".', false);
    nameInput.focus();
  }

  function fixTool(index) {
    const removed = tools.splice(index, 1)[0];
    save();
    render();
    if (removed) setStatus('Marked "' + removed.name + '" as fixed.', false);
  }

  function render() {
    listNode.textContent = "";
    if (!tools.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No broken tools — everything works. 🎉";
      listNode.appendChild(empty);
      return;
    }
    tools.forEach((tool, index) => {
      const row = document.createElement("div");
      row.className = "tool";

      const info = document.createElement("div");
      info.className = "info";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = tool.name;
      info.appendChild(name);

      if (tool.note) {
        const note = document.createElement("div");
        note.className = "note";
        note.textContent = tool.note;
        info.appendChild(note);
      }

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = "Reported " + formatDate(tool.reportedAt);
      info.appendChild(meta);

      const fixBtn = document.createElement("button");
      fixBtn.type = "button";
      fixBtn.className = "fix";
      fixBtn.textContent = "Mark fixed";
      fixBtn.addEventListener("click", () => fixTool(index));

      row.appendChild(info);
      row.appendChild(fixBtn);
      listNode.appendChild(row);
    });
  }

  function formatDate(iso) {
    if (!iso) return "unknown";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "unknown";
    return d.toLocaleString();
  }

  function setStatus(message, isError) {
    statusNode.textContent = message;
    statusNode.style.color = isError ? "#ff7c7c" : "#9ba8bc";
  }

  // Show the system on-screen keyboard (squeekboard) on text-field focus.
  // Mirrors the membership form; harmless where squeekboard is absent.
  function setupSystemKeyboard() {
    let hideTimer = null;
    const isText = (el) => el && el.tagName === "INPUT" && (el.type === "text" || el.type === "");

    function setOsk(visible) {
      try {
        childProcess.execFile(
          "busctl",
          ["--user", "call", "sm.puri.OSK0", "/sm/puri/OSK0", "sm.puri.OSK0", "SetVisible", "b", visible ? "true" : "false"],
          () => {}
        );
      } catch {
        // no OSK available
      }
    }

    document.addEventListener("focusin", (event) => {
      if (!isText(event.target)) return;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      setOsk(true);
    });

    document.addEventListener("focusout", (event) => {
      if (!isText(event.target)) return;
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!isText(document.activeElement)) setOsk(false);
      }, 250);
    });
  }

  // Finger drag-to-scroll for the touchscreen (Chromium native touch scrolling
  // is unreliable on the kiosk). Mirrors the membership form.
  function setupDragScroll(scroller) {
    if (!scroller) return;
    const THRESHOLD = 8;
    let pointerId = null;
    let startY = 0;
    let startScroll = 0;
    let dragging = false;

    scroller.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      pointerId = event.pointerId;
      startY = event.clientY;
      startScroll = scroller.scrollTop;
      dragging = false;
    });

    scroller.addEventListener("pointermove", (event) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const dy = event.clientY - startY;
      if (!dragging && Math.abs(dy) > THRESHOLD) {
        dragging = true;
        try {
          scroller.setPointerCapture(pointerId);
        } catch {
          // ignore
        }
      }
      if (dragging) {
        scroller.scrollTop = startScroll - dy;
        event.preventDefault();
      }
    });

    function release(event) {
      if (pointerId === null || (event && event.pointerId !== pointerId)) return;
      try {
        scroller.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
      pointerId = null;
      dragging = false;
    }

    scroller.addEventListener("pointerup", release);
    scroller.addEventListener("pointercancel", release);
  }
})();
