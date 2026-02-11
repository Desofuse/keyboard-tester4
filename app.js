/* ====== state ====== */
const state = {
  theme: "night",       // night | day
  lang: "ru",           // en | ru
  platform: "win",      // win | mac

  // ON by default: удобнее тестировать
  capture: true,
  mode: "live",         // live | latch

  // layouts: 100%/80%/75%/65%/60%
  layout: "full",       // full | tkl | 75 | 65 | 60

  // visual mode
  fpsMode: false,

  pressed: new Set(),
  latched: new Set(),
  maxDown: 0,
  maxDownCodes: [],

  session: {
    startedAt: Date.now(),
    startedPerf: performance.now(),
    totalDown: 0,
    totalUp: 0,
    totalPresses: 0,      // non-repeat keydowns
    totalRepeats: 0,      // repeat keydowns
    uniqueCodes: new Set(),
    perCode: new Map(),   // code -> {down,up,repeats,totalHoldMs,lastDownPerf}
    events: []            // last ~200 events
  },

  ghost: {
    open: false,
    running: false,
    step: 0,
    combos: [],
    results: [],          // {combo, ok, ms}
    stepStartPerf: 0,
    holdStartedPerf: 0,
    holdMs: 450,
    stepTimeoutMs: 7000,
    timeoutHandle: null
  },

  gaming: {
    open: false,
    repeatKey: null,      // code being measured
    repeatCount: 0,
    repeatFirstPerf: 0,
    repeatLastPerf: 0
  },

  fps: {
    value: 0,
    lastPerf: 0,
    frames: 0
  }
};

/* ====== i18n ====== */
const I18N = {
  en: {
    captureOn: "Capture: ON",
    captureOff: "Capture: OFF",
    modeLive: "Mode: Live",
    modeLatch: "Mode: Latch",
    themeNight: "Theme: Night",
    themeDay: "Theme: Day",
    windows: "Windows",
    mac: "Mac",
    help: "Help",
    howTo: "How to use",
    ok: "OK",
    live: "Live",
    hint: "Click here and press any key",

    layoutBtn: (pct) => `Layout: ${pct}`,
    fpsOn: "FPS mode: ON",
    fpsOff: "FPS mode: OFF",
    ghostBtn: "Ghosting",
    gamingBtn: "Gaming test",
    statsBtn: "Stats",
    pdfBtn: "Download report (PDF)",

    titleStats: "Session statistics",
    titleGhost: "Ghosting check",
    titleGaming: "Gaming keyboard test",

    helpBody: `
      <ul>
        <li><b>Live</b> — highlights only while you hold the key.</li>
        <li><b>Latch</b> — toggles keys on/off and keeps them highlighted until <b>Clear</b>.</li>
        <li><b>Capture</b> — blocks browser hotkeys/scroll (Ctrl/⌘ combos, Space, arrows, etc.).</li>
        <li>Highlighting uses <b>event.code</b> (physical key position).</li>
        <li>If it doesn’t catch input — click empty space to refocus.</li>
        <li><b>Esc</b> closes this window.</li>
      </ul>
    `,

    ghostBody: `
      <div class="muted">
        This test asks you to <b>hold specific key combos</b>. If your keyboard can’t register a combo, the step will fail —
        that’s a practical way to detect ghosting / limited rollover.
      </div>

      <div class="actionRow">
        <button class="pill" type="button" data-action="ghostStart">Start</button>
        <button class="pill" type="button" data-action="ghostStop">Stop</button>
        <button class="pill" type="button" data-action="ghostReset">Reset</button>
      </div>

      <div class="sectionTitle">Step</div>
      <div id="ghostStep" class="mono">—</div>
      <div id="ghostHint" class="muted" style="margin-top:6px;">Hold the combo until it turns green.</div>

      <div class="sectionTitle">Results</div>
      <div id="ghostSummary" class="mono muted">—</div>
      <div id="ghostList" class="mono" style="margin-top:8px; white-space:pre-wrap;"></div>
    `,

    gamingBody: `
      <div class="muted">
        Quick checks for <b>rollover (simultaneous keys)</b> and <b>repeat rate</b>.
      </div>

      <div class="sectionTitle">Rollover (NKRO)</div>
      <div class="mono">Current down: <span id="gDown">0</span> · Max down: <span id="gMax">0</span></div>
      <div class="mono muted" style="margin-top:6px;">Keys at max: <span id="gMaxKeys">—</span></div>

      <div class="sectionTitle">Repeat rate</div>
      <div class="muted">Hold any key to see repeats/sec. (Some keys don’t repeat by design.)</div>
      <div class="mono" style="margin-top:6px;">Key: <span id="gRepKey">—</span> · Repeats: <span id="gRepCount">0</span> · rps: <span id="gRps">0</span></div>

      <div class="actionRow">
        <button class="pill" type="button" data-action="gamingReset">Reset max/repeat</button>
      </div>
    `,

    statsBody: `
      <div class="muted">All numbers are for the current page session.</div>

      <div class="sectionTitle">Overview</div>
      <table class="miniTable">
        <tr><th>Session time</th><td id="sTime">—</td></tr>
        <tr><th>Total presses</th><td id="sPress">—</td></tr>
        <tr><th>Total repeats</th><td id="sRepeats">—</td></tr>
        <tr><th>Unique keys</th><td id="sUnique">—</td></tr>
        <tr><th>Max simultaneous</th><td id="sMaxDown">—</td></tr>
      </table>

      <div class="sectionTitle">Top keys</div>
      <div id="sTop" class="mono" style="white-space:pre-wrap;">—</div>
    `
  },

  ru: {
    captureOn: "Захват: ВКЛ",
    captureOff: "Захват: ВЫКЛ",
    modeLive: "Режим: Live",
    modeLatch: "Режим: Latch",
    themeNight: "Тема: Ночь",
    themeDay: "Тема: День",
    windows: "Windows",
    mac: "Mac",
    help: "Помощь",
    howTo: "Как пользоваться",
    ok: "OK",
    live: "Live",
    hint: "Кликни сюда и нажми любую клавишу",

    layoutBtn: (pct) => `Клавиатура: ${pct}`,
    fpsOn: "FPS режим: ВКЛ",
    fpsOff: "FPS режим: ВЫКЛ",
    ghostBtn: "Ghosting",
    gamingBtn: "Gaming test",
    statsBtn: "Статистика",
    pdfBtn: "Скачать отчёт (PDF)",

    titleStats: "Статистика за сессию",
    titleGhost: "Проверка ghosting",
    titleGaming: "Gaming keyboard test",

    helpBody: `
      <ul>
        <li><b>Live</b> — подсвечивает только пока клавиша зажата.</li>
        <li><b>Latch</b> — запоминает подсветку и держит её до <b>Clear</b> (или повторного нажатия).</li>
        <li><b>Capture</b> — глушит хоткеи/скролл (Ctrl/⌘ + комбинации, Space, стрелки и т.п.).</li>
        <li>Подсветка завязана на <b>event.code</b> — это “физическая” клавиша.</li>
        <li>Если “не ловит” — кликни по пустому месту страницы, чтобы вернуть фокус.</li>
        <li><b>Esc</b> закрывает это окно.</li>
      </ul>
    `,

    ghostBody: `
      <div class="muted">
        Тест попросит <b>зажимать конкретные комбинации</b>. Если клавиатура не может зарегистрировать комбо,
        шаг провалится — это практичная проверка ghosting/rollover.
      </div>

      <div class="actionRow">
        <button class="pill" type="button" data-action="ghostStart">Старт</button>
        <button class="pill" type="button" data-action="ghostStop">Стоп</button>
        <button class="pill" type="button" data-action="ghostReset">Сброс</button>
      </div>

      <div class="sectionTitle">Шаг</div>
      <div id="ghostStep" class="mono">—</div>
      <div id="ghostHint" class="muted" style="margin-top:6px;">Зажми комбинацию и подержи, пока она не станет зелёной.</div>

      <div class="sectionTitle">Результаты</div>
      <div id="ghostSummary" class="mono muted">—</div>
      <div id="ghostList" class="mono" style="margin-top:8px; white-space:pre-wrap;"></div>
    `,

    gamingBody: `
      <div class="muted">
        Быстрые проверки: <b>rollover (сколько клавиш одновременно)</b> и <b>repeat rate</b>.
      </div>

      <div class="sectionTitle">Rollover (NKRO)</div>
      <div class="mono">Сейчас зажато: <span id="gDown">0</span> · Макс: <span id="gMax">0</span></div>
      <div class="mono muted" style="margin-top:6px;">Клавиши на максимуме: <span id="gMaxKeys">—</span></div>

      <div class="sectionTitle">Repeat rate</div>
      <div class="muted">Удерживай любую клавишу — покажу repeats/sec. (Не все клавиши повторяются.)</div>
      <div class="mono" style="margin-top:6px;">Клавиша: <span id="gRepKey">—</span> · Repeats: <span id="gRepCount">0</span> · rps: <span id="gRps">0</span></div>

      <div class="actionRow">
        <button class="pill" type="button" data-action="gamingReset">Сбросить макс/повторы</button>
      </div>
    `,

    statsBody: `
      <div class="muted">Все числа — только за текущую сессию страницы.</div>

      <div class="sectionTitle">Общее</div>
      <table class="miniTable">
        <tr><th>Время сессии</th><td id="sTime">—</td></tr>
        <tr><th>Нажатия</th><td id="sPress">—</td></tr>
        <tr><th>Повторы</th><td id="sRepeats">—</td></tr>
        <tr><th>Уникальные клавиши</th><td id="sUnique">—</td></tr>
        <tr><th>Макс одновременно</th><td id="sMaxDown">—</td></tr>
      </table>

      <div class="sectionTitle">Топ клавиш</div>
      <div id="sTop" class="mono" style="white-space:pre-wrap;">—</div>
    `
  }
};

