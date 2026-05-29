(function membershipFormInit() {
  const fs = window.require("fs");
  const path = window.require("path");
  const os = window.require("os");
  const childProcess = window.require("child_process");
  const PDFDocument = window.PDFLib.PDFDocument;

  const config = window.MEMBERSHIP_FORM_CONFIG || {};
  const appPath = window.nw?.App?.startPath || process.cwd();
  const templateFile = config.templateFile || "2026_Mitgliedsantrag_-_Bi-Lingual_-_Digital.pdf";
  const outputPaths = Array.isArray(config.outputPaths) ? config.outputPaths : [];

  const inputs = {
    firstName: byId("firstName"),
    lastName: byId("lastName"),
    street: byId("street"),
    postalCode: byId("postalCode"),
    city: byId("city"),
    dob: byId("dob"),
    mobile: byId("mobile"),
    email: byId("email"),
    customAmount: byId("customAmount"),
    feeReason: byId("feeReason"),
    heardAbout: byId("heardAbout"),
    placeDate: byId("placeDate"),
    sameAsAbove: byId("sameAsAbove"),
    sepaFirstName: byId("sepaFirstName"),
    sepaLastName: byId("sepaLastName"),
    sepaPostalCity: byId("sepaPostalCity"),
    sepaStreet: byId("sepaStreet"),
    iban: byId("iban"),
    bic: byId("bic"),
    bankName: byId("bankName"),
    sepaPlaceDate: byId("sepaPlaceDate"),
    sepaConsent: byId("sepaConsent")
  };
  const saveButton = byId("savePdfBtn");
  const statusNode = byId("status");
  const sigMain = createSignaturePad(byId("signatureMain"));
  const sigSepa = createSignaturePad(byId("signatureSepa"));

  document.querySelectorAll("[data-clear-sign]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.getAttribute("data-clear-sign") === "signatureMain") sigMain.clear();
      if (button.getAttribute("data-clear-sign") === "signatureSepa") sigSepa.clear();
    });
  });

  setupCopyFromAbove();
  setupSystemKeyboard();
  setupDragScroll(document.querySelector(".content"));
  applyDefaultPlaceDates();
  saveButton.addEventListener("click", saveFilledPdf);

  const resetOverlay = byId("resetOverlay");
  const resetCountdownNode = byId("resetCountdown");
  const abortResetBtn = byId("abortResetBtn");
  let resetTimer = null;
  abortResetBtn.addEventListener("click", cancelResetCountdown);

  const idleOverlay = byId("idleOverlay");
  const idleCountdownNode = byId("idleCountdown");
  const idleStayBtn = byId("idleStayBtn");
  const IDLE_TIMEOUT_MS = 30000;
  const IDLE_PROMPT_SECONDS = 10;
  let idleTimer = null;
  let idlePromptTimer = null;
  idleStayBtn.addEventListener("click", () => {
    dismissIdlePrompt();
    scheduleIdleTimeout();
  });
  ["pointerdown", "keydown", "input", "change"].forEach((evt) => {
    document.addEventListener(evt, onUserActivity, true);
  });
  scheduleIdleTimeout();

  function onUserActivity() {
    if (!idleOverlay.hidden) return;
    scheduleIdleTimeout();
  }

  function scheduleIdleTimeout() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(showIdlePrompt, IDLE_TIMEOUT_MS);
  }

  function showIdlePrompt() {
    if (!resetOverlay.hidden) return;
    let remaining = IDLE_PROMPT_SECONDS;
    idleCountdownNode.textContent = String(remaining);
    idleOverlay.hidden = false;
    idlePromptTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        dismissIdlePrompt();
        resetForm();
        scheduleIdleTimeout();
      } else {
        idleCountdownNode.textContent = String(remaining);
      }
    }, 1000);
  }

  function dismissIdlePrompt() {
    if (idlePromptTimer) {
      clearInterval(idlePromptTimer);
      idlePromptTimer = null;
    }
    idleOverlay.hidden = true;
  }

  function startResetCountdown() {
    cancelResetCountdown();
    let remaining = 5;
    resetCountdownNode.textContent = String(remaining);
    resetOverlay.hidden = false;
    resetTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        cancelResetCountdown();
        resetForm();
      } else {
        resetCountdownNode.textContent = String(remaining);
      }
    }, 1000);
  }

  function cancelResetCountdown() {
    if (resetTimer) {
      clearInterval(resetTimer);
      resetTimer = null;
    }
    resetOverlay.hidden = true;
  }

  function resetForm() {
    Object.values(inputs).forEach((el) => {
      if (!el) return;
      if (el.type === "checkbox") el.checked = false;
      else if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.value = "";
    });
    document.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = false; });
    sigMain.clear();
    sigSepa.clear();
    applyDefaultPlaceDates();
    setStatus("Ready.", false);
  }

  function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el;
  }

  function setStatus(message, isError) {
    statusNode.textContent = message;
    statusNode.style.color = isError ? "#ff7c7c" : "#9ba8bc";
  }

  function setupCopyFromAbove() {
    inputs.sameAsAbove.addEventListener("change", () => {
      if (!inputs.sameAsAbove.checked) return;
      inputs.sepaFirstName.value = inputs.firstName.value;
      inputs.sepaLastName.value = inputs.lastName.value;
      inputs.sepaPostalCity.value = `${inputs.postalCode.value} ${inputs.city.value}`.trim();
      inputs.sepaStreet.value = inputs.street.value;
    });
  }

  function applyDefaultPlaceDates() {
    const defaultValue = munichTodayText();
    if (!inputs.placeDate.value.trim()) inputs.placeDate.value = defaultValue;
    if (!inputs.sepaPlaceDate.value.trim()) inputs.sepaPlaceDate.value = defaultValue;
  }

  function munichTodayText() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear());
    return `Munich, ${day}.${month}.${year}`;
  }

  // Show/hide the system on-screen keyboard (squeekboard) when a text field gains
  // or loses focus. squeekboard injects keystrokes into the focused field via the
  // Wayland virtual-keyboard protocol, so no per-key handling is needed here.
  // It is controlled through its DBus interface (sm.puri.OSK0). On platforms
  // without squeekboard (dev machines) the busctl call simply fails and is ignored.
  function setupSystemKeyboard() {
    const textTypes = new Set([
      "text",
      "email",
      "tel",
      "number",
      "search",
      "url",
      "password",
      ""
    ]);
    let hideTimer = null;

    function isTextField(el) {
      if (!el) return false;
      if (el.tagName === "TEXTAREA") return true;
      if (el.tagName !== "INPUT") return false;
      const type = (el.getAttribute("type") || "text").toLowerCase();
      return textTypes.has(type);
    }

    function setOsk(visible) {
      try {
        childProcess.execFile(
          "busctl",
          [
            "--user",
            "call",
            "sm.puri.OSK0",
            "/sm/puri/OSK0",
            "sm.puri.OSK0",
            "SetVisible",
            "b",
            visible ? "true" : "false"
          ],
          () => {}
        );
      } catch {
        // No OSK available (e.g. macOS/dev) — ignore.
      }
    }

    document.addEventListener("focusin", (event) => {
      if (!isTextField(event.target)) return;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      setOsk(true);
      // Keep the focused field visible above the keyboard panel.
      setTimeout(() => {
        try {
          event.target.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          // ignore
        }
      }, 60);
    });

    document.addEventListener("focusout", (event) => {
      if (!isTextField(event.target)) return;
      // Defer hiding so moving focus between fields doesn't flicker the keyboard.
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!isTextField(document.activeElement)) setOsk(false);
      }, 250);
    });
  }

  // Finger drag-to-scroll for the touchscreen. Chromium's native touch scrolling
  // is unreliable on the kiosk, so we move scrollTop directly from pointer events
  // (which the touchscreen also emits). A small threshold preserves taps/focus,
  // and drags starting on the signature canvas are left alone so signing works.
  function setupDragScroll(scroller) {
    if (!scroller) return;
    const THRESHOLD = 8;
    let pointerId = null;
    let startY = 0;
    let startScroll = 0;
    let dragging = false;

    scroller.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      // Let the signature pad handle its own drags.
      if (event.target.closest("canvas")) return;
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

  function createSignaturePad(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    clear();
    let drawing = false;

    function pointFromEvent(event) {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
      return { x, y };
    }

    function start(event) {
      drawing = true;
      const p = pointFromEvent(event);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }

    function move(event) {
      if (!drawing) return;
      const p = pointFromEvent(event);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    function end() {
      drawing = false;
    }

    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointerleave", end);
    canvas.addEventListener("pointercancel", end);

    function clear() {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function hasInk() {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) return true;
      }
      return false;
    }

    function dataUrl() {
      return canvas.toDataURL("image/png");
    }

    return { clear, hasInk, dataUrl };
  }

  async function saveFilledPdf() {
    saveButton.disabled = true;
    setStatus("Creating filled PDF...", false);
    try {
      if (!inputs.sepaConsent.checked) {
        throw new Error("Please confirm the SEPA Direct Debit Mandate before saving.");
      }
      const templatePath = resolveTemplatePath();
      const templateRaw = fs.readFileSync(templatePath);
      const templateBytes = normalizeBinary(templateRaw);
      const pdfDoc = await PDFDocument.load(templateBytes);
      const form = pdfDoc.getForm();

      setTextField(form, "First Name", inputs.firstName.value);
      setTextField(form, "Last Name", inputs.lastName.value);
      setTextField(form, "Date of Birth", inputs.dob.value);
      setTextField(form, "Mobile Number", inputs.mobile.value);
      setTextField(form, "Postal Code", inputs.postalCode.value);
      setTextField(form, "City", inputs.city.value);
      setTextField(form, "Email", inputs.email.value);

      const language = selectedRadioValue("language");
      setRadio(form, "language", language === "de" ? "2" : "1");

      const fee = selectedRadioValue("fee");
      setRadio(form, "fee", fee === "10" ? "2" : fee === "custom" ? "3" : "1");
      setTextField(form, "custom amount", inputs.customAmount.value);
      setTextField(form, "fee reason", inputs.feeReason.value);
      setTextField(form, "How did you hear about us?", inputs.heardAbout.value);

      setCheck(form, "Same as Above", inputs.sameAsAbove.checked);
      setTextField(form, "First Name SEPA", inputs.sepaFirstName.value);
      setTextField(form, "Last Name SEPA", inputs.sepaLastName.value);
      setTextField(form, "Postal Code & City SEPA", inputs.sepaPostalCity.value);
      setTextField(form, "IBAN SEPA", inputs.iban.value);
      setTextField(form, "Swift BIC SEPA", inputs.bic.value);
      setTextField(form, "Name of Bank SEPA", inputs.bankName.value);
      setTextField(form, "Place and Date", inputs.placeDate.value.trim() || munichTodayText());
      setTextField(form, "Place and Date SEPA", inputs.sepaPlaceDate.value.trim() || munichTodayText());
      setTextField(form, "Street & No", inputs.street.value);
      setTextField(form, "Street & No SEPA", inputs.sepaStreet.value);

      await drawSignature(pdfDoc, form, "Signature", sigMain.hasInk() ? sigMain.dataUrl() : null);
      await drawSignature(pdfDoc, form, "Signature SEPA", sigSepa.hasInk() ? sigSepa.dataUrl() : null);

      form.updateFieldAppearances();
      const finalBytes = await pdfDoc.save();
      const outputFileName = buildOutputFileName();
      const outputPath = writeToShare(finalBytes, outputFileName);
      setStatus(`Saved: ${outputPath}`, false);
      startResetCountdown();
    } catch (error) {
      setStatus(`Save failed: ${error.message}`, true);
    } finally {
      saveButton.disabled = false;
    }
  }

  function resolveTemplatePath() {
    const candidates = [
      path.join(appPath, templateFile),
      path.join(appPath, "..", templateFile),
      path.join(process.cwd(), templateFile)
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`Template PDF not found (${templateFile}).`);
  }

  function setTextField(form, name, value) {
    const field = form.getTextField(name);
    field.setText(value || "");
  }

  async function replaceStreetWidgets() {
    // No longer needed: the PDF template now exposes "Street & No" and
    // "Street & No SEPA" as proper standalone text widgets.
  }

  function setRadio(form, name, option) {
    const group = form.getRadioGroup(name);
    group.select(option);
  }

  function setCheck(form, name, checked) {
    const box = form.getCheckBox(name);
    if (checked) box.check();
    else box.uncheck();
  }

  function selectedRadioValue(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : "";
  }

  function removeWidgetAnnotations(page, widgets) {
    const annots = page.node.Annots?.();
    if (!annots) return;
    const indexesToRemove = [];
    for (let i = 0; i < annots.size(); i += 1) {
      const annotation = annots.lookup(i);
      if (widgets.some((widget) => widget.dict === annotation)) {
        indexesToRemove.push(i);
      }
    }
    indexesToRemove
      .sort((a, b) => b - a)
      .forEach((index) => annots.remove(index));
  }

  async function drawSignature(pdfDoc, form, fieldName, dataUrl) {
    if (!dataUrl) return;
    const field = form.getFields().find((f) => f.getName() === fieldName);
    const widget = field?.acroField?.getWidgets?.()[0];
    if (!widget) return;
    const rect = widget.getRectangle();
    const imageBytes = dataUrlToUint8Array(dataUrl);
    const image = await pdfDoc.embedPng(imageBytes);
    const page = pdfDoc.getPages()[0];
    page.drawImage(image, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    });
  }

  function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function normalizeBinary(value) {
    if (value instanceof Uint8Array) return value;
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (
      value &&
      value.buffer instanceof ArrayBuffer &&
      Number.isFinite(value.byteOffset) &&
      Number.isFinite(value.byteLength)
    ) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    throw new Error(`Unsupported PDF binary type: ${Object.prototype.toString.call(value)}`);
  }

  function buildOutputFileName() {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const base = `${safePart(inputs.firstName.value)}_${safePart(inputs.lastName.value)}_${y}${m}${d}`.replace(
      /^_+|_+$/g,
      ""
    );
    return `${base || "new_member"}_membership.pdf`;
  }

  function safePart(text) {
    return (text || "")
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_");
  }

  function writeToShare(bytes, fileName) {
    const tried = [];
    const envPath = process.env.MUMABOARD_NEW_MEMBERS_PATH;
    const configured = envPath ? [envPath, ...outputPaths] : [...outputPaths];
    const smbWrite = tryWriteViaGioSmb(bytes, fileName, configured);
    if (smbWrite.ok) return smbWrite.path;
    if (smbWrite.error) tried.push(smbWrite.error);
    const candidates = expandOutputCandidates(configured);
    if (!candidates.length) throw new Error("No output path configured.");

    for (const targetDir of candidates) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
        const fullPath = path.join(targetDir, fileName);
        fs.writeFileSync(fullPath, Buffer.from(normalizeBinary(bytes)));
        return fullPath;
      } catch (error) {
        tried.push(`${targetDir} -> ${error.message}`);
      }
    }
    throw new Error(`Could not write to SMB share. ${tried.join(" | ")}`);
  }

  function expandOutputCandidates(configuredPaths) {
    const expanded = [];
    const seen = new Set();
    for (const rawPath of configuredPaths) {
      if (!rawPath) continue;
      const smb = parseUncPath(rawPath);
      if (!smb) {
        addPath(rawPath);
        continue;
      }
      const subPath = smb.subPath ? smb.subPath.split("/") : [];
      if (process.platform === "linux") {
        const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
        const gvfsRoot = `/run/user/${uid}/gvfs/smb-share:server=${smb.host},share=${smb.share}`;
        addPath(path.join(gvfsRoot, ...subPath));
        addPath(path.join("/mnt", smb.host, smb.share, ...subPath));
      } else if (process.platform === "darwin") {
        addPath(path.join("/Volumes", smb.share, ...subPath));
      }
    }
    return expanded;

    function addPath(value) {
      const normalized = String(value).replace(/\/+$/, "");
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      expanded.push(normalized);
    }
  }

  function parseUncPath(rawPath) {
    const normalized = String(rawPath).replace(/\\/g, "/");
    if (!normalized.startsWith("//")) return null;
    const parts = normalized.slice(2).split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return {
      host: parts[0],
      share: parts[1],
      subPath: parts.slice(2).join("/")
    };
  }

  function tryWriteViaGioSmb(bytes, fileName, configuredPaths) {
    const smbTarget = configuredPaths.map(parseUncPath).find(Boolean);
    if (!smbTarget) return { ok: false };
    try {
      childProcess.execFileSync("gio", ["--version"], { stdio: "ignore" });
    } catch {
      return { ok: false };
    }

    const tmpFile = path.join(os.tmpdir(), `mumaboard-${Date.now()}-${fileName}`);
    const remoteDir = smbToUri(smbTarget);
    const remoteFile = `${remoteDir}/${encodeURIComponent(fileName)}`;
    try {
      fs.writeFileSync(tmpFile, Buffer.from(normalizeBinary(bytes)));
      childProcess.execFileSync("gio", ["mkdir", "-p", remoteDir], { stdio: "ignore" });
      childProcess.execFileSync("gio", ["copy", "-f", tmpFile, remoteFile], { stdio: "ignore" });
      return { ok: true, path: remoteFile };
    } catch (error) {
      return { ok: false, error: `gio smb://${smbTarget.host}/${smbTarget.share} -> ${error.message}` };
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // no-op
      }
    }
  }

  function smbToUri(smb) {
    const sub = smb.subPath
      ? smb.subPath
          .split("/")
          .filter(Boolean)
          .map((segment) => encodeURIComponent(segment))
          .join("/")
      : "";
    const suffix = sub ? `/${sub}` : "";
    return `smb://${smb.host}/${encodeURIComponent(smb.share)}${suffix}`;
  }

  function tryMountSmbShare(smb) {
    try {
      if (process.platform === "linux") {
        childProcess.execFileSync("gio", ["mount", `smb://${smb.host}/${smb.share}`], { stdio: "ignore" });
      } else if (process.platform === "darwin") {
        childProcess.execFileSync("open", [`smb://${smb.host}/${smb.share}`], { stdio: "ignore" });
      }
    } catch (error) {
      // Mount may already exist or require manual credentials; write attempts below still run.
    }
  }
})();
