(() => {
  /* =============================================================================
   * Orlando Eagles chat widget (single bundle)
   * Sections: brand → rate limit → DOM → styles → config → API → demo → UI boot
   * ============================================================================= */

  // Capture the executing <script> node once — `document.currentScript` is null after this tick
  // (e.g. when boot() runs on DOMContentLoaded), so we must not read data-* from currentScript later.
  const WIDGET_SCRIPT_EL = typeof document !== "undefined" ? document.currentScript : null;
  const WIDGET_SCRIPT_SRC = (WIDGET_SCRIPT_EL && WIDGET_SCRIPT_EL.src) || "";

  /** Orlando Eagles brand (matches official crest) */
  const BRAND = {
    navy: "#00213D",
    cyan: "#63C9D6",
    white: "#FFFFFF",
    muted: "#e8f4f6",
  };

  const DEFAULTS = {
    title: "Eagles Assistant",
    position: "right",
    demo: "auto", // "auto" | "on" | "off"
    primary: "auto", // CSS color or "auto" → brand navy
    accent: "auto", // CSS color or "auto" → brand cyan (user bubbles, FAB, Send)
    text: "auto",
    surface: "auto",
    muted: "auto",
    logo: "auto", // "auto" | full URL | "none"
    freeUses: "5",
    contactEmail: "info@orlandoeaglessoccer.com",
  };

  // --- Rate limit (browser storage; server is authoritative when API is used) ---
  const LS_CLIENT = "eagles_wg_client_id";
  const LS_USED = "eagles_wg_used";

  function getOrCreateClientId() {
    try {
      let id = localStorage.getItem(LS_CLIENT);
      if (!id || String(id).length < 8) {
        id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "e-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        localStorage.setItem(LS_CLIENT, id);
      }
      return id;
    } catch {
      return "eagles-anon-" + String(Math.random()).slice(2);
    }
  }

  function getLocalUsed() {
    try {
      const n = parseInt(localStorage.getItem(LS_USED) || "0", 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  function setLocalUsed(n) {
    try {
      localStorage.setItem(LS_USED, String(Math.max(0, n)));
    } catch {
      /* ignore */
    }
  }

  function limitMessage(contactEmail) {
    return (
      "Eagles Assistant: You've reached the limit for this bot. " + "Please contact " + contactEmail + " for more uses."
    );
  }

  // --- DOM helpers ---
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else n.setAttribute(k, v);
    }
    for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  // --- Injected panel CSS ---
  function ensureStyles() {
    if (document.getElementById("eagles-widget-styles")) return;
    const css = `
      :root{
        --eaglesw-primary:${BRAND.navy};
        --eaglesw-primaryText:${BRAND.white};
        --eaglesw-accent:${BRAND.cyan};
        --eaglesw-accentText:${BRAND.navy};
        --eaglesw-surface:${BRAND.white};
        --eaglesw-surfaceText:${BRAND.navy};
        --eaglesw-muted:${BRAND.muted};
        --eaglesw-border:rgba(0,33,61,.18);
        --eaglesw-shadow:rgba(0,33,61,.18);
      }
      .eaglesw-btn{position:fixed;bottom:22px;z-index:999999;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;}
      .eaglesw-btn.right{right:22px}.eaglesw-btn.left{left:22px}
      .eaglesw-fab{border:2px solid var(--eaglesw-accent);border-radius:999px;padding:12px 14px;background:var(--eaglesw-accent);color:var(--eaglesw-accentText);cursor:pointer;box-shadow:0 10px 25px var(--eaglesw-shadow);font-weight:600}
      .eaglesw-panel{position:fixed;bottom:80px;z-index:999999;width:min(380px,calc(100vw - 24px));max-height:min(520px,calc(100vh - 140px));height:min(520px,calc(100vh - 140px));background:var(--eaglesw-surface);border:2px solid var(--eaglesw-accent);border-radius:14px;box-shadow:0 20px 55px var(--eaglesw-shadow);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;display:none;flex-direction:column;box-sizing:border-box}
      .eaglesw-panel.right{right:22px}.eaglesw-panel.left{left:22px}
      .eaglesw-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 14px 14px 14px;background:var(--eaglesw-primary);color:var(--eaglesw-primaryText);flex-shrink:0;min-height:52px;box-sizing:border-box}
      .eaglesw-headerBrand{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
      .eaglesw-logo{width:40px;height:40px;object-fit:contain;flex-shrink:0;border-radius:50%;background:${BRAND.white};padding:3px;box-sizing:border-box;display:block}
      .eaglesw-title{font-weight:700;font-size:15px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;align-self:center}
      .eaglesw-close{background:transparent;border:0;color:var(--eaglesw-primaryText);font-size:20px;line-height:1;cursor:pointer;padding:6px 8px;flex-shrink:0;align-self:flex-start}
      .eaglesw-body{padding:14px;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;background:var(--eaglesw-muted)}
      .eaglesw-msg{margin:10px 0;max-width:92%}
      .eaglesw-msg.user{margin-left:auto}
      .eaglesw-bubble{padding:10px 12px;border-radius:12px;line-height:1.35;font-size:14px;white-space:pre-wrap}
      .eaglesw-msg.user .eaglesw-bubble{background:var(--eaglesw-accent);color:var(--eaglesw-accentText);border-top-right-radius:6px}
      .eaglesw-msg.bot .eaglesw-bubble{background:var(--eaglesw-surface);color:var(--eaglesw-surfaceText);border:1px solid var(--eaglesw-border);border-top-left-radius:6px}
      .eaglesw-sources{margin-top:6px;font-size:12px;color:rgba(0,33,61,.75)}
      .eaglesw-sources a{color:var(--eaglesw-surfaceText);text-decoration:underline}
      .eaglesw-footer{display:flex;align-items:center;gap:10px;padding:12px 14px 16px 14px;padding-bottom:max(16px, env(safe-area-inset-bottom, 0px));border-top:1px solid var(--eaglesw-border);background:var(--eaglesw-surface);flex-shrink:0;box-sizing:border-box}
      .eaglesw-input{flex:1;min-width:0;border:1px solid var(--eaglesw-border);border-radius:10px;padding:11px 12px;font-size:14px;outline:none;background:var(--eaglesw-surface);color:var(--eaglesw-surfaceText);box-sizing:border-box}
      .eaglesw-send{border:0;border-radius:10px;padding:10px 12px;background:var(--eaglesw-accent);color:var(--eaglesw-accentText);cursor:pointer;font-weight:700}
      .eaglesw-send:disabled{opacity:.6;cursor:not-allowed}
    `;
    const style = document.createElement("style");
    style.id = "eagles-widget-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // --- Script tag data-* (api base, theme, limits) ---
  function getConfig() {
    const s = WIDGET_SCRIPT_EL;
    const title = (s && s.getAttribute("data-title")) || DEFAULTS.title;
    const position = (s && s.getAttribute("data-position")) || DEFAULTS.position;
    const apiBase = (s && s.getAttribute("data-api-base")) || "";
    const demo = (s && s.getAttribute("data-demo")) || DEFAULTS.demo;
    const primary = (s && s.getAttribute("data-primary")) || DEFAULTS.primary;
    const text = (s && s.getAttribute("data-text")) || DEFAULTS.text;
    const surface = (s && s.getAttribute("data-surface")) || DEFAULTS.surface;
    const muted = (s && s.getAttribute("data-muted")) || DEFAULTS.muted;
    const accent = (s && s.getAttribute("data-accent")) || DEFAULTS.accent;
    const logo = (s && s.getAttribute("data-logo")) || DEFAULTS.logo;
    const freeUses = (s && s.getAttribute("data-free-uses")) || DEFAULTS.freeUses;
    const contactEmail = (s && s.getAttribute("data-contact-email")) || DEFAULTS.contactEmail;
    return {
      title,
      position: position === "left" ? "left" : "right",
      apiBase,
      demo,
      primary,
      accent,
      text,
      surface,
      muted,
      logo,
      freeUses,
      contactEmail,
    };
  }

  function resolveLogoUrl(cfg) {
    const v = cfg.logo;
    if (v === "none" || v === "false" || v === "0") return "";
    if (typeof v === "string" && v.trim() && v !== "auto") return v.trim();
    const api = normalizeApiBase(cfg.apiBase || "");
    try {
      // PNG is always deployed at site root `/orlando-eagles-logo.png`, not next to the script path.
      if (WIDGET_SCRIPT_SRC) {
        const origin = new URL(WIDGET_SCRIPT_SRC).origin;
        return `${origin}/orlando-eagles-logo.png`;
      }
      if (api) {
        return `${api}/orlando-eagles-logo.png`;
      }
      if (typeof window !== "undefined" && window.location && window.location.origin) {
        return `${window.location.origin}/orlando-eagles-logo.png`;
      }
      return "/orlando-eagles-logo.png";
    } catch {
      return api ? `${api}/orlando-eagles-logo.png` : "/orlando-eagles-logo.png";
    }
  }

  function normalizeApiBase(apiBase) {
    if (!apiBase) return "";
    return apiBase.replace(/\/+$/, "");
  }

  /** If `data-api-base` is omitted, call the API on the same host that serves `eagles-widget.js` (fixes localhost vs 127.0.0.1). */
  function resolvedApiBase(rawApiBase) {
    const explicit = normalizeApiBase(rawApiBase);
    if (explicit) return explicit;
    if (WIDGET_SCRIPT_SRC) {
      try {
        return new URL(WIDGET_SCRIPT_SRC).origin;
      } catch {
        /* ignore */
      }
    }
    return "";
  }

  // --- POST /api/chat (and demo fallback) ---
  function formatErr(e) {
    if (e == null) return "Unknown error";
    if (typeof e === "string") return e;
    if (e instanceof Error) return e.message;
    return String(e);
  }

  async function sendMessage(state, text) {
    const lim = state.freeUses;
    if (getLocalUsed() >= lim) {
      return {
        answer: limitMessage(state.contactEmail),
        sources: [],
        rateLimit: { used: lim, limit: lim, remaining: 0 },
        limited: true,
      };
    }

    const apiBase = resolvedApiBase(state.apiBase);
    if (!apiBase) {
      if (state.demo === "off") throw new Error("Missing data-api-base and could not infer from script URL");
      return demoAnswer(state, text);
    }
    const url = `${apiBase}/api/chat`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, clientId: state.clientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const errText = data && typeof data.error === "string" ? data.error : limitMessage(state.contactEmail);
        return {
          answer: errText,
          sources: [],
          rateLimit: { used: lim, limit: lim, remaining: 0 },
          limited: true,
        };
      }
      if (!res.ok) {
        const err = data && data.error;
        const msg =
          typeof err === "string"
            ? err
            : err != null
              ? JSON.stringify(err)
              : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return data;
    } catch (e) {
      if (state.demo === "off") throw e;
      const d = demoAnswer(state, text);
      const why = formatErr(e);
      return {
        ...d,
        answer:
          `Eagles Assistant: ⚠️ Live API failed (${why}). Fix your server, .env (ANTHROPIC_API_KEY / ANTHROPIC_MODEL), and run npm run reindex.\n\n---\n\n` +
          d.answer,
      };
    }
  }

  function demoAnswer(state, userText) {
    const lim = state.freeUses;
    const used = getLocalUsed();
    if (used >= lim) {
      return {
        answer: limitMessage(state.contactEmail),
        sources: [],
        rateLimit: { used: lim, limit: lim, remaining: 0 },
        limited: true,
      };
    }

    const lower = String(userText || "").toLowerCase();
    const isCost = lower.includes("cost") || lower.includes("price") || lower.includes("how much") || lower.includes("$");
    const isChallenge = lower.includes("challenge");
    const isCamp = lower.includes("camp");
    let answer =
      "Eagles Assistant: (Demo mode) Thanks for stopping by — this is a preview while the live assistant isn’t connected. " +
      "Once our API is set up, I’ll answer from real Eagles info. For now, use the link below to browse the site.";

    if (isChallenge && isCost) {
      answer =
        "Eagles Assistant: (Demo mode) Happy to help you think about Challenge! It’s a more competitive, local option than rec — a great next step without full club demands. To get the full picture on fees and scholarships, the Challenge page below has what we’ve posted.";
    } else if (isChallenge) {
      answer =
        "Eagles Assistant: (Demo mode) Great question — Challenge is a step up from rec, with room for growth and confidence on the field while staying local and more affordable than club. We’d love to tell you more; the link below is a good place to start.";
    } else if (isCamp) {
      answer =
        "Eagles Assistant: (Demo mode) We love camp season! Orlando Eagles runs camps through the year — dates and details are on the site below whenever you’re ready to plan.";
    }

    const next = used + 1;
    setLocalUsed(next);
    return {
      answer,
      sources: [{ url: "https://www.orlandoeaglessoccer.com/", title: "Orlando Eagles (demo)", score: 1 }],
      rateLimit: { used: next, limit: lim, remaining: Math.max(0, lim - next) },
    };
  }

  // --- Chat bubbles ---
  function appendMessage(body, role, content, sources) {
    const msg = el("div", { class: `eaglesw-msg ${role}` });
    const bubble = el("div", { class: "eaglesw-bubble" }, [content]);
    msg.appendChild(bubble);

    if (role === "bot" && Array.isArray(sources) && sources.length) {
      const srcWrap = el("div", { class: "eaglesw-sources" });
      srcWrap.appendChild(el("div", {}, ["Learn more: "]));
      const ul = el("ul", { style: "margin:6px 0 0 16px;padding:0" });
      sources.slice(0, 3).forEach((s) => {
        const a = el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, [s.title || s.url]);
        ul.appendChild(el("li", {}, [a]));
      });
      srcWrap.appendChild(ul);
      msg.appendChild(srcWrap);
    }

    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  // --- Mount widget & wire events ---
  function boot() {
    ensureStyles();
    const cfg = getConfig();
    applyTheme(cfg);

    const panel = el("div", { class: `eaglesw-panel ${cfg.position}` });
    const header = el("div", { class: "eaglesw-header" });
    const brand = el("div", { class: "eaglesw-headerBrand" });
    const logoSrc = resolveLogoUrl(cfg);
    if (logoSrc) {
      const img = el("img", {
        class: "eaglesw-logo",
        src: logoSrc,
        alt: "",
        role: "presentation",
        width: "40",
        height: "40",
        loading: "eager",
        decoding: "async",
      });
      img.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      let logoFallbackTried = false;
      img.addEventListener("error", () => {
        if (logoFallbackTried) return;
        logoFallbackTried = true;
        try {
          const fallback = `${window.location.origin}/orlando-eagles-logo.png`;
          if (img.getAttribute("src") !== fallback) img.src = fallback;
        } catch {
          /* ignore */
        }
      });
      brand.appendChild(img);
    }
    const title = el("div", { class: "eaglesw-title" }, [cfg.title]);
    brand.appendChild(title);
    const close = el("button", { class: "eaglesw-close", type: "button", "aria-label": "Close" }, ["×"]);
    header.appendChild(brand);
    header.appendChild(close);

    const body = el("div", { class: "eaglesw-body" });
    const footer = el("div", { class: "eaglesw-footer" });
    const input = el("input", { class: "eaglesw-input", placeholder: "Ask about camps, programs, costs…", type: "text" });
    const send = el("button", { class: "eaglesw-send", type: "button" }, ["Send"]);
    footer.appendChild(input);
    footer.appendChild(send);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

    const btnWrap = el("div", { class: `eaglesw-btn ${cfg.position}` });
    const fab = el("button", { class: "eaglesw-fab", type: "button" }, ["Chat"]);
    btnWrap.appendChild(fab);

    document.body.appendChild(panel);
    document.body.appendChild(btnWrap);

    const fu = parseInt(String(cfg.freeUses || "5"), 10);
    const state = {
      apiBase: cfg.apiBase,
      demo: cfg.demo,
      clientId: getOrCreateClientId(),
      freeUses: Number.isFinite(fu) && fu > 0 ? fu : 5,
      contactEmail: cfg.contactEmail || DEFAULTS.contactEmail,
      limited: false,
    };

    function applyLimitUi() {
      if (state.limited) return;
      state.limited = true;
      input.disabled = true;
      send.disabled = true;
      input.placeholder = "Chat limit reached — email us to continue.";
    }

    function open() {
      panel.style.display = "flex";
      input.focus();
      if (!body.dataset.welcomed) {
        const demoNotice =
          !normalizeApiBase(state.apiBase) && state.demo !== "off"
            ? "\n\n(Demo mode: API not connected yet.)"
            : "";
        appendMessage(body, "bot", "Hi! What can I help you find on the Orlando Eagles site?" + demoNotice, []);
        body.dataset.welcomed = "1";
      }
      if (getLocalUsed() >= state.freeUses) applyLimitUi();
    }
    function closePanel() {
      panel.style.display = "none";
    }

    fab.addEventListener("click", () => (panel.style.display === "flex" ? closePanel() : open()));
    close.addEventListener("click", closePanel);

    async function onSend() {
      if (state.limited) return;
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      send.disabled = true;
      appendMessage(body, "user", text, []);
      try {
        const data = await sendMessage(state, text);
        if (data.rateLimit && typeof data.rateLimit.used === "number") setLocalUsed(data.rateLimit.used);
        appendMessage(body, "bot", data.answer || "Sorry — I had trouble answering that.", data.sources || []);
        if (data.limited) applyLimitUi();
      } catch (e) {
        appendMessage(body, "bot", "Sorry — something went wrong. Please try again in a moment.", []);
      } finally {
        if (!state.limited) {
          send.disabled = false;
          input.focus();
        }
      }
    }

    send.addEventListener("click", onSend);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") onSend();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // --- CSS variables from data-* theme overrides ---
  function applyTheme(cfg) {
    const primary = cfg.primary !== "auto" ? cfg.primary : BRAND.navy;
    const accent = cfg.accent !== "auto" ? cfg.accent : BRAND.cyan;
    const surface = cfg.surface !== "auto" ? cfg.surface : BRAND.white;
    const surfaceText = cfg.text !== "auto" ? cfg.text : BRAND.navy;
    const muted = cfg.muted !== "auto" ? cfg.muted : BRAND.muted;

    const root = document.documentElement;
    root.style.setProperty("--eaglesw-primary", primary);
    root.style.setProperty("--eaglesw-accent", accent);
    root.style.setProperty("--eaglesw-accentText", primary);
    root.style.setProperty("--eaglesw-surface", surface);
    root.style.setProperty("--eaglesw-surfaceText", surfaceText);
    root.style.setProperty("--eaglesw-muted", muted);
    root.style.setProperty("--eaglesw-primaryText", BRAND.white);
  }
})();

