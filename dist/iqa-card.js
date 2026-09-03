/*
 * IQA Card — carte Lovelace pour l'indice de qualité de l'air
 * Copyright (C) 2026 rivland
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


const VERSION = "1.0.0";

const TIERS = [
  { min: 80, name: "Excellent", vivid: "#7BC67A",
    light: { fg: "#1f7a35", bg: "#e8f3ea" }, dark: { fg: "#6fd287", bg: "#1e3323" } },
  { min: 60, name: "Bon",       vivid: "#F5C563",
    light: { fg: "#9a6a05", bg: "#fdf6e3" }, dark: { fg: "#f0c95c", bg: "#33301c" } },
  { min: 40, name: "Moyen",     vivid: "#FF7A4D",
    light: { fg: "#c25610", bg: "#fdf1e2" }, dark: { fg: "#ff9a4a", bg: "#33261a" } },
  { min: 20, name: "Médiocre",  vivid: "#E73838",
    light: { fg: "#cf2b1c", bg: "#fceceb" }, dark: { fg: "#ff7565", bg: "#3a1f1d" } },
  { min: 0,  name: "Dangereux", vivid: "#9F4BC4",
    light: { fg: "#8b2fb8", bg: "#f5eafb" }, dark: { fg: "#cd82ee", bg: "#2e1f38" } },
];
const tierOf = (s) => TIERS.find((t) => s >= t.min) || TIERS[TIERS.length - 1];

/* Bande de l'échelle IQA, reprise de la fiche des couleurs */
const IQA_GRADIENT =
  "linear-gradient(90deg, #9F4BC4 0%, #E73838 20%, #FF7A4D 40%, " +
  "#F5C563 62%, #A8D99A 82%, #7BC67A 100%)";

const LIGHT_STOPS = [
  { v: 100, c: [158, 223, 156] }, { v: 80, c: [158, 223, 156] },  /* Excellent */
  { v: 79,  c: [251, 210, 136] }, { v: 60, c: [251, 210, 136] },  /* Bon       */
  { v: 59,  c: [255, 163, 118] }, { v: 40, c: [255, 163, 118] },  /* Moyen     */
  { v: 39,  c: [249, 110, 105] }, { v: 20, c: [249, 110, 105] },  /* Médiocre  */
  { v: 19,  c: [193, 124, 222] }, { v: 0,  c: [193, 124, 222] },  /* Dangereux */
];
const DARK_STOPS = [
  { v: 100, c: [123, 198, 122] }, { v: 80, c: [123, 198, 122] },
  { v: 79,  c: [245, 197, 99]  }, { v: 60, c: [245, 197, 99]  },
  { v: 59,  c: [255, 122, 77]  }, { v: 40, c: [255, 122, 77]  },
  { v: 39,  c: [240, 95, 90]   }, { v: 20, c: [240, 95, 90]   },
  { v: 19,  c: [178, 110, 210] }, { v: 0,  c: [178, 110, 210] },
];

function interp(val, stops) {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (val <= a.v && val >= b.v) {
      const t = (a.v - val) / (a.v - b.v);
      return a.c.map((ac, idx) => Math.round(ac + (b.c[idx] - ac) * t));
    }
  }
  return val > stops[0].v ? stops[0].c : stops[stops.length - 1].c;
}

function gradientFor(score) {
  const v = Math.min(100, Math.max(0, score));
  const c1 = interp(v, LIGHT_STOPS);
  const c2 = interp(v, DARK_STOPS);
  return `linear-gradient(135deg, rgb(${c1.join(",")}) 0%, rgb(${c2.join(",")}) 100%)`;
}

/**
 * Lit l'attribut `detail` quelle que soit sa forme.
 * Selon le contexte de rendu, Home Assistant peut livrer un objet déjà
 * décodé, une chaîne JSON, ou une chaîne JSON dont les guillemets ont été
 * échappés en entités HTML (&#39; &quot; …). On accepte les trois.
 */
function readDetail(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;

  const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };

  let out = tryParse(raw);
  if (out) return out;

  const ta = document.createElement("textarea");
  ta.innerHTML = raw;
  out = tryParse(ta.value);
  if (out) return out;

  const pythonish = ta.value
    .replace(/'/g, '"')
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null");
  return tryParse(pythonish);
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* kind = type de rendu, label = texte du sélecteur. L'ordre des clés fixe
   l'ordre du menu déroulant (Object.entries conserve l'insertion). */
