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

  /** Recognized in URL suffix `-xx` or first segment `/xx/…` (avoid matching random 2-letter paths). */
  const URL_LANG_CODES = new Set([
    "en",
    "es",
    "fr",
    "de",
    "pt",
    "it",
    "nl",
    "pl",
    "sv",
    "da",
    "fi",
    "no",
    "nb",
    "cs",
    "hu",
    "ro",
    "ja",
    "ko",
    "zh",
    "ar",
    "vi",
    "th",
    "id",
    "ms",
    "tl",
    "ht",
    "uk",
  ]);

  /** Locales with full widget copy (others fall back to English UI but still send locale to the API). */
  const UI_LOCALE_KEYS = new Set(["en", "es", "fr", "de", "pt", "it"]);

  const UI_STR = {
    en: {
      limitPrefix: "Eagles Assistant",
      limitBody: "You've reached the limit for this bot. Please contact {email} for more uses.",
      placeholderInput: "Ask about camps, programs, costs…",
      sendBtn: "Send",
      chatFab: "Chat",
      closeAria: "Close",
      typingAria: "Assistant is typing",
      poweredBy: "Powered by MARSYNC",
      defaultTitle: "Eagles Assistant",
      welcomeMsg: "Hi! What can I help you find on the Orlando Eagles site?",
      limitPlaceholder: "Chat limit reached — email us to continue.",
      learnMore: "Learn more: ",
      sorryAnswer: "Sorry — I had trouble answering that.",
      sorrySendFailed: "Sorry — something went wrong. Please try again in a moment.",
      apiFailedHint: "Fix your server, .env (ANTHROPIC_API_KEY / ANTHROPIC_MODEL), and run npm run reindex.",
      demoDefault:
        "Eagles Assistant: (Demo mode) Thanks for stopping by — this is a preview while the live assistant isn’t connected. Once our API is set up, I’ll answer from real Eagles info. For now, use the link below to browse the site.",
      demoChallengeCost:
        "Eagles Assistant: (Demo mode) Happy to help you think about Challenge! It’s a more competitive, local option than rec — a great next step without full club demands. To get the full picture on fees and scholarships, the Challenge page below has what we’ve posted.",
      demoChallenge:
        "Eagles Assistant: (Demo mode) Great question — Challenge is a step up from rec, with room for growth and confidence on the field while staying local and more affordable than club. We’d love to tell you more; the link below is a good place to start.",
      demoCamp:
        "Eagles Assistant: (Demo mode) We love camp season! Orlando Eagles runs camps through the year — dates and details are on the site below whenever you’re ready to plan.",
      demoSourceTitle: "Orlando Eagles (demo)",
    },
    es: {
      limitPrefix: "Asistente Eagles",
      limitBody: "Has alcanzado el límite de este asistente. Escríbenos a {email} para más conversaciones.",
      placeholderInput: "Pregunta por campamentos, programas, precios…",
      sendBtn: "Enviar",
      chatFab: "Chat",
      closeAria: "Cerrar",
      typingAria: "El asistente está escribiendo",
      poweredBy: "Con tecnología de MARSYNC",
      defaultTitle: "Asistente Eagles",
      welcomeMsg: "¡Hola! ¿Qué puedo ayudarte a encontrar en el sitio de Orlando Eagles?",
      limitPlaceholder: "Límite de chat — escríbenos por correo para continuar.",
      learnMore: "Más información: ",
      sorryAnswer: "Lo siento — no pude responder bien a eso.",
      sorrySendFailed: "Lo siento — algo salió mal. Intenta de nuevo en un momento.",
      apiFailedHint:
        "Revisa el servidor, el .env (ANTHROPIC_API_KEY / ANTHROPIC_MODEL) y ejecuta npm run reindex.",
      demoDefault:
        "Asistente Eagles: (Modo demo) Gracias por escribir — esto es una vista previa mientras el asistente en vivo no está conectado. Cuando la API esté lista, responderé con información real de Eagles. Por ahora usa el enlace de abajo para ver el sitio.",
      demoChallengeCost:
        "Asistente Eagles: (Modo demo) ¡Encantado de ayudarte con Challenge! Es una opción más competitiva y local que recreational — un gran siguiente paso sin la carga total de club. Para tarifas y becas, la página de Challenge abajo tiene lo publicado.",
      demoChallenge:
        "Asistente Eagles: (Modo demo) Buena pregunta — Challenge es un paso arriba desde recreational, con espacio para crecer y ganar confianza en el campo, local y más accesible que muchos clubes. El enlace abajo es un buen punto de partida.",
      demoCamp:
        "Asistente Eagles: (Modo demo) ¡Nos encanta la temporada de campamentos! Orlando Eagles ofrece campamentos durante el año — fechas y detalles están en el sitio abajo cuando quieras planear.",
      demoSourceTitle: "Orlando Eagles (demo)",
    },
    fr: {
      limitPrefix: "Assistant Eagles",
      limitBody: "Vous avez atteint la limite de cet assistant. Écrivez à {email} pour continuer.",
      placeholderInput: "Posez vos questions sur camps, programmes, tarifs…",
      sendBtn: "Envoyer",
      chatFab: "Chat",
      closeAria: "Fermer",
      typingAria: "L’assistant écrit",
      poweredBy: "Propulsé par MARSYNC",
      defaultTitle: "Assistant Eagles",
      welcomeMsg: "Bonjour ! Que puis-je vous aider à trouver sur le site d’Orlando Eagles ?",
      limitPlaceholder: "Limite atteinte — écrivez-nous pour continuer.",
      learnMore: "En savoir plus : ",
      sorryAnswer: "Désolé — je n’ai pas pu répondre correctement.",
      sorrySendFailed: "Désolé — une erreur s’est produite. Réessayez dans un instant.",
      apiFailedHint: "Vérifiez le serveur, le fichier .env (ANTHROPIC_API_KEY / ANTHROPIC_MODEL) et npm run reindex.",
      demoDefault:
        "Assistant Eagles: (Démo) Merci de votre message — aperçu pendant que l’assistant n’est pas connecté. Avec l’API, je répondrai à partir des infos Eagles. Pour l’instant, utilisez le lien ci-dessous.",
      demoChallengeCost:
        "Assistant Eagles: (Démo) Challenge est une option plus compétitive et locale que le loisir — un bon pas sans tout le club. Pour les frais et bourses, voir la page Challenge ci-dessous.",
      demoChallenge:
        "Assistant Eagles: (Démo) Challenge va au-delà du loisir, avec place pour progresser, en restant local et souvent plus abordable qu’un club. Le lien ci-dessous est un bon début.",
      demoCamp:
        "Assistant Eagles: (Démo) Nous adorons les camps ! Orlando Eagles propose des camps tout au long de l’année — détails sur le site ci-dessous.",
      demoSourceTitle: "Orlando Eagles (démo)",
    },
    de: {
      limitPrefix: "Eagles Assistent",
      limitBody: "Du hast das Limit für diesen Bot erreicht. Bitte schreib uns an {email} für weitere Nutzung.",
      placeholderInput: "Frag nach Camps, Programmen, Kosten…",
      sendBtn: "Senden",
      chatFab: "Chat",
      closeAria: "Schließen",
      typingAria: "Assistent schreibt",
      poweredBy: "Unterstützt von MARSYNC",
      defaultTitle: "Eagles Assistent",
      welcomeMsg: "Hallo! Womit kann ich dir auf der Orlando-Eagles-Website helfen?",
      limitPlaceholder: "Limit erreicht — schreib uns per E-Mail, um weiterzumachen.",
      learnMore: "Mehr erfahren: ",
      sorryAnswer: "Entschuldigung — das konnte ich nicht beantworten.",
      sorrySendFailed: "Entschuldigung — etwas ist schiefgelaufen. Bitte kurz später erneut versuchen.",
      apiFailedHint: "Server, .env (ANTHROPIC_API_KEY / ANTHROPIC_MODEL) und npm run reindex prüfen.",
      demoDefault:
        "Eagles Assistent: (Demo) Danke für deine Nachricht — Vorschau, solange der Live-Assistent nicht verbunden ist. Mit API antworte ich aus echten Eagles-Infos. Bis dahin nutze den Link unten.",
      demoChallengeCost:
        "Eagles Assistent: (Demo) Challenge ist eine stärkere, lokale Option als Rec — guter Schritt ohne volles Club-Pensum. Gebühren und Stipendien stehen auf der Challenge-Seite unten.",
      demoChallenge:
        "Eagles Assistent: (Demo) Challenge ist mehr als Rec — Raum zum Wachsen, regional und oft günstiger als viele Clubs. Der Link unten ist ein guter Start.",
      demoCamp:
        "Eagles Assistent: (Demo) Wir lieben Campsaison! Orlando Eagles bietet Camps über das Jahr — Termine und Infos auf der Website unten.",
      demoSourceTitle: "Orlando Eagles (Demo)",
    },
    pt: {
      limitPrefix: "Assistente Eagles",
      limitBody: "Você atingiu o limite deste assistente. Envie um e-mail para {email} para continuar.",
      placeholderInput: "Pergunte sobre acampamentos, programas, valores…",
      sendBtn: "Enviar",
      chatFab: "Chat",
      closeAria: "Fechar",
      typingAria: "O assistente está digitando",
      poweredBy: "Tecnologia MARSYNC",
      defaultTitle: "Assistente Eagles",
      welcomeMsg: "Olá! O que posso ajudar você a encontrar no site da Orlando Eagles?",
      limitPlaceholder: "Limite do chat — envie um e-mail para continuar.",
      learnMore: "Saiba mais: ",
      sorryAnswer: "Desculpe — não consegui responder direito.",
      sorrySendFailed: "Desculpe — algo deu errado. Tente de novo em instantes.",
      apiFailedHint: "Verifique o servidor, o .env (ANTHROPIC_API_KEY / ANTHROPIC_MODEL) e npm run reindex.",
      demoDefault:
        "Assistente Eagles: (Demo) Obrigado por escrever — pré-visualização enquanto o assistente ao vivo não está ligado. Com a API, responderei com informações reais da Eagles. Por ora use o link abaixo.",
      demoChallengeCost:
        "Assistente Eagles: (Demo) Challenge é uma opção mais competitiva e local que recreational — ótimo passo sem o peso total de um clube. Taxas e bolsas estão na página Challenge abaixo.",
      demoChallenge:
        "Assistente Eagles: (Demo) Challenge vai além do recreational, com espaço para crescer no campo, local e muitas vezes mais acessível que clubes. O link abaixo é um bom começo.",
      demoCamp:
        "Assistente Eagles: (Demo) Adoramos temporada de acampamentos! A Orlando Eagles oferece acampamentos durante o ano — detalhes no site abaixo.",
      demoSourceTitle: "Orlando Eagles (demo)",
    },
    it: {
      limitPrefix: "Assistente Eagles",
      limitBody: "Hai raggiunto il limite di questo assistente. Scrivi a {email} per continuare.",
      placeholderInput: "Chiedi di camp, programmi, costi…",
      sendBtn: "Invia",
      chatFab: "Chat",
      closeAria: "Chiudi",
      typingAria: "L’assistente sta scrivendo",
      poweredBy: "Con tecnologia MARSYNC",
      defaultTitle: "Assistente Eagles",
      welcomeMsg: "Ciao! Cosa posso aiutarti a trovare sul sito degli Orlando Eagles?",
      limitPlaceholder: "Limite raggiunto — scrivici via email per continuare.",
      learnMore: "Approfondisci: ",
      sorryAnswer: "Scusa — non sono riuscito a rispondere bene.",
      sorrySendFailed: "Scusa — qualcosa è andato storto. Riprova tra un attimo.",
      apiFailedHint: "Controlla server, .env (ANTHROPIC_API_KEY / ANTHROPIC_MODEL) e npm run reindex.",
      demoDefault:
        "Assistente Eagles: (Demo) Grazie per il messaggio — anteprima mentre l’assistente live non è collegato. Con l’API risponderò con info reali Eagles. Per ora usa il link qui sotto.",
      demoChallengeCost:
        "Assistente Eagles: (Demo) Challenge è più competitivo e locale del recreational — ottimo passo senza tutto il carico di un club. Tariffe e borse sulla pagina Challenge sotto.",
      demoChallenge:
        "Assistente Eagles: (Demo) Challenge è un passo avanti dal recreational, con spazio per crescere in campo, locale e spesso più conveniente dei club. Il link sotto è un buon inizio.",
      demoCamp:
        "Assistente Eagles: (Demo) Amiamo la stagione dei camp! Orlando Eagles organizza camp durante l’anno — dettagli sul sito sotto.",
      demoSourceTitle: "Orlando Eagles (demo)",
    },
  };

  function detectLocaleFromPath(pathname) {
    try {
      const raw = String(pathname || "/").split(/[?#]/)[0];
      const p = raw.replace(/\/+$/, "") || "/";
      const suf = p.match(/-([a-z]{2})$/i);
      if (suf) {
        const c = suf[1].toLowerCase();
        if (URL_LANG_CODES.has(c)) return c;
      }
      const lead = p.match(/^\/([a-z]{2})(\/|$)/i);
      if (lead) {
        const c = lead[1].toLowerCase();
        if (URL_LANG_CODES.has(c)) return c;
      }
    } catch {
      /* ignore */
    }
    return "en";
  }

  function resolveWidgetLocale(cfg) {
    const raw = (cfg.localeAttr || "").trim().toLowerCase();
    if (raw && raw !== "auto") {
      const c = raw.slice(0, 2);
      if (/^[a-z]{2}$/.test(c)) return c;
    }
    try {
      return detectLocaleFromPath(window.location.pathname);
    } catch {
      return "en";
    }
  }

  function stringsForLocale(locale) {
    const c = String(locale || "en").slice(0, 2).toLowerCase();
    const base = UI_STR.en;
    const ov = UI_LOCALE_KEYS.has(c) ? UI_STR[c] || {} : {};
    return Object.assign({}, base, ov);
  }

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

  function limitMessage(contactEmail, copy) {
    const c = copy || stringsForLocale("en");
    return `${c.limitPrefix}: ${c.limitBody.replace(/\{email\}/g, contactEmail)}`;
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
        --eaglesw-panel-resize-duration:340ms;
        --eaglesw-panel-resize-ease:cubic-bezier(0.33, 1, 0.68, 1);
      }
      .eaglesw-btn{position:fixed;bottom:22px;z-index:999999;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;}
      .eaglesw-btn.right{right:22px}.eaglesw-btn.left{left:22px}
      .eaglesw-fab{border:2px solid var(--eaglesw-accent);border-radius:999px;padding:12px 14px;background:var(--eaglesw-accent);color:var(--eaglesw-accentText);cursor:pointer;box-shadow:0 10px 25px var(--eaglesw-shadow);font-weight:600}
      .eaglesw-panel{position:fixed;bottom:80px;z-index:999999;width:min(380px,calc(100vw - 24px));min-height:280px;max-height:calc(100vh - 80px - 16px - env(safe-area-inset-top, 0px));height:auto;background:var(--eaglesw-surface);border:2px solid var(--eaglesw-accent);border-radius:14px;box-shadow:0 20px 55px var(--eaglesw-shadow);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial;display:none;flex-direction:column;box-sizing:border-box;transition:height var(--eaglesw-panel-resize-duration) var(--eaglesw-panel-resize-ease)}
      .eaglesw-panel.right{right:22px}.eaglesw-panel.left{left:22px}
      .eaglesw-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 14px 14px 14px;background:var(--eaglesw-primary);color:var(--eaglesw-primaryText);flex-shrink:0;min-height:52px;box-sizing:border-box}
      .eaglesw-headerBrand{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
      .eaglesw-logo{width:40px;height:40px;object-fit:contain;flex-shrink:0;border-radius:50%;background:${BRAND.white};padding:3px;box-sizing:border-box;display:block}
      .eaglesw-title{font-weight:700;font-size:15px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;align-self:center}
      .eaglesw-close{background:transparent;border:0;color:var(--eaglesw-primaryText);font-size:20px;line-height:1;cursor:pointer;padding:6px 8px;flex-shrink:0;align-self:flex-start}
      .eaglesw-body{padding:14px;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;background:var(--eaglesw-muted);scroll-behavior:auto;overscroll-behavior:contain}
      .eaglesw-msg{margin:10px 0;max-width:92%}
      .eaglesw-msg.user{margin-left:auto}
      .eaglesw-bubble{padding:10px 12px;border-radius:12px;line-height:1.35;font-size:14px;white-space:pre-wrap}
      .eaglesw-msg.user .eaglesw-bubble{background:var(--eaglesw-accent);color:var(--eaglesw-accentText);border-top-right-radius:6px}
      .eaglesw-msg.bot .eaglesw-bubble{background:var(--eaglesw-surface);color:var(--eaglesw-surfaceText);border:1px solid var(--eaglesw-border);border-top-left-radius:6px}
      .eaglesw-sources{margin-top:6px;font-size:12px;color:rgba(0,33,61,.75)}
      .eaglesw-sources a{color:var(--eaglesw-surfaceText);text-decoration:underline}
      .eaglesw-footer{display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:12px 14px 14px 14px;padding-bottom:max(14px, env(safe-area-inset-bottom, 0px));border-top:1px solid var(--eaglesw-border);background:var(--eaglesw-surface);flex-shrink:0;margin-top:auto;box-sizing:border-box}
      .eaglesw-footerRow{display:flex;align-items:center;gap:10px;width:100%;min-width:0}
      .eaglesw-powered{font-size:10px;line-height:1.25;color:var(--eaglesw-surfaceText);opacity:.55;text-align:center;margin:0;font-weight:400}
      .eaglesw-input{flex:1;min-width:0;border:1px solid var(--eaglesw-border);border-radius:10px;padding:11px 12px;font-size:14px;outline:none;background:var(--eaglesw-surface);color:var(--eaglesw-surfaceText);box-sizing:border-box}
      .eaglesw-send{border:0;border-radius:10px;padding:10px 12px;background:var(--eaglesw-accent);color:var(--eaglesw-accentText);cursor:pointer;font-weight:700}
      .eaglesw-send:disabled{opacity:.6;cursor:not-allowed}
      .eaglesw-input:disabled{opacity:.65;cursor:not-allowed}
      .eaglesw-msg.eaglesw-typing-msg{max-width:92%;width:fit-content}
      .eaglesw-typing-bubble{display:inline-flex !important;align-items:center;justify-content:center;padding:10px 13px !important;min-height:0 !important;width:auto;border-left:none;box-shadow:none}
      .eaglesw-typing-dots{display:inline-flex;align-items:center;gap:6px;margin:0;padding:0}
      .eaglesw-typing-dots span{width:8px;height:8px;border-radius:50%;background:var(--eaglesw-accent);opacity:.45;animation:eaglesw-dot 1.05s infinite cubic-bezier(.45,.05,.55,.95)}
      .eaglesw-typing-dots span:nth-child(2){animation-delay:.16s}
      .eaglesw-typing-dots span:nth-child(3){animation-delay:.32s}
      @keyframes eaglesw-dot{0%,70%,100%{opacity:.38;transform:translateY(0) scale(.92)}35%{opacity:1;transform:translateY(-4px) scale(1)}}
      @media (prefers-reduced-motion:reduce){
        .eaglesw-panel{transition:none}
      }
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
    /** `auto` = infer from URL (`/page-es`, `/es/page`). Override with `data-locale="es"` etc. */
    const localeAttr = (s && s.getAttribute("data-locale")) || "auto";
    const titleExplicit = !!(s && s.hasAttribute("data-title"));
    return {
      title,
      titleExplicit,
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
      localeAttr,
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

  /** POST /api/event — logs to Postgres when DATABASE_URL is set on your server. */
  function trackAnalytics(state, eventType, metadata) {
    const apiBase = resolvedApiBase(state.apiBase);
    if (!apiBase) return;
    try {
      var pagePath = "";
      try {
        pagePath = window.location && window.location.pathname ? window.location.pathname : "";
      } catch {
        /* ignore */
      }
      fetch(apiBase + "/api/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: eventType,
          locale: state.locale || "en",
          clientId: state.clientId,
          pagePath: pagePath,
          metadata: metadata || {},
        }),
        keepalive: true,
      }).catch(function () {});
    } catch {
      /* ignore */
    }
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
    const copy = state.copy || stringsForLocale("en");
    if (getLocalUsed() >= lim) {
      return {
        answer: limitMessage(state.contactEmail, copy),
        sources: [],
        rateLimit: { used: lim, limit: lim, remaining: 0 },
        limited: true,
      };
    }

    const apiBase = resolvedApiBase(state.apiBase);
    if (!apiBase) {
      if (state.demo === "off") throw new Error("Missing data-api-base and could not infer from script URL");
      return demoAnswer(state, text, copy, state.locale);
    }
    const url = `${apiBase}/api/chat`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          clientId: state.clientId,
          locale: state.locale || "en",
          pagePath:
            typeof window !== "undefined" && window.location && window.location.pathname
              ? window.location.pathname
              : "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const errText = data && typeof data.error === "string" ? data.error : limitMessage(state.contactEmail, copy);
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
      const d = demoAnswer(state, text, copy, state.locale);
      const why = formatErr(e);
      const prefix = copy.limitPrefix || "Eagles Assistant";
      return {
        ...d,
        answer:
          `${prefix}: ⚠️ Live API failed (${why}). ${copy.apiFailedHint}\n\n---\n\n` +
          d.answer,
      };
    }
  }

  function demoAnswer(state, userText, copy, locale) {
    const lim = state.freeUses;
    const used = getLocalUsed();
    const c = copy || stringsForLocale("en");
    const lc = String(locale || "en").slice(0, 2).toLowerCase();
    if (used >= lim) {
      return {
        answer: limitMessage(state.contactEmail, c),
        sources: [],
        rateLimit: { used: lim, limit: lim, remaining: 0 },
        limited: true,
      };
    }

    const lower = String(userText || "").toLowerCase();
    const isCost =
      lower.includes("cost") ||
      lower.includes("price") ||
      lower.includes("how much") ||
      lower.includes("$") ||
      (lc === "es" &&
        (lower.includes("precio") || lower.includes("costo") || lower.includes("cuánto") || lower.includes("cuanto"))) ||
      (lc === "fr" &&
        (lower.includes("prix") || lower.includes("combien") || lower.includes("tarif") || lower.includes("coût"))) ||
      (lc === "de" &&
        (lower.includes("preis") || lower.includes("kosten") || lower.includes("wie viel") || lower.includes("gebühr"))) ||
      (lc === "pt" &&
        (lower.includes("preço") || lower.includes("preco") || lower.includes("quanto") || lower.includes("valor"))) ||
      (lc === "it" &&
        (lower.includes("prezzo") || lower.includes("costo") || lower.includes("quanto") || lower.includes("tariffa")));
    const isChallenge =
      lower.includes("challenge") ||
      (lc === "es" && lower.includes("challenge")) ||
      (lc === "fr" && lower.includes("challenge")) ||
      (lc === "de" && lower.includes("challenge")) ||
      (lc === "pt" && lower.includes("challenge")) ||
      (lc === "it" && lower.includes("challenge"));
    const isCamp =
      lower.includes("camp") ||
      (lc === "es" && (lower.includes("campamento") || lower.includes("camp"))) ||
      (lc === "fr" && (lower.includes("camp") || lower.includes("stage"))) ||
      (lc === "de" && (lower.includes("camp") || lower.includes("lager"))) ||
      (lc === "pt" && (lower.includes("acamp") || lower.includes("camp"))) ||
      (lc === "it" && (lower.includes("camp") || lower.includes("campo")));

    let answer = c.demoDefault;

    if (isChallenge && isCost) {
      answer = c.demoChallengeCost;
    } else if (isChallenge) {
      answer = c.demoChallenge;
    } else if (isCamp) {
      answer = c.demoCamp;
    }

    const next = used + 1;
    setLocalUsed(next);
    return {
      answer,
      sources: [{ url: "https://www.orlandoeaglessoccer.com/", title: c.demoSourceTitle, score: 1 }],
      rateLimit: { used: next, limit: lim, remaining: Math.max(0, lim - next) },
    };
  }

  /** Match assistant policy: no em/en dashes in displayed chat text. */
  function normalizeChatDashes(s) {
    return String(s || "").replace(/\u2014/g, "-").replace(/\u2013/g, "-");
  }

  // --- Chat bubbles ---
  function appendMessage(body, role, content, sources, learnLabel) {
    const msg = el("div", { class: `eaglesw-msg ${role}` });
    const bubble = el("div", { class: "eaglesw-bubble" }, [normalizeChatDashes(content)]);
    msg.appendChild(bubble);

    if (role === "bot" && Array.isArray(sources) && sources.length) {
      const srcWrap = el("div", { class: "eaglesw-sources" });
      srcWrap.appendChild(el("div", {}, [learnLabel || "Learn more: "]));
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

  function appendTypingIndicator(bodyEl, copy) {
    const c = copy || stringsForLocale("en");
    const wrap = el("div", { class: "eaglesw-msg bot eaglesw-typing-msg", "aria-live": "polite" });
    const bubble = el("div", { class: "eaglesw-bubble eaglesw-typing-bubble" });
    const dots = el("div", {
      class: "eaglesw-typing-dots",
      role: "status",
      "aria-label": c.typingAria,
    });
    dots.appendChild(el("span"));
    dots.appendChild(el("span"));
    dots.appendChild(el("span"));
    bubble.appendChild(dots);
    wrap.appendChild(bubble);
    bodyEl.appendChild(wrap);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return wrap;
  }

  // --- Mount widget & wire events ---
  function boot() {
    ensureStyles();
    const cfg = getConfig();
    applyTheme(cfg);
    const locale = resolveWidgetLocale(cfg);
    const copy = stringsForLocale(locale);

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
    const titleText = cfg.titleExplicit ? cfg.title : copy.defaultTitle;
    const title = el("div", { class: "eaglesw-title" }, [titleText]);
    brand.appendChild(title);
    const close = el("button", { class: "eaglesw-close", type: "button", "aria-label": copy.closeAria }, ["×"]);
    header.appendChild(brand);
    header.appendChild(close);

    const body = el("div", { class: "eaglesw-body" });
    const footer = el("div", { class: "eaglesw-footer" });
    const footerRow = el("div", { class: "eaglesw-footerRow" });
    const input = el("input", { class: "eaglesw-input", placeholder: copy.placeholderInput, type: "text" });
    const send = el("button", { class: "eaglesw-send", type: "button" }, [copy.sendBtn]);
    footerRow.appendChild(input);
    footerRow.appendChild(send);
    const powered = el("div", { class: "eaglesw-powered" }, [copy.poweredBy]);
    footer.appendChild(footerRow);
    footer.appendChild(powered);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

    const btnWrap = el("div", { class: `eaglesw-btn ${cfg.position}` });
    const fab = el("button", { class: "eaglesw-fab", type: "button" }, [copy.chatFab]);
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
      locale,
      copy,
      /** Base height between sends matches classic panel; panelPeakPx grows only when content exceeds base (capped). */
      panelPeakPx: 0,
      panelExpandedForLong: false,
      panelLastOuterPx: undefined,
      trackedChatOpen: false,
    };

    function applyLimitUi() {
      if (state.limited) return;
      state.limited = true;
      input.disabled = true;
      send.disabled = true;
      input.placeholder = copy.limitPlaceholder;
    }

    /** Matches `.eaglesw-panel { bottom }` — height grows upward from here. */
    const PANEL_BOTTOM_OFFSET_PX = 80;
    /** Space kept between panel top and viewport top so the widget is not clipped. */
    const PANEL_TOP_CLEARANCE_PX = 16;

    let safeAreaInsetTopPx = 0;
    function refreshSafeAreaInsetTop() {
      try {
        const d = document.createElement("div");
        d.setAttribute("aria-hidden", "true");
        d.style.cssText =
          "position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;width:1px;height:0;margin:0;border:0;padding:0;padding-top:env(safe-area-inset-top,0px)";
        document.body.appendChild(d);
        safeAreaInsetTopPx = parseFloat(getComputedStyle(d).paddingTop) || 0;
        document.body.removeChild(d);
      } catch {
        safeAreaInsetTopPx = 0;
      }
    }
    refreshSafeAreaInsetTop();

    /** Original default outer height: min(520px, viewport − chrome). */
    function basePanelOuterPx() {
      return Math.min(520, Math.max(220, window.innerHeight - 140));
    }

    /** Max outer height: space from top clearance (+ notch inset) down to panel bottom offset. */
    function expandedMaxOuterPx() {
      const cap =
        window.innerHeight -
        PANEL_BOTTOM_OFFSET_PX -
        PANEL_TOP_CLEARANCE_PX -
        safeAreaInsetTopPx;
      return Math.max(220, cap);
    }

    /**
     * Vertical space to reserve for the transcript area so the shell can shrink after a long older reply.
     * Uses the latest exchange (last user message → bottom); earlier bubbles scroll inside.
     * Single-turn chats measure from the first row so the welcome stays included.
     */
    function measureChatBodyNeededPx(bodyEl) {
      const rows = Array.from(bodyEl.querySelectorAll(":scope > .eaglesw-msg"));
      if (!rows.length) return bodyEl.scrollHeight;

      let lastUserIdx = -1;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].classList.contains("user")) {
          lastUserIdx = i;
          break;
        }
      }
      if (lastUserIdx < 0) return bodyEl.scrollHeight;

      const userRows = rows.filter((r) => r.classList.contains("user")).length;
      const startIdx = userRows === 1 ? 0 : lastUserIdx;

      const first = rows[startIdx];
      const last = rows[rows.length - 1];
      const cs = getComputedStyle(bodyEl);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const inner = Math.max(0, last.offsetTop + last.offsetHeight - first.offsetTop);
      return Math.min(bodyEl.scrollHeight, padY + inner);
    }

    function pinChatBottom(bodyEl) {
      bodyEl.scrollTop = Math.max(0, bodyEl.scrollHeight - bodyEl.clientHeight);
    }

    /** After shrink height finishes: one corrective pin (scroll ran before shrink started). */
    function armShrinkEndPin(panelEl, bodyEl) {
      const prevCleanup = panelEl._eagleswShrinkCleanup;
      if (typeof prevCleanup === "function") prevCleanup();

      let settled = false;
      let tid = 0;

      function cleanupListen() {
        panelEl.removeEventListener("transitionend", onEnd);
        window.clearTimeout(tid);
        if (panelEl._eagleswShrinkCleanup === cleanupListen) delete panelEl._eagleswShrinkCleanup;
      }

      function finish() {
        if (settled) return;
        settled = true;
        cleanupListen();
        requestAnimationFrame(() => pinChatBottom(bodyEl));
      }

      function onEnd(ev) {
        if (ev.target !== panelEl || ev.propertyName !== "height") return;
        finish();
      }

      panelEl._eagleswShrinkCleanup = cleanupListen;
      panelEl.addEventListener("transitionend", onEnd);
      tid = window.setTimeout(finish, 660);
    }

    function syncPanelHeight(opts) {
      const scrollBottom = opts && opts.scrollBottom === true;
      requestAnimationFrame(() => {
        const base = basePanelOuterPx();
        const growCap = expandedMaxOuterPx();
        const hh = header.offsetHeight;
        const fh = footer.offsetHeight;
        const border = 6;
        void body.offsetHeight;
        const bh = measureChatBodyNeededPx(body);
        const needed = hh + fh + bh + border;

        const clamped = Math.min(Math.max(base, needed), growCap);
        state.panelPeakPx = clamped;
        state.panelExpandedForLong = clamped > base + 8;

        const outer = state.panelExpandedForLong
          ? Math.min(state.panelPeakPx, growCap)
          : Math.min(base, growCap);

        const prevOuter = state.panelLastOuterPx;
        let resizeKind = "same";
        if (typeof prevOuter === "number" && Number.isFinite(prevOuter)) {
          if (outer < prevOuter - 2) resizeKind = "shrink";
          else if (outer > prevOuter + 2) resizeKind = "grow";
        }

        if (resizeKind === "shrink") {
          panel.style.setProperty("--eaglesw-panel-resize-duration", "600ms");
          panel.style.setProperty("--eaglesw-panel-resize-ease", "cubic-bezier(0.33, 1, 0.68, 1)");
        } else if (resizeKind === "grow") {
          panel.style.setProperty("--eaglesw-panel-resize-duration", "400ms");
          panel.style.setProperty("--eaglesw-panel-resize-ease", "cubic-bezier(0.22, 1, 0.36, 1)");
        } else {
          panel.style.removeProperty("--eaglesw-panel-resize-duration");
          panel.style.removeProperty("--eaglesw-panel-resize-ease");
        }

        const slack = 48;
        const nearBottom =
          body.scrollHeight - body.scrollTop - body.clientHeight < slack;

        if (resizeKind === "shrink") {
          const scrollThenShrink = scrollBottom || nearBottom;

          const commitShrinkHeight = () => {
            panel.style.height = `${outer}px`;
            body.style.maxHeight = "";
            armShrinkEndPin(panel, body);
          };

          if (scrollThenShrink) {
            state.panelLastOuterPx = outer;
            pinChatBottom(body);
            requestAnimationFrame(() => {
              pinChatBottom(body);
              commitShrinkHeight();
            });
          } else {
            state.panelLastOuterPx = outer;
            panel.style.height = `${outer}px`;
            body.style.maxHeight = "";
          }
          return;
        }

        state.panelLastOuterPx = outer;
        panel.style.height = `${outer}px`;
        body.style.maxHeight = "";

        if (scrollBottom) {
          pinChatBottom(body);
          requestAnimationFrame(() => {
            pinChatBottom(body);
            requestAnimationFrame(() => pinChatBottom(body));
          });
          window.setTimeout(() => pinChatBottom(body), 450);
        } else if (nearBottom) {
          pinChatBottom(body);
        }
      });
    }

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        refreshSafeAreaInsetTop();
        syncPanelHeight();
      }, 140);
    });

    function open() {
      panel.style.display = "flex";
      input.focus();
      refreshSafeAreaInsetTop();
      if (!state.trackedChatOpen) {
        state.trackedChatOpen = true;
        trackAnalytics(state, "chat_open");
      }
      if (!body.dataset.welcomed) {
        appendMessage(body, "bot", state.copy.welcomeMsg, [], state.copy.learnMore);
        body.dataset.welcomed = "1";
      }
      if (getLocalUsed() >= state.freeUses) applyLimitUi();
      state.panelExpandedForLong = false;
      requestAnimationFrame(() => syncPanelHeight({ scrollBottom: true }));
    }
    function closePanel() {
      panel.style.display = "none";
      state.panelPeakPx = 0;
      state.panelExpandedForLong = false;
      state.panelLastOuterPx = undefined;
      panel.style.removeProperty("--eaglesw-panel-resize-duration");
      panel.style.removeProperty("--eaglesw-panel-resize-ease");
      if (typeof panel._eagleswShrinkCleanup === "function") {
        panel._eagleswShrinkCleanup();
        delete panel._eagleswShrinkCleanup;
      }
      panel.style.height = "";
      body.style.maxHeight = "";
    }

    fab.addEventListener("click", () => (panel.style.display === "flex" ? closePanel() : open()));
    close.addEventListener("click", closePanel);

    async function onSend() {
      if (state.limited) return;
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      send.disabled = true;
      input.disabled = true;
      state.panelExpandedForLong = false;
      appendMessage(body, "user", text, [], state.copy.learnMore);
      /* Defer syncPanelHeight until assistant message — keeps height stable while typing / awaiting API. */
      let typingEl = null;
      let lastAnswer = "";
      let lastSources = [];
      try {
        typingEl = appendTypingIndicator(body, state.copy);
        const data = await sendMessage(state, text);
        if (data.rateLimit && typeof data.rateLimit.used === "number") setLocalUsed(data.rateLimit.used);
        lastAnswer = data.answer || state.copy.sorryAnswer;
        lastSources = data.sources || [];
        appendMessage(body, "bot", lastAnswer, lastSources, state.copy.learnMore);
        if (data.limited) applyLimitUi();
      } catch (e) {
        lastAnswer = state.copy.sorrySendFailed;
        appendMessage(body, "bot", lastAnswer, [], state.copy.learnMore);
      } finally {
        if (typingEl) typingEl.remove();
        syncPanelHeight({ scrollBottom: true });
        if (!state.limited) {
          send.disabled = false;
          input.disabled = false;
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