function t(key){
  const v = (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key;
  return v;
}

/* ====== RU letters mapping (ЙЦУКЕН) ====== */
const RU = {
  KeyQ:"Й", KeyW:"Ц", KeyE:"У", KeyR:"К", KeyT:"Е", KeyY:"Н", KeyU:"Г", KeyI:"Ш", KeyO:"Щ", KeyP:"З",
  BracketLeft:"Х", BracketRight:"Ъ",
  KeyA:"Ф", KeyS:"Ы", KeyD:"В", KeyF:"А", KeyG:"П", KeyH:"Р", KeyJ:"О", KeyK:"Л", KeyL:"Д",
  Semicolon:"Ж", Quote:"Э",
  KeyZ:"Я", KeyX:"Ч", KeyC:"С", KeyV:"М", KeyB:"И", KeyN:"Т", KeyM:"Ь",
  Comma:"Б", Period:"Ю"
};

/* ====== label resolver ====== */
function labelFor(code){
  // letters
  if (code.startsWith("Key")){
    return state.lang === "ru" ? (RU[code] || code.replace("Key","")) : code.replace("Key","");
  }

  // digits / top row
  if (code.startsWith("Digit")) return code.replace("Digit","");
  if (code === "Backquote") return "`";
  if (code === "Minus") return "-";
  if (code === "Equal") return "=";

  // punctuation
  const punct = {
    BracketLeft: "[", BracketRight: "]", Backslash: "\\",
    Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/"
  };
  if (punct[code]) return (state.lang === "ru" ? (RU[code] || punct[code]) : punct[code]);

  // numpad
  const numpad = {
    NumLock: "Num",
    NumpadDivide: "/",
    NumpadMultiply: "*",
    NumpadSubtract: "-",
    NumpadAdd: "+",
    NumpadDecimal: ".",
    NumpadEnter: "Enter",
    Numpad0: "0", Numpad1:"1", Numpad2:"2", Numpad3:"3", Numpad4:"4",
    Numpad5:"5", Numpad6:"6", Numpad7:"7", Numpad8:"8", Numpad9:"9"
  };
  if (numpad[code]) return numpad[code];

  // specials
  const isMac = state.platform === "mac";
  const special = {
    Escape: "Esc",
    Tab: "Tab",
    CapsLock: "Caps",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    ControlLeft: "Ctrl",
    ControlRight: "Ctrl",
    AltLeft: isMac ? "Option" : "Alt",
    AltRight: isMac ? "Option" : "Alt",
    MetaLeft: isMac ? "⌘" : "Win",
    MetaRight: isMac ? "⌘" : "Win",
    ContextMenu: "Menu",
    Enter: "Enter",
    Backspace: "Backspace",
    Space: "Space",
    Insert: "Ins",
    Delete: "Del",
    Home: "Home",
    End: "End",
    PageUp: "PgUp",
    PageDown: "PgDn",
    ArrowUp: "▲",
    ArrowDown: "▼",
    ArrowLeft: "◀",
    ArrowRight: "▶",
    PrintScreen: "Prt",
    ScrollLock: "Scr",
    Pause: "Pause"
  };
  if (special[code]) return special[code];

  // function keys
  if (/^F\d+$/.test(code)) return code;

  return code;
}

function sizeClass(label){
  if (label.length >= 9) return "small";
  if (label.length >= 5) return "med";
  return "big";
}

/* ====== layout (grid placements) ====== */
const COL_UNIT = 4;
function u(n){ return Math.round(n * COL_UNIT); }

function addRow(layout, rowIndex, items){
  let col = 1;
  for (const it of items){
    const wCols = u(it.w);
    if (it.gap || it.spacer){
      col += wCols;
      continue;
    }
    layout.push({
      code: it.code,
      row: rowIndex,
      col,
      colSpan: wCols,
      rowSpan: it.rowSpan ? it.rowSpan : 1
    });
    col += wCols;
  }
}

function buildLayout(name){
  const L = [];

  // ===== 100% (full) =====
  if (name === "full"){
    addRow(L, 1, [
      {code:"Escape", w:1.5},{gap:true,w:0.5},
      {code:"F1",w:1},{code:"F2",w:1},{code:"F3",w:1},{code:"F4",w:1},{gap:true,w:0.5},
      {code:"F5",w:1},{code:"F6",w:1},{code:"F7",w:1},{code:"F8",w:1},{gap:true,w:0.5},
      {code:"F9",w:1},{code:"F10",w:1},{code:"F11",w:1},{code:"F12",w:1},{gap:true,w:0.5},
      {code:"PrintScreen",w:1},{code:"ScrollLock",w:1},{code:"Pause",w:1}
    ]);

    addRow(L, 2, [
      {code:"Backquote",w:1},
      {code:"Digit1",w:1},{code:"Digit2",w:1},{code:"Digit3",w:1},{code:"Digit4",w:1},{code:"Digit5",w:1},
      {code:"Digit6",w:1},{code:"Digit7",w:1},{code:"Digit8",w:1},{code:"Digit9",w:1},{code:"Digit0",w:1},
      {code:"Minus",w:1},{code:"Equal",w:1},{code:"Backspace",w:2},
      {gap:true,w:0.5},
      {code:"Insert",w:1},{code:"Home",w:1},{code:"PageUp",w:1},
      {gap:true,w:0.5},
      {code:"NumLock",w:1},{code:"NumpadDivide",w:1},{code:"NumpadMultiply",w:1},{code:"NumpadSubtract",w:1}
    ]);

    addRow(L, 3, [
      {code:"Tab",w:1.5},
      {code:"KeyQ",w:1},{code:"KeyW",w:1},{code:"KeyE",w:1},{code:"KeyR",w:1},{code:"KeyT",w:1},
      {code:"KeyY",w:1},{code:"KeyU",w:1},{code:"KeyI",w:1},{code:"KeyO",w:1},{code:"KeyP",w:1},
      {code:"BracketLeft",w:1},{code:"BracketRight",w:1},{code:"Backslash",w:1.5},
      {gap:true,w:0.5},
      {code:"Delete",w:1},{code:"End",w:1},{code:"PageDown",w:1},
      {gap:true,w:0.5},
      {code:"Numpad7",w:1},{code:"Numpad8",w:1},{code:"Numpad9",w:1},
      {code:"NumpadAdd",w:1, rowSpan:2}
    ]);

    addRow(L, 4, [
      {code:"CapsLock",w:1.75},
      {code:"KeyA",w:1},{code:"KeyS",w:1},{code:"KeyD",w:1},{code:"KeyF",w:1},{code:"KeyG",w:1},
      {code:"KeyH",w:1},{code:"KeyJ",w:1},{code:"KeyK",w:1},{code:"KeyL",w:1},
      {code:"Semicolon",w:1},{code:"Quote",w:1},
      {code:"Enter",w:2.25},
      {gap:true,w:0.5},
      {spacer:true,w:3},
      {gap:true,w:0.5},
      {code:"Numpad4",w:1},{code:"Numpad5",w:1},{code:"Numpad6",w:1}
    ]);

    addRow(L, 5, [
      {code:"ShiftLeft",w:2.25},
      {code:"KeyZ",w:1},{code:"KeyX",w:1},{code:"KeyC",w:1},{code:"KeyV",w:1},{code:"KeyB",w:1},{code:"KeyN",w:1},{code:"KeyM",w:1},
      {code:"Comma",w:1},{code:"Period",w:1},{code:"Slash",w:1},
      {code:"ShiftRight",w:2.75},
      {gap:true,w:0.5},
      {spacer:true,w:1},{code:"ArrowUp",w:1},{spacer:true,w:1},
      {gap:true,w:0.5},
      {code:"Numpad1",w:1},{code:"Numpad2",w:1},{code:"Numpad3",w:1},
      {code:"NumpadEnter",w:1, rowSpan:2}
    ]);

    addRow(L, 6, [
      {code:"ControlLeft",w:1.25},{code:"MetaLeft",w:1.25},{code:"AltLeft",w:1.25},
      {code:"Space",w:6.25},
      {code:"AltRight",w:1.25},{code:"MetaRight",w:1.25},{code:"ContextMenu",w:1.25},{code:"ControlRight",w:1.25},
      {gap:true,w:0.5},
      {code:"ArrowLeft",w:1},{code:"ArrowDown",w:1},{code:"ArrowRight",w:1},
      {gap:true,w:0.5},
      {code:"Numpad0",w:2},{code:"NumpadDecimal",w:1}
    ]);

    return L;
  }

  // ===== 80% (TKL) =====
  if (name === "tkl"){
    addRow(L, 1, [
      {code:"Escape", w:1.5},{gap:true,w:0.5},
      {code:"F1",w:1},{code:"F2",w:1},{code:"F3",w:1},{code:"F4",w:1},{gap:true,w:0.5},
      {code:"F5",w:1},{code:"F6",w:1},{code:"F7",w:1},{code:"F8",w:1},{gap:true,w:0.5},
      {code:"F9",w:1},{code:"F10",w:1},{code:"F11",w:1},{code:"F12",w:1},{gap:true,w:0.5},
      {code:"PrintScreen",w:1},{code:"ScrollLock",w:1},{code:"Pause",w:1}
    ]);

    addRow(L, 2, [
      {code:"Backquote",w:1},
      {code:"Digit1",w:1},{code:"Digit2",w:1},{code:"Digit3",w:1},{code:"Digit4",w:1},{code:"Digit5",w:1},
      {code:"Digit6",w:1},{code:"Digit7",w:1},{code:"Digit8",w:1},{code:"Digit9",w:1},{code:"Digit0",w:1},
      {code:"Minus",w:1},{code:"Equal",w:1},{code:"Backspace",w:2},
      {gap:true,w:0.5},
      {code:"Insert",w:1},{code:"Home",w:1},{code:"PageUp",w:1}
    ]);

    addRow(L, 3, [
      {code:"Tab",w:1.5},
      {code:"KeyQ",w:1},{code:"KeyW",w:1},{code:"KeyE",w:1},{code:"KeyR",w:1},{code:"KeyT",w:1},
      {code:"KeyY",w:1},{code:"KeyU",w:1},{code:"KeyI",w:1},{code:"KeyO",w:1},{code:"KeyP",w:1},
      {code:"BracketLeft",w:1},{code:"BracketRight",w:1},{code:"Backslash",w:1.5},
      {gap:true,w:0.5},
      {code:"Delete",w:1},{code:"End",w:1},{code:"PageDown",w:1}
    ]);

    addRow(L, 4, [
      {code:"CapsLock",w:1.75},
      {code:"KeyA",w:1},{code:"KeyS",w:1},{code:"KeyD",w:1},{code:"KeyF",w:1},{code:"KeyG",w:1},
      {code:"KeyH",w:1},{code:"KeyJ",w:1},{code:"KeyK",w:1},{code:"KeyL",w:1},
      {code:"Semicolon",w:1},{code:"Quote",w:1},
      {code:"Enter",w:2.25},
      {gap:true,w:0.5},
      {spacer:true,w:3}
    ]);

    addRow(L, 5, [
      {code:"ShiftLeft",w:2.25},
      {code:"KeyZ",w:1},{code:"KeyX",w:1},{code:"KeyC",w:1},{code:"KeyV",w:1},{code:"KeyB",w:1},{code:"KeyN",w:1},{code:"KeyM",w:1},
      {code:"Comma",w:1},{code:"Period",w:1},{code:"Slash",w:1},
      {code:"ShiftRight",w:2.75},
      {gap:true,w:0.5},
      {spacer:true,w:1},{code:"ArrowUp",w:1},{spacer:true,w:1}
    ]);

    addRow(L, 6, [
      {code:"ControlLeft",w:1.25},{code:"MetaLeft",w:1.25},{code:"AltLeft",w:1.25},
      {code:"Space",w:6.25},
      {code:"AltRight",w:1.25},{code:"MetaRight",w:1.25},{code:"ContextMenu",w:1.25},{code:"ControlRight",w:1.25},
      {gap:true,w:0.5},
      {code:"ArrowLeft",w:1},{code:"ArrowDown",w:1},{code:"ArrowRight",w:1}
    ]);

    return L;
  }

  // ===== 75% =====
  if (name === "75"){
    addRow(L, 1, [
      {code:"Escape", w:1.5},{gap:true,w:0.5},
      {code:"F1",w:1},{code:"F2",w:1},{code:"F3",w:1},{code:"F4",w:1},{gap:true,w:0.5},
      {code:"F5",w:1},{code:"F6",w:1},{code:"F7",w:1},{code:"F8",w:1},{gap:true,w:0.5},
      {code:"F9",w:1},{code:"F10",w:1},{code:"F11",w:1},{code:"F12",w:1},
      {gap:true,w:0.5},
      {code:"Delete",w:1}
    ]);

    addRow(L, 2, [
      {code:"Backquote",w:1},
      {code:"Digit1",w:1},{code:"Digit2",w:1},{code:"Digit3",w:1},{code:"Digit4",w:1},{code:"Digit5",w:1},
      {code:"Digit6",w:1},{code:"Digit7",w:1},{code:"Digit8",w:1},{code:"Digit9",w:1},{code:"Digit0",w:1},
      {code:"Minus",w:1},{code:"Equal",w:1},{code:"Backspace",w:2},
      {gap:true,w:0.5},
      {code:"PageUp",w:1}
    ]);

    addRow(L, 3, [
      {code:"Tab",w:1.5},
      {code:"KeyQ",w:1},{code:"KeyW",w:1},{code:"KeyE",w:1},{code:"KeyR",w:1},{code:"KeyT",w:1},
      {code:"KeyY",w:1},{code:"KeyU",w:1},{code:"KeyI",w:1},{code:"KeyO",w:1},{code:"KeyP",w:1},
      {code:"BracketLeft",w:1},{code:"BracketRight",w:1},{code:"Backslash",w:1.5},
      {gap:true,w:0.5},
      {code:"PageDown",w:1}
    ]);

    addRow(L, 4, [
      {code:"CapsLock",w:1.75},
      {code:"KeyA",w:1},{code:"KeyS",w:1},{code:"KeyD",w:1},{code:"KeyF",w:1},{code:"KeyG",w:1},
      {code:"KeyH",w:1},{code:"KeyJ",w:1},{code:"KeyK",w:1},{code:"KeyL",w:1},
      {code:"Semicolon",w:1},{code:"Quote",w:1},
      {code:"Enter",w:2.25},
      {gap:true,w:0.5},
      {code:"Home",w:1}
    ]);

    addRow(L, 5, [
      {code:"ShiftLeft",w:2.25},
      {code:"KeyZ",w:1},{code:"KeyX",w:1},{code:"KeyC",w:1},{code:"KeyV",w:1},{code:"KeyB",w:1},{code:"KeyN",w:1},{code:"KeyM",w:1},
      {code:"Comma",w:1},{code:"Period",w:1},{code:"Slash",w:1},
      {code:"ShiftRight",w:2.75},
      {gap:true,w:0.5},
      {code:"ArrowUp",w:1}
    ]);

    addRow(L, 6, [
      {code:"ControlLeft",w:1.25},{code:"MetaLeft",w:1.25},{code:"AltLeft",w:1.25},
      {code:"Space",w:6.25},
      {code:"AltRight",w:1.25},{code:"MetaRight",w:1.25},{code:"ContextMenu",w:1.25},{code:"ControlRight",w:1.25},
      {gap:true,w:0.5},
      {code:"ArrowLeft",w:1},{code:"ArrowDown",w:1},{code:"ArrowRight",w:1}
    ]);

    return L;
  }

  // ===== 65% (no F-row) =====
  if (name === "65"){
    // 5 rows: numbers start at row 1
    addRow(L, 1, [
      {code:"Backquote",w:1},
      {code:"Digit1",w:1},{code:"Digit2",w:1},{code:"Digit3",w:1},{code:"Digit4",w:1},{code:"Digit5",w:1},
      {code:"Digit6",w:1},{code:"Digit7",w:1},{code:"Digit8",w:1},{code:"Digit9",w:1},{code:"Digit0",w:1},
      {code:"Minus",w:1},{code:"Equal",w:1},{code:"Backspace",w:2},
      {gap:true,w:0.5},
      {code:"Delete",w:1}
    ]);

    addRow(L, 2, [
      {code:"Tab",w:1.5},
      {code:"KeyQ",w:1},{code:"KeyW",w:1},{code:"KeyE",w:1},{code:"KeyR",w:1},{code:"KeyT",w:1},
      {code:"KeyY",w:1},{code:"KeyU",w:1},{code:"KeyI",w:1},{code:"KeyO",w:1},{code:"KeyP",w:1},
      {code:"BracketLeft",w:1},{code:"BracketRight",w:1},{code:"Backslash",w:1.5},
      {gap:true,w:0.5},
      {code:"PageUp",w:1}
    ]);

    addRow(L, 3, [
      {code:"CapsLock",w:1.75},
      {code:"KeyA",w:1},{code:"KeyS",w:1},{code:"KeyD",w:1},{code:"KeyF",w:1},{code:"KeyG",w:1},
      {code:"KeyH",w:1},{code:"KeyJ",w:1},{code:"KeyK",w:1},{code:"KeyL",w:1},
      {code:"Semicolon",w:1},{code:"Quote",w:1},
      {code:"Enter",w:2.25},
      {gap:true,w:0.5},
      {code:"PageDown",w:1}
    ]);

    addRow(L, 4, [
      {code:"ShiftLeft",w:2.25},
      {code:"KeyZ",w:1},{code:"KeyX",w:1},{code:"KeyC",w:1},{code:"KeyV",w:1},{code:"KeyB",w:1},{code:"KeyN",w:1},{code:"KeyM",w:1},
      {code:"Comma",w:1},{code:"Period",w:1},{code:"Slash",w:1},
      {code:"ShiftRight",w:2.75},
      {gap:true,w:0.5},
      {code:"ArrowUp",w:1}
    ]);

    addRow(L, 5, [
      {code:"ControlLeft",w:1.25},{code:"MetaLeft",w:1.25},{code:"AltLeft",w:1.25},
      {code:"Space",w:6.25},
      {code:"AltRight",w:1.25},{code:"MetaRight",w:1.25},{code:"ContextMenu",w:1.25},{code:"ControlRight",w:1.25},
      {gap:true,w:0.5},
      {code:"ArrowLeft",w:1},{code:"ArrowDown",w:1},{code:"ArrowRight",w:1}
    ]);

    // add ArrowUp above arrows if possible (compact): place it on row 4 right side
    // (visual approximation; still aligned)
    L.push({ code:"ArrowUp", row:4, col: u(15.5)+1, colSpan: u(1), rowSpan:1 });

    return L;
  }

  // ===== 60% (no F-row, no arrows/nav) =====
  if (name === "60"){
    addRow(L, 1, [
      {code:"Backquote",w:1},
      {code:"Digit1",w:1},{code:"Digit2",w:1},{code:"Digit3",w:1},{code:"Digit4",w:1},{code:"Digit5",w:1},
      {code:"Digit6",w:1},{code:"Digit7",w:1},{code:"Digit8",w:1},{code:"Digit9",w:1},{code:"Digit0",w:1},
      {code:"Minus",w:1},{code:"Equal",w:1},{code:"Backspace",w:2}
    ]);

    addRow(L, 2, [
      {code:"Tab",w:1.5},
      {code:"KeyQ",w:1},{code:"KeyW",w:1},{code:"KeyE",w:1},{code:"KeyR",w:1},{code:"KeyT",w:1},
      {code:"KeyY",w:1},{code:"KeyU",w:1},{code:"KeyI",w:1},{code:"KeyO",w:1},{code:"KeyP",w:1},
      {code:"BracketLeft",w:1},{code:"BracketRight",w:1},{code:"Backslash",w:1.5}
    ]);

    addRow(L, 3, [
      {code:"CapsLock",w:1.75},
      {code:"KeyA",w:1},{code:"KeyS",w:1},{code:"KeyD",w:1},{code:"KeyF",w:1},{code:"KeyG",w:1},
      {code:"KeyH",w:1},{code:"KeyJ",w:1},{code:"KeyK",w:1},{code:"KeyL",w:1},
      {code:"Semicolon",w:1},{code:"Quote",w:1},
      {code:"Enter",w:2.25}
    ]);

    addRow(L, 4, [
      {code:"ShiftLeft",w:2.25},
      {code:"KeyZ",w:1},{code:"KeyX",w:1},{code:"KeyC",w:1},{code:"KeyV",w:1},{code:"KeyB",w:1},{code:"KeyN",w:1},{code:"KeyM",w:1},
      {code:"Comma",w:1},{code:"Period",w:1},{code:"Slash",w:1},
      {code:"ShiftRight",w:2.75}
    ]);

    addRow(L, 5, [
      {code:"ControlLeft",w:1.25},{code:"MetaLeft",w:1.25},{code:"AltLeft",w:1.25},
      {code:"Space",w:6.25},
      {code:"AltRight",w:1.25},{code:"MetaRight",w:1.25},{code:"ContextMenu",w:1.25},{code:"ControlRight",w:1.25}
    ]);

    return L;
  }

  // fallback
  return buildLayout("full");
}

function layoutMeta(layout){
  let cols = 0, rows = 0;
  for (const k of layout){
    cols = Math.max(cols, k.col + k.colSpan - 1);
    rows = Math.max(rows, k.row + k.rowSpan - 1);
  }
  return { cols, rows };
}

function layoutLabel(){
  switch (state.layout){
    case "tkl": return "80%";
    case "75": return "75%";
    case "65": return "65%";
    case "60": return "60%";
    default: return "100%";
  }
}

/* ====== FPS keys ====== */
const FPS_KEYS = new Set([
  "KeyW","KeyA","KeyS","KeyD",
  "Space","ShiftLeft","ShiftRight",
  "ControlLeft","ControlRight",
  "AltLeft","AltRight",
  "KeyQ","KeyE","KeyR","KeyF","KeyG","KeyX","KeyC","KeyV","KeyB",
  "Digit1","Digit2","Digit3","Digit4","Digit5","Digit6",
  "Tab","Escape","CapsLock",
  "ArrowUp","ArrowDown","ArrowLeft","ArrowRight"
]);

/* ====== DOM refs ====== */
const $ = (s) => document.querySelector(s);

const els = {
  app: $("#app"),
  stage: $("#stage"),
  keyboard: $("#keyboard"),

  btnLive: $("#btnLive"),
  liveLabel: $("#liveLabel"),

  btnCapture: $("#btnCapture"),
  btnMode: $("#btnMode"),
  btnClear: $("#btnClear"),

  btnLayout: $("#btnLayout"),
  btnFps: $("#btnFps"),
  btnGhost: $("#btnGhost"),
  btnGaming: $("#btnGaming"),
  btnStats: $("#btnStats"),
  btnPdf: $("#btnPdf"),

  btnLang: $("#btnLang"),
  btnPlatform: $("#btnPlatform"),
  btnTheme: $("#btnTheme"),
  btnFullscreen: $("#btnFullscreen"),
  btnHelp: $("#btnHelp"),

  hudKey: $("#hudKey"),
  hudHint: $("#hudHint"),
  hudEventKey: $("#hudEventKey"),
  hudEventCode: $("#hudEventCode"),
  hudKeyCode: $("#hudKeyCode"),
  hudRepeat: $("#hudRepeat"),
  hudDown: $("#hudDown"),
  hudMax: $("#hudMax"),
  hudLatched: $("#hudLatched"),
  hudNet: $("#hudNet"),
  hudFocus: $("#hudFocus"),
  hudFps: $("#hudFps"),

  modalRoot: $("#modalRoot"),
  modalOverlay: $("#modalOverlay"),
  modalX: $("#modalX"),
  modalOk: $("#modalOk"),
  modalTitle: $("#modalTitle"),
  modalBody: $("#modalBody")
};

const keyEls = new Map(); // code -> element

/* ====== render ====== */
function renderKeyboard(){
  els.keyboard.innerHTML = "";
  keyEls.clear();

  const layout = buildLayout(state.layout);
  const meta = layoutMeta(layout);

  // update grid and design size for fit()
  els.keyboard.style.gridTemplateColumns = `repeat(${meta.cols}, 1fr)`;
  els.keyboard.style.gridTemplateRows = `repeat(${meta.rows}, 1fr)`;

  // keep proportions relative to the original 92×6 design
  const baseW = 1700 / 92;
  const baseH = 560 / 6;

  document.documentElement.style.setProperty("--kb-design-w", String(Math.round(baseW * meta.cols)));
  document.documentElement.style.setProperty("--kb-design-h", String(Math.round(baseH * meta.rows)));

  for (const k of layout){
    const el = document.createElement("div");
    el.className = "key";
    el.dataset.code = k.code;

    const label = labelFor(k.code);
    el.textContent = label;
    el.classList.add(sizeClass(label));

    if (FPS_KEYS.has(k.code)) el.classList.add("fps");

    el.style.gridRow = `${k.row} / span ${k.rowSpan}`;
    el.style.gridColumn = `${k.col} / span ${k.colSpan}`;

    els.keyboard.appendChild(el);
    keyEls.set(k.code, el);
  }

  syncAllUI();
  updateKeyClasses();
  fitKeyboard();
}

function syncAllUI(){
  els.btnCapture.textContent = state.capture ? t("captureOn") : t("captureOff");
  els.btnMode.textContent = state.mode === "live" ? t("modeLive") : t("modeLatch");
  els.btnTheme.textContent = state.theme === "night" ? t("themeNight") : t("themeDay");
  els.btnLang.textContent = state.lang.toUpperCase();
  els.btnPlatform.textContent = state.platform === "win" ? t("windows") : t("mac");

  const layoutText = (typeof I18N[state.lang].layoutBtn === "function")
    ? I18N[state.lang].layoutBtn(layoutLabel())
    : `Layout: ${layoutLabel()}`;
  els.btnLayout.textContent = layoutText;

  els.btnFps.textContent = state.fpsMode ? t("fpsOn") : t("fpsOff");
  els.btnGhost.textContent = t("ghostBtn");
  els.btnGaming.textContent = t("gamingBtn");
  els.btnStats.textContent = t("statsBtn");
  els.btnPdf.textContent = t("pdfBtn");

  els.btnCapture.classList.toggle("active", state.capture);
  els.btnMode.classList.toggle("active", state.mode === "latch");
  els.btnTheme.classList.toggle("active", state.theme === "day");
  els.btnFps.classList.toggle("active", state.fpsMode);

  els.app.classList.toggle("fps-mode", state.fpsMode);

  els.liveLabel.textContent = t("live");
  els.btnHelp.textContent = t("help");
  els.modalOk.textContent = t("ok");

  if (els.hudHint) els.hudHint.textContent = t("hint");

  els.app.classList.toggle("theme-night", state.theme === "night");
  els.app.classList.toggle("theme-day", state.theme === "day");

  // keep live info in modals
  if (state.ghost.open) updateGhostModal();
  if (state.gaming.open) updateGamingModal();
}

/* ====== fit to viewport ====== */
function fitKeyboard(){
  const wrap = document.querySelector(".keyboardWrap");
  if (!wrap) return;

  const pad = 24;
  const availW = wrap.clientWidth - pad;
  const availH = wrap.clientHeight - pad;

  const designW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--kb-design-w")) || 1700;
  const designH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--kb-design-h")) || 560;

  const s = Math.min(availW / designW, availH / designH);
  const scale = Math.max(0.25, Math.min(1.35, s));

  els.keyboard.style.setProperty("--kb-scale", String(scale));
}

/* ====== key classes ====== */
function updateKeyClasses(){
  for (const [code, el] of keyEls){
    const down = state.pressed.has(code);
    const latched = state.latched.has(code);

    el.classList.toggle("is-down", down);
    el.classList.toggle("is-latched", state.mode === "latch" && latched);
  }

  els.hudDown.textContent = `down: ${state.pressed.size}`;
  els.hudMax.textContent = `max: ${state.maxDown}`;
  els.hudLatched.textContent = `latched: ${state.latched.size}`;

  if (state.gaming.open) updateGamingModal();
  if (state.ghost.running) ghostTick();
}

function setHud(e){
  const code = e?.code ?? "—";
  const key = e?.key ?? "—";
  const keyCode = (typeof e?.keyCode === "number") ? String(e.keyCode) : "—";
  const repeat = e?.repeat ? "yes" : "no";

  const label = code !== "—" ? labelFor(code) : "—";

  els.hudKey.textContent = label;
  els.hudEventKey.textContent = key;
  els.hudEventCode.textContent = code;
  els.hudKeyCode.textContent = keyCode;
  els.hudRepeat.textContent = repeat;

  els.hudFocus.textContent = `focus: ${document.hasFocus() ? "yes" : "no"}`;
  els.hudNet.textContent = `online: ${navigator.onLine ? "yes" : "no"}`;

  if (els.hudFps) els.hudFps.textContent = `fps: ${state.fps.value ? state.fps.value.toFixed(0) : "—"}`;
}

/* ====== capture prevent ====== */
const PREVENT_CODES = new Set([
  "Space",
  "ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
  "PageUp","PageDown","Home","End",
  "Tab","Backspace",
  "Escape",
  "AltLeft","AltRight","MetaLeft","MetaRight",
  "ControlLeft","ControlRight"
]);

function shouldPrevent(e){
  if (!state.capture) return false;

  // allow typing in inputs (если ты добавишь их позже)
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
  if (tag === "input" || tag === "textarea" || tag === "select") return false;

  // allow Esc to close modal/fullscreen logic to run
  if (e.code === "Escape" && (document.fullscreenElement || !els.modalRoot.hidden)) return false;

  if (/^F\d{1,2}$/.test(e.code)) return true;

  if (PREVENT_CODES.has(e.code)) return true;

  if (e.ctrlKey || e.metaKey || e.altKey) return true;

  return true;
}

function keepFocus(){
  els.stage?.focus({ preventScroll: true });
}

/* ====== stats helpers ====== */
function ensurePerCode(code){
  const m = state.session.perCode;
  if (!m.has(code)){
    m.set(code, { down:0, up:0, repeats:0, totalHoldMs:0, lastDownPerf:null });
  }
  return m.get(code);
}

function pushEvent(type, e){
  const now = performance.now();
  state.session.events.push({
    t: now,
    type,
    code: e.code,
    key: e.key,
    repeat: !!e.repeat
  });
  if (state.session.events.length > 200) state.session.events.shift();
}

function formatMs(ms){
  const s = Math.max(0, ms) / 1000;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

/* ====== events ====== */
function onKeyDown(e){
  if (shouldPrevent(e)) e.preventDefault();

  setHud(e);

  // session stats
  state.session.totalDown += 1;
  const pc = ensurePerCode(e.code);
  pc.down += 1;
  state.session.uniqueCodes.add(e.code);
  if (e.repeat){
    state.session.totalRepeats += 1;
    pc.repeats += 1;
  } else {
    state.session.totalPresses += 1;
    pc.lastDownPerf = performance.now();
  }

  // repeat rate tracker (gaming)
  if (state.gaming.open && e.repeat){
    if (state.gaming.repeatKey !== e.code){
      state.gaming.repeatKey = e.code;
      state.gaming.repeatCount = 0;
      state.gaming.repeatFirstPerf = performance.now();
      state.gaming.repeatLastPerf = performance.now();
    }
    state.gaming.repeatCount += 1;
    state.gaming.repeatLastPerf = performance.now();
  }

  pushEvent("down", e);

  if (state.mode === "latch" && !e.repeat){
    if (state.latched.has(e.code)) state.latched.delete(e.code);
    else state.latched.add(e.code);
  }

  state.pressed.add(e.code);

  if (state.pressed.size > state.maxDown){
    state.maxDown = state.pressed.size;
    state.maxDownCodes = Array.from(state.pressed);
  }

  updateKeyClasses();
}

function onKeyUp(e){
  if (shouldPrevent(e)) e.preventDefault();

  setHud(e);

  state.session.totalUp += 1;
  const pc = ensurePerCode(e.code);
  pc.up += 1;
  if (pc.lastDownPerf != null){
    pc.totalHoldMs += Math.max(0, performance.now() - pc.lastDownPerf);
    pc.lastDownPerf = null;
  }

  pushEvent("up", e);

  state.pressed.delete(e.code);
  updateKeyClasses();
}

function onBlur(){
  // if a key is stuck "down" in our session map, close the holds
  const now = performance.now();
  for (const [code, pc] of state.session.perCode){
    if (pc.lastDownPerf != null){
      pc.totalHoldMs += Math.max(0, now - pc.lastDownPerf);
      pc.lastDownPerf = null;
    }
  }

  state.pressed.clear();
  updateKeyClasses();
  setHud(null);
}

/* ====== modal ====== */
function showModal(title, bodyHtml){
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = bodyHtml;
  els.modalRoot.hidden = false;

  setTimeout(() => {
    els.modalOk.focus({ preventScroll: true });
  }, 0);
}

function hideModal(){
  els.modalRoot.hidden = true;

  // close interactive tests when modal is closed
  if (state.ghost.open){
    ghostStop();
    state.ghost.open = false;
  }
  if (state.gaming.open){
    state.gaming.open = false;
  }
}

function openHelp(){
  showModal(t("howTo"), I18N[state.lang].helpBody);
}

/* ====== Stats modal ====== */
function openStats(){
  showModal(t("titleStats"), I18N[state.lang].statsBody);
  updateStatsModal();
}

function updateStatsModal(){
  if (els.modalRoot.hidden) return;
  const timeEl = els.modalBody.querySelector("#sTime");
  if (!timeEl) return;

  const elapsed = performance.now() - state.session.startedPerf;

  const presses = state.session.totalPresses;
  const repeats = state.session.totalRepeats;
  const unique = state.session.uniqueCodes.size;

  timeEl.textContent = formatMs(elapsed);
  els.modalBody.querySelector("#sPress").textContent = String(presses);
  els.modalBody.querySelector("#sRepeats").textContent = String(repeats);
  els.modalBody.querySelector("#sUnique").textContent = String(unique);
  els.modalBody.querySelector("#sMaxDown").textContent = String(state.maxDown);

  // top 10 by non-repeat downs
  const list = [];
  for (const [code, pc] of state.session.perCode){
    list.push({ code, count: pc.down, hold: pc.totalHoldMs, rep: pc.repeats });
  }
  list.sort((a,b)=>b.count-a.count);

  const lines = [];
  for (const it of list.slice(0, 10)){
    const label = labelFor(it.code);
    const avgHold = it.count ? Math.round(it.hold / it.count) : 0;
    lines.push(`${label.padEnd(10," ")}  down:${String(it.count).padStart(4," ")}  rep:${String(it.rep).padStart(4," ")}  avgHold:${avgHold}ms`);
  }
  els.modalBody.querySelector("#sTop").textContent = lines.length ? lines.join("\n") : "—";
}

/* ====== Ghosting test ====== */
function defaultGhostCombos(){
  // practical gaming combos (keep within common rollover limits)
  return [
    ["KeyW","KeyA","Space"],
    ["KeyW","KeyD","Space"],
    ["KeyA","KeyS","Space"],
    ["ShiftLeft","KeyW","KeyA"],
    ["ShiftLeft","KeyW","Space"],
    ["ControlLeft","KeyW","KeyD"],
    ["KeyQ","KeyW","KeyE"],
    ["KeyR","KeyF","KeyG"],
    ["Digit1","KeyW","Space"],
    ["Digit2","KeyA","Space"]
  ];
}

function comboToText(combo){
  return combo.map(c => labelFor(c)).join(" + ");
}

function openGhost(){
  state.ghost.open = true;
  showModal(t("titleGhost"), I18N[state.lang].ghostBody);

  ghostReset();
  updateGhostModal();
}

function ghostReset(){
  ghostStop();

  state.ghost.combos = defaultGhostCombos();
  state.ghost.results = [];
  state.ghost.step = 0;
  state.ghost.running = false;
  state.ghost.stepStartPerf = 0;
  state.ghost.holdStartedPerf = 0;

  updateGhostModal();
}

function ghostStart(){
  state.ghost.running = true;
  state.ghost.step = 0;
  state.ghost.results = [];
  state.ghost.stepStartPerf = performance.now();
  state.ghost.holdStartedPerf = 0;

  scheduleGhostTimeout();
  updateGhostModal();
}

function ghostStop(){
  state.ghost.running = false;
  if (state.ghost.timeoutHandle){
    clearTimeout(state.ghost.timeoutHandle);
    state.ghost.timeoutHandle = null;
  }
  state.ghost.holdStartedPerf = 0;
  updateGhostModal();
}

function scheduleGhostTimeout(){
  if (state.ghost.timeoutHandle){
    clearTimeout(state.ghost.timeoutHandle);
    state.ghost.timeoutHandle = null;
  }
  if (!state.ghost.running) return;

  state.ghost.timeoutHandle = setTimeout(() => {
    // step timeout => fail it
    ghostFinishStep(false);
  }, state.ghost.stepTimeoutMs);
}

function ghostFinishStep(ok){
  if (!state.ghost.running) return;

  const now = performance.now();
  const combo = state.ghost.combos[state.ghost.step];
  const ms = Math.round(now - state.ghost.stepStartPerf);

  state.ghost.results.push({ combo, ok, ms });

  state.ghost.step += 1;
  state.ghost.stepStartPerf = performance.now();
  state.ghost.holdStartedPerf = 0;

  if (state.ghost.step >= state.ghost.combos.length){
    state.ghost.running = false;
    if (state.ghost.timeoutHandle){
      clearTimeout(state.ghost.timeoutHandle);
      state.ghost.timeoutHandle = null;
    }
  } else {
    scheduleGhostTimeout();
  }

  updateGhostModal();
}

function ghostTick(){
  if (!state.ghost.running) return;
  if (els.modalRoot.hidden) return;

  const combo = state.ghost.combos[state.ghost.step];
  if (!combo) return;

  const allDown = combo.every(c => state.pressed.has(c));
  const now = performance.now();

  const stepEl = els.modalBody.querySelector("#ghostStep");
  if (stepEl) stepEl.textContent = `${state.ghost.step + 1}/${state.ghost.combos.length}: ${comboToText(combo)}  ${allDown ? "✅" : "…"}`;

  if (!allDown){
    state.ghost.holdStartedPerf = 0;
    return;
  }

  if (!state.ghost.holdStartedPerf) state.ghost.holdStartedPerf = now;

  if (now - state.ghost.holdStartedPerf >= state.ghost.holdMs){
    ghostFinishStep(true);
  }
}

function updateGhostModal(){
  if (els.modalRoot.hidden) return;
  const stepEl = els.modalBody.querySelector("#ghostStep");
  if (!stepEl) return;

  const total = state.ghost.combos.length;
  if (!total){
    stepEl.textContent = "—";
    return;
  }

  const step = state.ghost.step;
  const combo = state.ghost.combos[step];

  if (!state.ghost.running){
    if (step >= total && state.ghost.results.length){
      stepEl.textContent = `Done: ${total}/${total}`;
    } else {
      stepEl.textContent = combo ? `${step + 1}/${total}: ${comboToText(combo)}` : "—";
    }
  } else {
    stepEl.textContent = combo ? `${step + 1}/${total}: ${comboToText(combo)}` : "—";
  }

  const ok = state.ghost.results.filter(r => r.ok).length;
  const fail = state.ghost.results.filter(r => !r.ok).length;

  const sumEl = els.modalBody.querySelector("#ghostSummary");
  if (sumEl){
    const status = state.ghost.running ? "running" : "stopped";
    sumEl.textContent = `${status} · pass:${ok} fail:${fail} · step:${Math.min(step+1,total)}/${total}`;
  }

  const listEl = els.modalBody.querySelector("#ghostList");
  if (listEl){
    const lines = state.ghost.results.map((r, i) => {
      const mark = r.ok ? "PASS" : "FAIL";
      return `${String(i+1).padStart(2,"0")}. ${mark}  (${r.ms}ms)  ${comboToText(r.combo)}`;
    });
    listEl.textContent = lines.length ? lines.join("\n") : "—";
  }
}

/* ====== Gaming test ====== */
function openGaming(){
  state.gaming.open = true;
  showModal(t("titleGaming"), I18N[state.lang].gamingBody);
  updateGamingModal();
}

function gamingReset(){
  state.maxDown = state.pressed.size;
  state.maxDownCodes = Array.from(state.pressed);

  state.gaming.repeatKey = null;
  state.gaming.repeatCount = 0;
  state.gaming.repeatFirstPerf = 0;
  state.gaming.repeatLastPerf = 0;

  updateKeyClasses();
  updateGamingModal();
}

function updateGamingModal(){
  if (els.modalRoot.hidden) return;
  const downEl = els.modalBody.querySelector("#gDown");
  if (!downEl) return;

  downEl.textContent = String(state.pressed.size);
  els.modalBody.querySelector("#gMax").textContent = String(state.maxDown);

  const maxKeys = state.maxDownCodes.length
    ? state.maxDownCodes.map(c => labelFor(c)).join("+")
    : "—";
  els.modalBody.querySelector("#gMaxKeys").textContent = maxKeys;

  const repKey = state.gaming.repeatKey;
  els.modalBody.querySelector("#gRepKey").textContent = repKey ? labelFor(repKey) : "—";
  els.modalBody.querySelector("#gRepCount").textContent = String(state.gaming.repeatCount);

  let rps = 0;
  if (state.gaming.repeatCount > 1 && state.gaming.repeatFirstPerf && state.gaming.repeatLastPerf){
    const dt = Math.max(1, state.gaming.repeatLastPerf - state.gaming.repeatFirstPerf);
    rps = state.gaming.repeatCount * 1000 / dt;
  }
  els.modalBody.querySelector("#gRps").textContent = rps ? rps.toFixed(1) : "0";
}

/* ====== PDF builder (no deps) ====== */
function pdfEscape(s){
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
}

function makeSimplePDF(lines){
  // A4 portrait in points: 595 x 842
  const W = 595, H = 842;
  const left = 40;
  const top = H - 54;
  const lineH = 14;

  let y = top;
  const contentParts = [];
  contentParts.push("BT");
  contentParts.push("/F1 10 Tf");
  contentParts.push(`${left} ${y} Td`);

  for (let i=0; i<lines.length; i++){
    const ln = pdfEscape(lines[i]);
    contentParts.push(`(${ln}) Tj`);
    if (i !== lines.length - 1){
      contentParts.push(`0 -${lineH} Td`);
      y -= lineH;
      if (y < 60){
        // new page marker (we'll support multi-page by ending BT and using page breaks token)
        contentParts.push("ET");
        contentParts.push("%%PAGEBREAK%%");
        y = top;
        contentParts.push("BT");
        contentParts.push("/F1 10 Tf");
        contentParts.push(`${left} ${y} Td`);
      }
    }
  }
  contentParts.push("ET");

  const pages = [];
  let current = [];
  for (const p of contentParts){
    if (p === "%%PAGEBREAK%%"){
      pages.push(current.join("\n"));
      current = [];
    } else {
      current.push(p);
    }
  }
  pages.push(current.join("\n"));

  // Build PDF objects
  const objects = [];
  const offsets = [];
  const pushObj = (str) => { offsets.push(null); objects.push(str); };

  // 1) Catalog, 2) Pages, 3...) Page objects, Font, Contents...
  // We'll fill xref offsets later by building the final string.
  const pageObjs = [];
  const contentObjs = [];

  // Font object
  const fontObjNum = 3 + pages.length * 2; // after catalog/pages and pairs
  // We'll add catalog and pages placeholders later.
  // We'll craft all objects sequentially:
  // 1 catalog, 2 pages, then for each page: pageObj, contentObj, then font.

  const header = "%PDF-1.3\n%\xE2\xE3\xCF\xD3\n";

  // Catalog (obj 1)
  pushObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Pages (obj 2) placeholder, we fill kids later
  // We'll compute page object numbers: 3,5,7,... (odd numbers after 2)
  const kids = [];
  for (let i=0;i<pages.length;i++){
    kids.push(`${3 + i*2} 0 R`);
  }
  pushObj(`2 0 obj\n<< /Type /Pages /Kids [ ${kids.join(" ")} ] /Count ${pages.length} >>\nendobj\n`);

  // Page & content objects
  for (let i=0;i<pages.length;i++){
    const pageNum = 3 + i*2;
    const contentNum = 4 + i*2;
    const stream = pages[i];
    const streamBytes = new TextEncoder().encode(stream);
    pushObj(`${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`);
    pushObj(`${contentNum} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  }

  // Font (last)
  pushObj(`${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  // Build final PDF with xref
  let out = header;
  for (let i=0;i<objects.length;i++){
    offsets[i] = out.length;
    out += objects[i];
  }

  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n`;
  out += "0000000000 65535 f \n";
  for (let i=0;i<objects.length;i++){
    out += String(offsets[i]).padStart(10,"0") + " 00000 n \n";
  }

  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new TextEncoder().encode(out);
  return new Blob([bytes], { type: "application/pdf" });
}

function buildReportLines(){
  const elapsed = performance.now() - state.session.startedPerf;
  const lines = [];

  lines.push("Keyboard Tester report");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("=== Session ===");
  lines.push(`Session time: ${formatMs(elapsed)}`);
  lines.push(`Total presses: ${state.session.totalPresses}`);
  lines.push(`Total repeats: ${state.session.totalRepeats}`);
  lines.push(`Unique keys: ${state.session.uniqueCodes.size}`);
  lines.push(`Max simultaneous keys: ${state.maxDown}`);
  lines.push(`Layout: ${layoutLabel()}`);
  lines.push(`FPS mode: ${state.fpsMode ? "ON" : "OFF"}`);
  lines.push("");

  lines.push("=== Ghosting check ===");
  if (state.ghost.results.length){
    const ok = state.ghost.results.filter(r=>r.ok).length;
    const fail = state.ghost.results.filter(r=>!r.ok).length;
    lines.push(`Steps: ${state.ghost.results.length}  pass:${ok}  fail:${fail}`);
    for (const r of state.ghost.results){
      lines.push(`${r.ok ? "PASS" : "FAIL"}  (${r.ms}ms)  ${comboToText(r.combo)}`);
    }
  } else {
    lines.push("Not run.");
  }
  lines.push("");

  lines.push("=== Top keys ===");
  const list = [];
  for (const [code, pc] of state.session.perCode){
    list.push({ code, count: pc.down, rep: pc.repeats, hold: pc.totalHoldMs });
  }
  list.sort((a,b)=>b.count-a.count);
  for (const it of list.slice(0, 12)){
    const label = labelFor(it.code);
    const avgHold = it.count ? Math.round(it.hold / it.count) : 0;
    lines.push(`${label}  down:${it.count} rep:${it.rep} avgHold:${avgHold}ms`);
  }

  lines.push("");
  lines.push("=== Recent events (last 20) ===");
  const ev = state.session.events.slice(-20);
  const t0 = state.session.startedPerf;
  for (const e of ev){
    const dt = Math.max(0, e.t - t0);
    lines.push(`${(dt/1000).toFixed(3)}s  ${e.type.padEnd(4," ")}  ${e.code}  key:${String(e.key)}`);
  }

  return lines;
}

function downloadPDF(){
  const lines = buildReportLines();
  const pdf = makeSimplePDF(lines);

  const url = URL.createObjectURL(pdf);
  const a = document.createElement("a");
  a.href = url;
  a.download = `keyboard-report-${new Date().toISOString().slice(0,10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

/* ====== buttons ====== */
function toggleFullscreen(){
  if (!document.fullscreenElement){
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function clearAll(){
  state.pressed.clear();
  state.latched.clear();
  state.maxDown = 0;
  state.maxDownCodes = [];
  setHud(null);
  updateKeyClasses();
}

function toggleLang(){
  state.lang = (state.lang === "en") ? "ru" : "en";

  for (const [code, el] of keyEls){
    const label = labelFor(code);
    el.textContent = label;
    el.classList.remove("small","med","big");
    el.classList.add(sizeClass(label));
  }
  syncAllUI();
}

function togglePlatform(){
  state.platform = (state.platform === "win") ? "mac" : "win";

  for (const [code, el] of keyEls){
    const label = labelFor(code);
    el.textContent = label;
    el.classList.remove("small","med","big");
    el.classList.add(sizeClass(label));
  }
  syncAllUI();
}

function toggleTheme(){
  state.theme = (state.theme === "night") ? "day" : "night";
  syncAllUI();
}

function toggleCapture(){
  state.capture = !state.capture;
  syncAllUI();
  keepFocus();
}

function toggleMode(){
  state.mode = (state.mode === "live") ? "latch" : "live";
  updateKeyClasses();
  syncAllUI();
}

function cycleLayout(){
  const order = ["full","tkl","75","65","60"];
  const idx = Math.max(0, order.indexOf(state.layout));
  state.layout = order[(idx + 1) % order.length];
  renderKeyboard();
  keepFocus();
}

function toggleFpsMode(){
  state.fpsMode = !state.fpsMode;
  syncAllUI();
  keepFocus();
}

function onModalActionClick(e){
  const btn = e.target.closest?.("[data-action]");
  if (!btn) return;

  const act = btn.getAttribute("data-action");
  if (!act) return;

  if (act === "ghostStart") ghostStart();
  if (act === "ghostStop") ghostStop();
  if (act === "ghostReset") ghostReset();

  if (act === "gamingReset") gamingReset();
}

/* ====== fps loop ====== */
function startFpsLoop(){
  state.fps.lastPerf = performance.now();
  state.fps.frames = 0;

  const tick = (now) => {
    state.fps.frames += 1;
    const dt = now - state.fps.lastPerf;
    if (dt >= 500){
      state.fps.value = state.fps.frames * 1000 / dt;
      state.fps.frames = 0;
      state.fps.lastPerf = now;
      if (els.hudFps) els.hudFps.textContent = `fps: ${state.fps.value.toFixed(0)}`;
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

/* ====== init ====== */
function init(){
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  renderKeyboard();
  keepFocus();

  window.addEventListener("resize", fitKeyboard);

  // capture:true — шанс выше перехватить F-keys до действий браузера
  window.addEventListener("keydown", onKeyDown, { capture:true, passive:false });
  window.addEventListener("keyup", onKeyUp, { capture:true, passive:false });
  window.addEventListener("blur", onBlur);

  els.stage?.addEventListener("mousedown", keepFocus);

  window.addEventListener("online", ()=>setHud(null));
  window.addEventListener("offline", ()=>setHud(null));

  els.btnCapture.addEventListener("click", toggleCapture);
  els.btnMode.addEventListener("click", toggleMode);
  els.btnClear.addEventListener("click", clearAll);

  els.btnLayout.addEventListener("click", cycleLayout);
  els.btnFps.addEventListener("click", toggleFpsMode);
  els.btnGhost.addEventListener("click", openGhost);
  els.btnGaming.addEventListener("click", openGaming);
  els.btnStats.addEventListener("click", openStats);
  els.btnPdf.addEventListener("click", downloadPDF);

  els.btnLang.addEventListener("click", toggleLang);
  els.btnPlatform.addEventListener("click", togglePlatform);
  els.btnTheme.addEventListener("click", toggleTheme);
  els.btnFullscreen.addEventListener("click", toggleFullscreen);
  els.btnHelp.addEventListener("click", openHelp);

  els.modalOverlay.addEventListener("click", hideModal);
  els.modalX.addEventListener("click", hideModal);
  els.modalOk.addEventListener("click", hideModal);

  els.modalBody.addEventListener("click", onModalActionClick);

  window.addEventListener("keydown", (e)=>{
    if (e.key === "Escape" && !els.modalRoot.hidden){
      e.preventDefault();
      hideModal();
    }
  }, { passive:false });

  // update stats while stats modal is open
  setInterval(() => {
    if (!els.modalRoot.hidden) updateStatsModal();
  }, 500);

  startFpsLoop();
  setHud(null);
}

init();