const VARIANTS = {
  A: { kind: "gradient", ends: null, label: "Version A" },
  B: { kind: "scale",    ends: null, label: "Version B" },
  C: { kind: "bar",      ends: null, label: "Version C" },
  D: { kind: "minimal",  ends: null, label: "Version D" },
};

/* Défaut visuel : Version A (voir la liste des variantes en tête de fichier). */
const DEFAUT = "A";

class IqaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._holdTimer = null;
    this._held = false;
  }

  /* ── Configuration ────────────────────────────────────────────────────── */
  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("Veuillez choisir une entité IQA.");
    }
    const cfg = { variant: DEFAUT, ...config };
    if (typeof cfg.variant === "string") cfg.variant = cfg.variant.toUpperCase();
    if (!VARIANTS[cfg.variant]) cfg.variant = DEFAUT;
    this._config = cfg;
  }

  static getStubConfig(hass) {
    const candidate = Object.keys(hass?.states || {}).find((id) => {
      if (!id.startsWith("sensor.")) return false;
      const d = readDetail(hass.states[id]?.attributes?.detail);
      return d && Array.isArray(d.factors);
    });
    return { type: "custom:iqa-card", entity: candidate || "", variant: DEFAUT };
  }

  /* Éditeur visuel natif : sélecteurs fournis par Home Assistant */
  static getConfigForm() {
    return {
      schema: [
        { name: "entity", required: true, selector: { entity: { domain: "sensor" } } },
        { name: "name", selector: { text: {} } },
        { name: "variant", selector: { select: { mode: "dropdown",
            options: Object.entries(VARIANTS).map(([v, d]) => ({ value: v, label: d.label })) } } },
      ],
      computeLabel: (s) => ({
        entity: "Capteur IQA",
        name: "Nom affiché (optionnel)",
        variant: "Version",
      }[s.name] || s.name),
      computeHelper: (s) => (s.name === "entity"
        ? "Le capteur créé avec la macro iqa.jinja (celui qui expose l'attribut « detail »)."
        : undefined),
    };
  }

  getCardSize() { return 1; }

  /* ── Cycle de vie ─────────────────────────────────────────────────────── */
  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _state() {
    const id = this._config?.entity;
    return id && this._hass?.states ? this._hass.states[id] : undefined;
  }

  /* ── Rendu ────────────────────────────────────────────────────────────── */
  _render() {
    const st = this._state();

    if (!st) {
      this.shadowRoot.innerHTML = this._styles() +
        `<ha-card><div class="msg">Entité introuvable :
         <code>${esc(this._config?.entity)}</code></div></ha-card>`;
      return;
    }

    const detail = readDetail(st.attributes.detail);
    if (!detail || !Array.isArray(detail.factors)) {
      this.shadowRoot.innerHTML = this._styles() +
        `<ha-card><div class="msg">
          <strong>Ce capteur n'expose pas d'attribut « detail ».</strong>
          <p>Cette carte attend un capteur créé avec la macro <code>iqa.jinja</code>.
          Vérifiez que votre capteur définit bien&nbsp;:</p>
          <pre>attributes:
  detail: &gt;
    {% from 'iqa.jinja' import iqa_detail %}
    {{ iqa_detail(...) }}</pre>
        </div></ha-card>`;
      return;
    }

    const score = Math.min(100, Math.max(0, Math.round(Number(detail.score ?? st.state) || 0)));
    const name = this._config.name || st.attributes.friendly_name || this._config.entity;
    const tier = tierOf(score);

    this.shadowRoot.innerHTML =
      this._styles() + `<ha-card>${this._body(score, name, tier)}</ha-card>`;

    const hit = this.shadowRoot.querySelector(".hit");
    hit.addEventListener("pointerdown", () => this._startHold());
    hit.addEventListener("pointerup", () => this._cancelHold());
    hit.addEventListener("pointercancel", () => this._cancelHold());
    hit.addEventListener("pointerleave", () => this._cancelHold());
    hit.addEventListener("click", () => {
      if (this._held) { this._held = false; return; }   // l'appui long a déjà agi
      this._openDetail();
    });
    hit.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* Une variante = un fragment. Le reste de la carte est commun. */
  _body(score, name, tier) {
    const v = VARIANTS[this._config.variant] || VARIANTS[DEFAUT];

    const head = `
      <span class="nm">${esc(name)}</span>
      <span class="tr">${esc(tier.name)}</span>
      <span class="sc">${score}</span>`;

    if (v.kind === "gradient") {
      return `
        <div class="hit compact grad-bg" style="background:${gradientFor(score)}">
          <span class="nm">${esc(name)}</span>
          <span class="tr">${esc(tier.name)}</span>
          <span class="sc">${score}</span>
          <div class="a-line"><i style="width:${score}%"></i></div>
        </div>`;
    }

    if (v.kind === "minimal") {
      return `<div class="hit compact no-gauge">
          <span class="nm">${esc(name)}</span>
          <span class="dot"></span>
          <span class="tr">${esc(tier.name)}</span>
          <span class="sc">${score}</span>
        </div>`;
    }

    if (v.kind === "bar") {
      return `<div class="hit compact">
          <span class="nm">${esc(name)}</span>
          <span class="chip">${esc(tier.name)}</span>
          <span class="sc">${score}</span>
          <div class="b-line"><i style="width:${score}%"></i></div>
        </div>`;
    }

    /* kind "scale" — échelle IQA + repère. Les bornes de texte (`ends`,
       inutilisées par les variantes actuelles) se poseraient AU-DESSUS de la
       barre plutôt que de part et d'autre, pour ne jamais faire varier la
       largeur de la jauge selon la longueur des libellés. */
    const ends = v.ends;
    return `<div class="hit compact">
        ${head}
        <div class="s-row">
          ${ends ? `<span class="s-end s-l">${esc(ends[0])}</span>
                    <span class="s-end s-r">${esc(ends[1])}</span>` : ""}
          <div class="s-track">
            <div class="s-grad"></div>
            <div class="s-tick" style="left:${score}%"></div>
          </div>
        </div>
      </div>`;
  }

  /* `click` (pas pointerdown/up) : le navigateur ne l'émet qu'après un vrai
     appui, jamais après un défilement — un tremblement du doigt de plus de
     10 px n'annule donc plus l'ouverture sur mobile. */
  _startHold() {
    this._held = false;
    this._cancelHold();
    this._holdTimer = setTimeout(() => {
      this._held = true;
      this._moreInfo(this._config.entity);
    }, 500);
  }

  _cancelHold() {
    if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = null; }
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId }, bubbles: true, composed: true }));
  }

  /* ── Historique 24 h ──────────────────────────────────────────────────
     Une seule requête WebSocket pour toutes les entités affichées.
     Retourne { entity_id: [valeurs numériques] }. En cas d'échec on renvoie
     un objet vide : la vue détail s'affiche alors sans courbes. */
  async _fetchHistory(entityIds) {
    if (!entityIds.length || !this._hass?.callWS) return {};
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 3600 * 1000);
    try {
      const raw = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        minimal_response: true,
        no_attributes: true,
        entity_ids: entityIds,
      });
      const out = {};
      for (const id of entityIds) {
        const list = raw?.[id] || [];
        out[id] = list
          .map((p) => parseFloat(p.s ?? p.state))
          .filter((n) => Number.isFinite(n));
      }
      return out;
    } catch (err) {
      console.warn("IQA-CARD : historique indisponible", err);
      return {};
    }
  }

  /* Variation sur 24 h : valeur la plus ancienne comparée à la plus récente.
     Renvoie null si la série est absente ou trop courte pour conclure. */
  _delta(series, key) {
    if (!series || series.length < 2) return null;
    const d = series[series.length - 1] - series[0];
    const dec = key === "temp" ? 1 : 0;
    const r = Number(d.toFixed(dec));
    return { value: r, text: r === 0 ? null : (r > 0 ? "+" : "") + r.toFixed(dec) };
  }

  /* ── Vue détail (surcouche interne) ───────────────────────────────────── */
  _openDetail() {
    const st = this._state();
    const d = readDetail(st?.attributes?.detail);
    if (!d || !Array.isArray(d.factors)) return;

    const score = Math.min(100, Math.max(0, Math.round(Number(d.score ?? st.state) || 0)));
    const tier = tierOf(score);
    const name = this._config.name || st.attributes.friendly_name || this._config.entity;

    let worstHtml = "";
    if (d.worst) {
      const w = d.factors.find((f) => f.name === d.worst);
      if (w) {
        const wt = tierOf(w.score);
        let msg = `Facteur le plus pénalisant : <strong>${esc(w.name)}</strong> — ` +
                  `${esc(w.value)} ${esc(w.unit)} (${esc(w.label)}).`;
        /* Un levier d'action ne s'affiche que si `capped` confirme qu'un
           plafond réduit vraiment le score (sinon d.worst désigne juste le
           facteur le plus faible, sans piloter le score). `cap_kind`
           distingue aération (ouvrir une fenêtre corrige) de confort
           (chauffage/humidification, aérer n'aide pas). */
        if (d.capped && d.cap_kind === "aeration") {
          msg += " C'est ce facteur qui limite le score : aérer la pièce est le " +
                 "levier le plus direct.";
        } else if (d.capped && d.cap_kind === "confort") {
          msg += " C'est ce facteur qui limite le score, mais aérer n'y changera " +
                 "rien — pensez plutôt au chauffage ou à l'humidification.";
        }
        worstHtml = `<div class="worst">
            <span class="wdot" style="background:${wt.vivid}"></span>
            <span class="wmsg">${msg}</span></div>`;
      }
    }

    /* in_score:false (PM1/PM4/PM10, estimés par le capteur, poids 0) :
       affichés à part et atténués pour ne pas laisser croire qu'ils comptent
       dans le score. */
    const row = (f) => {
      const t = tierOf(f.score);
      return `<div class="frow" data-entity="${esc(f.entity || "")}">
          <div class="fname">${esc(f.name)}</div>
          <div class="fchip"><span style="--cl-bg:${t.light.bg};--cl-fg:${t.light.fg};
               --cd-bg:${t.dark.bg};--cd-fg:${t.dark.fg}">${esc(f.label)}</span></div>
          <div class="fgap"></div>
          <div class="fval">${esc(f.value)} ${esc(f.unit)}</div>
          <div class="ftr" data-for="${esc(f.entity || "")}" data-key="${esc(f.key)}"
               data-unit="${esc(f.unit)}"></div>
        </div>`;
    };
    const counted = d.factors.filter((f) => f.in_score !== false);
    const displayOnly = d.factors.filter((f) => f.in_score === false);
    const rows = counted.map(row).join("") +
      (displayOnly.length
        ? `<div class="fsep">
            <div class="fsep-row">
              <span>Affichés seuls, hors score</span>
              <button type="button" class="fsep-info" aria-expanded="false"
                      aria-label="Pourquoi ces valeurs ne comptent pas">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </button>
            </div>
            <div class="fsep-note" hidden>Ces valeurs ne comptent pas dans le
              score : PM1 est très proche de PM2.5 en air intérieur, et
              PM4/PM10 sont estimés par le capteur à partir des particules
              plus fines plutôt que mesurés directement, avec une marge
              d'erreur nettement plus grande. Seul PM2.5 est pris en compte.</div>
          </div>` +
          displayOnly.map((f) => row(f).replace('class="frow"', 'class="frow off"')).join("")
        : "");

    const ovl = document.createElement("div");
    ovl.className = "iqa-ovl";
    ovl.innerHTML = `
      <style>
        .iqa-ovl { position: fixed; inset: 0; z-index: 3;
                   background: rgba(0,0,0,.45);
                   display: flex; align-items: center; justify-content: center;
                   padding: 16px; overflow-y: auto; }
        .pnl { width: 100%; max-width: 520px; border-radius: 18px; padding: 22px;
               background: var(--ha-card-background, var(--card-background-color, #fff));
               box-shadow: 0 12px 48px rgba(0,0,0,.3);
               font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
               color: var(--primary-text-color, #14171a);
               max-height: calc(100vh - 32px); overflow-y: auto; }
        .hd { display:flex; align-items:center; justify-content:space-between;
              gap:16px; padding-bottom:16px;
              border-bottom:1px solid var(--divider-color,#e4e6e8); }
        .who { display:flex; flex-direction:column; gap:4px; min-width:0; }
        .dn { font-size:19px; font-weight:650; letter-spacing:-.01em; }
        .dr { font-size:12px; color: var(--secondary-text-color,#565c63); }
        .dr strong { color: var(--primary-text-color,#14171a); font-weight:600; }
        .bdg { flex-shrink:0; display:flex; flex-direction:column; align-items:center;
               gap:1px; padding:7px 12px; border-radius:12px; color:#fff; }
        .bdg .n { font-size:23px; font-weight:600; line-height:1;
                  font-variant-numeric:tabular-nums; }
        .bdg .n sup { font-size:11px; font-weight:500; opacity:.8; }
        .bdg .t { font-size:9.5px; font-weight:700; text-transform:uppercase;
                  letter-spacing:.06em; opacity:.92; }
        .worst { display:flex; align-items:center; gap:11px;
                 background: rgba(127,127,127,.07);
                 border:1px solid rgba(127,127,127,.14);
                 border-radius:12px; padding:12px 14px; margin:16px 0 6px; }
        .wdot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .wmsg { font-size:13px; line-height:1.5; color: var(--secondary-text-color,#565c63); }
        .wmsg strong { color: var(--primary-text-color,#14171a); }
        /* Grille portée par la LISTE (.flist), pas par chaque ligne : les
           colonnes se dimensionnent sur leur contenu le plus large et
           restent alignées d'une ligne à l'autre sans largeur fixe. */
        .flist { display:grid; grid-template-columns: auto auto 1fr auto auto;
                 align-items:stretch; }
        .frow { display:contents; }
        .frow > * { display:flex; align-items:center; cursor:pointer; padding:11px 0;
                    border-bottom:1px solid var(--divider-color,#e4e6e8);
                    user-select:none; touch-action:manipulation;
                    -webkit-tap-highlight-color:transparent; }
        .frow:last-child > * { border-bottom:none; }
        .frow:hover > * { background: rgba(127,127,127,.05); }
        /* Facteurs hors score (PM1/PM4/PM10) : même ligne, contenu atténué —
           l'info reste lisible mais se lit clairement en second plan. */
        .frow.off > * { opacity: .6; }
        .frow.off:hover > * { opacity: .8; }
        /* Séparateur pleine largeur : enfant direct de .flist (pas display:contents),
           donc grid-column peut l'étendre sur les 5 colonnes de la grille. */
        .fsep { grid-column: 1 / -1; padding: 13px 0 5px; font-size: 10px;
                font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
                color: var(--secondary-text-color, #8a9096); }
        .fsep-row { display: flex; align-items: center; gap: 6px; }
        .fsep-info { flex-shrink: 0; width: 15px; height: 15px; padding: 0;
                     border: none; background: transparent; color: inherit;
                     opacity: .7; cursor: pointer; display: flex;
                     align-items: center; justify-content: center; }
        .fsep-info svg { width: 100%; height: 100%; }
        .fsep-info:hover { opacity: 1; }
        .fsep-note { margin-top: 6px; font-size: 11.5px; font-weight: 400;
                     font-style: normal; text-transform: none; letter-spacing: normal;
                     line-height: 1.5; color: var(--secondary-text-color, #8a9096); }
        .fname { font-size:13.5px; font-weight:600; white-space:nowrap;
                 padding-right:10px; }
        .fchip { font-size:11px; font-weight:700; white-space:nowrap; }
        /* Couleurs en variables CSS sur le <span> : la pastille suit le
           thème sombre/clair, comme celle de la variante C (jauge). */
        .fchip span { display:inline-block; padding:3px 9px; border-radius:999px;
                      background: var(--cl-bg); color: var(--cl-fg); }
        @media (prefers-color-scheme: dark) {
          .fchip span { background: var(--cd-bg); color: var(--cd-fg); }
        }
        .fval { font-size:13.5px; font-weight:700; white-space:nowrap;
                font-variant-numeric:tabular-nums; justify-content:flex-end;
                color: var(--primary-text-color, #14171a); }
        /* Évolution en gris : la couleur reste réservée au palier. */
        .ftr { font-size:12px; font-weight:600; white-space:nowrap;
               font-variant-numeric:tabular-nums; justify-content:flex-end;
               padding-left:16px; color: var(--secondary-text-color, #8c939b); }

        @media (max-width: 430px) {
          .pnl { padding: 18px 14px; }
          .fname { font-size:13px; padding-right:8px; }
          .fval  { font-size:13px; }
          .fchip { font-size:10.5px; }
          .fchip span { padding:3px 8px; }
          .ftr   { font-size:11px; padding-left:10px; }
        }
        .cl { margin-top:18px; width:100%; padding:11px; border-radius:10px;
              border:1px solid var(--divider-color,#e4e6e8); background:transparent;
              color: var(--primary-text-color,#14171a); font-size:14px;
              font-weight:600; cursor:pointer; }
        .cl:hover { background: rgba(127,127,127,.08); }
        .hint { margin-top:10px; font-size:11.5px; text-align:center;
                color: var(--secondary-text-color,#8a9096); }
      </style>
      <div class="pnl">
        <div class="hd">
          <div class="who">
            <span class="dn">${esc(name)}</span>
            <span class="dr">Type de pièce : <strong>${esc(d.room_label || d.room || "—")}</strong></span>
          </div>
          <div class="bdg" style="background:${tier.light.fg}">
            <div class="n">${score}<sup>/100</sup></div>
            <div class="t">${esc(tier.name)}</div>
          </div>
        </div>
        ${worstHtml}
        <div class="flist">${rows}</div>
        <button class="cl">Fermer</button>
        <div class="hint">Appui long sur une ligne pour son historique</div>
      </div>`;

    const close = () => {
      document.removeEventListener("keydown", onKey);
      ovl.remove();
      this._ovl = null;
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);

    ovl.querySelector(".cl").addEventListener("click", close);
    ovl.addEventListener("click", (e) => { if (e.target === ovl) close(); });

    /* Appui long sur une ligne → historique de CETTE entité.
       La surcouche est masquée, pas détruite : à la fermeture de la fenêtre
       d'historique de Home Assistant, elle réapparaît telle quelle. */
    ovl.querySelectorAll(".frow").forEach((row) => {
      const eid = row.dataset.entity;
      if (!eid) return;
      let timer = null;
      const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
      const start = () => {
        stop();
        timer = setTimeout(() => {
          ovl.style.display = "none";
          const back = () => {
            window.removeEventListener("dialog-closed", back);
            if (document.body.contains(ovl)) ovl.style.display = "flex";
          };
          window.addEventListener("dialog-closed", back);
          this._moreInfo(eid);
        }, 500);
      };
      row.addEventListener("pointerdown", start);
      row.addEventListener("pointerup", stop);
      row.addEventListener("pointercancel", stop);
      row.addEventListener("pointerleave", stop);
      row.addEventListener("contextmenu", (e) => e.preventDefault());
    });

    const infoBtn = ovl.querySelector(".fsep-info");
    if (infoBtn) {
      infoBtn.addEventListener("click", () => {
        const note = ovl.querySelector(".fsep-note");
        const willOpen = note.hidden;
        note.hidden = !willOpen;
        infoBtn.setAttribute("aria-expanded", String(willOpen));
      });
    }

    document.body.appendChild(ovl);
    this._ovl = ovl;

    /* Courbes 24 h — chargées après affichage pour ne pas retarder l'ouverture */
    const ids = [...new Set(d.factors.map((f) => f.entity).filter(Boolean))];
    this._fetchHistory(ids).then((hist) => {
      if (!document.body.contains(ovl)) return;
      ovl.querySelectorAll(".ftr").forEach((slot) => {
        const dd = this._delta(hist[slot.dataset.for], slot.dataset.key);
        if (!dd) return;                       // pas d'historique : case laissée vide
        slot.textContent = dd.text === null
          ? "→ stable"
          : `${dd.value > 0 ? "↗" : "↘"} ${dd.text} ${slot.dataset.unit}`;
      });
    });
  }

  /* ── Styles ───────────────────────────────────────────────────────────── */
  _styles() {
    const st = this._state();
    const d = st ? readDetail(st.attributes.detail) : null;
    const score = d ? Math.min(100, Math.max(0, Math.round(Number(d.score ?? st.state) || 0))) : 0;
    const t = tierOf(score);

    return `<style>
      :host { --iqa-vivid: ${t.vivid};
              --iqa-fg: ${t.light.fg}; --iqa-chip-bg: ${t.light.bg}; }
      @media (prefers-color-scheme: dark) {
        :host { --iqa-fg: ${t.dark.fg}; --iqa-chip-bg: ${t.dark.bg}; }
      }
      ha-card { overflow: hidden; }

      /* ── base compacte, 72 px ─────────────────────────────────────────── */
      .compact {
        /* La réserve basse (14px) correspond à la jauge : le contenu est ainsi
           centré dans l'espace qui reste au-dessus, et non dans toute la carte. */
        box-sizing: border-box; height: 72px; padding: 0 16px 14px;
        display: flex; align-items: center; gap: 10px;
        position: relative; cursor: pointer; user-select: none;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .compact.no-gauge { padding-bottom: 0; }
      .nm { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 500;
            color: var(--primary-text-color, #14171a); opacity: .75;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tr { font-size: 11px; font-weight: 700; text-transform: uppercase;
            letter-spacing: .08em; white-space: nowrap; color: var(--iqa-fg); }
      .sc { font-size: 30px; font-weight: 300; letter-spacing: -.03em; line-height: 1;
            font-variant-numeric: tabular-nums; color: var(--primary-text-color, #14171a); }
      .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
             background: var(--iqa-vivid); }
      /* Même typographie que .tr : seul le fond en pastille distingue la
         variante C (jauge), pas le texte. */
      .chip { font-size: 11px; font-weight: 700; text-transform: uppercase;
              letter-spacing: .08em; padding: 3px 9px 3px 10px; border-radius: 999px;
              white-space: nowrap; background: var(--iqa-chip-bg); color: var(--iqa-fg); }

      /* jauge unicolore (variante C) */
      .b-line { position: absolute; left: 16px; right: 16px; bottom: 11px; height: 3px;
                border-radius: 2px; background: rgba(127,127,127,.18); }
      .b-line i { position: absolute; left: 0; height: 3px; border-radius: 2px;
                  background: var(--iqa-vivid); }

      /* échelle IQA (variante B) */
      .s-row { position: absolute; left: 16px; right: 16px; bottom: 10px; }
      .s-track { position: relative; width: 100%; height: 4px; }
      .s-grad { height: 4px; border-radius: 2px; background: ${IQA_GRADIENT}; }
      .s-tick { position: absolute; top: -3.5px; width: 2.5px; height: 11px;
                margin-left: -1.25px; border-radius: 2px;
                background: var(--primary-text-color, #14171a);
                box-shadow: 0 0 0 2px var(--ha-card-background, var(--card-background-color, #fff)); }
      /* Centrées entre le texte et la barre pour ne chevaucher ni l'un ni
         l'autre. */
      .s-end { position: absolute; bottom: 6px; font-size: 10px; font-weight: 600;
               line-height: 1; white-space: nowrap;
               color: var(--primary-text-color, #14171a); opacity: .5; }
      .s-end.s-l { left: 0; }
      .s-end.s-r { right: 0; }

      /* ── fond dégradé (variante A) ───────────────────────────────────────
         Texte foncé, pas blanc : sur un fond saturé, un texte blanc a besoin
         d'un voile noir pour rester lisible, ce qui délave les couleurs
         (vert/jaune virent au kaki). Texte foncé direct = fond qui garde
         toute sa saturation, contraste jamais sous 4,5:1 aux deux coins. */
      .grad-bg .nm { color: #14171a; opacity: .8; }
      .grad-bg .tr { color: #14171a; opacity: .85; }
      .grad-bg .sc { color: #14171a; }
      .a-line { position: absolute; left: 16px; right: 16px; bottom: 11px; height: 3px;
                border-radius: 2px; background: rgba(0,0,0,.16); }
      .a-line i { position: absolute; left: 0; height: 3px; border-radius: 2px;
                  background: rgba(0,0,0,.62); }

      /* ── messages ─────────────────────────────────────────────────────── */
      .msg { padding: 20px; font-size: 14px; line-height: 1.55;
             color: var(--primary-text-color); }
      .msg p { margin: 10px 0; color: var(--secondary-text-color); }
      .msg pre { background: rgba(127,127,127,.1); padding: 12px;
                 border-radius: 8px; font-size: 12px; overflow-x: auto; }
      .msg code { background: rgba(127,127,127,.15); padding: 1px 5px; border-radius: 4px; }
    </style>`;
  }
}

customElements.define("iqa-card", IqaCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "iqa-card",
  name: "IQA — Qualité de l'air",
  description: "Score de qualité de l'air, quatre présentations, vue détail au clic.",
  preview: true,
  documentationURL: "https://github.com/REMPLACE_MOI/iqa-card",
});

console.info(
  `%c IQA-CARD %c v${VERSION} `,
  "color:#fff;background:#2f7a3d;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#2f7a3d;background:#e8f3ea;border-radius:0 3px 3px 0;padding:2px 4px"
);
