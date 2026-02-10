// Geniusness – content script on puzzle game pages (NYT, Atlantic, BuzzFeed, WaPo, Quintumble)
// Injects "Send to Geniusness" and captures share text (clipboard or DOM).

(function () {
  // Each entry: { pathPrefix, slug } for NYT, or { host, pathPrefix, slug } for other sites.
  // host is matched as hostname === host || hostname.endsWith('.' + host)
  const GAME_PAGES = [
    // NYT (path-only; script only runs on nytimes.com)
    { pathPrefix: '/games/wordle', slug: 'wordle' },
    { pathPrefix: '/games/connections', slug: 'connections' },
    { pathPrefix: '/games/strands', slug: 'strands' },
    { pathPrefix: '/games/spelling-bee', slug: 'spelling-bee' },
    { pathPrefix: '/puzzles/spelling-bee', slug: 'spelling-bee' },
    { pathPrefix: '/games/letter-boxed', slug: 'letter-boxed' },
    { pathPrefix: '/games/vertex', slug: 'vertex' },
    { pathPrefix: '/games/sudoku', slug: 'sudoku' },
    { pathPrefix: '/games/mini-crossword', slug: 'mini-crossword' },
    { pathPrefix: '/games/crossword', slug: 'crossword' },
    { pathPrefix: '/games/tiles', slug: 'tiles' },
    // Other publishers
    { host: 'theatlantic.com', pathPrefix: '/games/bracket-city', slug: 'bracket-city' },
    { host: 'buzzfeed.com', pathPrefix: '/pyramid-scheme', slug: 'pyramid-scheme' },
    { host: 'washingtonpost.com', pathPrefix: '/games/keyword', slug: 'keyword' },
    { host: 'washingtonpost.com', pathPrefix: '/games', slug: 'keyword', pathContains: 'keyword' },
    { host: 'washingtonpost.com', pathPrefix: '/games-static/keyword-game', slug: 'keyword' },
    { host: 'games.washingtonpost.com', pathPrefix: '/keyword', slug: 'keyword' },
    { host: 'games.washingtonpost.com', pathPrefix: '/games/keyword', slug: 'keyword' },
    { host: 'quintumble.com', pathPrefix: '/', slug: 'quintumble' },
  ];

  function getGameSlug() {
    let hostname = '';
    let pathname = '';
    try {
      const loc = window.top && window.top.location ? window.top.location : window.location;
      hostname = loc.hostname || '';
      pathname = loc.pathname || '';
    } catch (_) {
      hostname = window.location.hostname || '';
      pathname = window.location.pathname || '';
    }
    const path = (pathname || '').replace(/\/$/, '') || '/';
    for (const entry of GAME_PAGES) {
      let pathMatch = path === entry.pathPrefix || (entry.pathPrefix !== '/' && path.startsWith(entry.pathPrefix + '/'));
      if (entry.pathContains) pathMatch = pathMatch && path.indexOf(entry.pathContains) !== -1;
      if (entry.host) {
        const hostMatch = hostname === entry.host || hostname.endsWith('.' + entry.host);
        if (hostMatch && pathMatch) return entry.slug;
      } else {
        if (pathMatch) return entry.slug;
      }
    }
    return null;
  }

  function looksLikeShareText(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim();
    if (t.length < 10) return false;
    if (/Wordle\s+\d+\s+\d\/6/i.test(t)) return true;
    if (/Connections\s*[\s\S]*Puzzle\s*#/i.test(t)) return true;
    if (/[🟪🟦🟩🟨⬜🟨🟩]/.test(t)) return true;
    if (/Strands\s*[\s\S]*\d+\s*words/i.test(t)) return true;
    if (/Spelling Bee|Queen Bee|Genius/i.test(t)) return true;
    // Pyramid Scheme: "Solved on Expert Mode in 0:08"
    if (/Solved on Expert Mode in \d+:\d+/i.test(t)) return true;
    // Quintumble: "🎯 98" or similar score
    if (/🎯\s*\d+/.test(t) || /Quintumble/i.test(t)) return true;
    // Bracket City: "Total Score: 98.0"
    if (/Total Score:\s*[\d.]+/i.test(t) || /Bracket City/i.test(t)) return true;
    // Keyword: time + errors or game name
    if (/Keyword/i.test(t) && /\d+/.test(t)) return true;
    return false;
  }

  function tryGetShareFromDOM() {
    const body = document.body && document.body.innerText;
    if (body && looksLikeShareText(body)) return body;
    const sel = [
      '[data-share-text]',
      '[data-copy-text]',
      '.share-text',
      '.game-result',
      '[class*="share"]',
      '[class*="result"]',
      'button[aria-label*="share" i]',
      'button[aria-label*="copy" i]',
    ];
    for (const q of sel) {
      try {
        const el = document.querySelector(q);
        if (el) {
          const text = el.getAttribute('data-share-text') || el.getAttribute('data-copy-text') || el.innerText || el.textContent;
          if (text && looksLikeShareText(text)) return text.trim();
        }
      } catch (_) {}
    }
    return null;
  }

  /** Wordle: get share text from DOM, or current guess count from NYT localStorage or Statistics modal. Returns "Wordle 0 X/6" so backend can parse. */
  function tryGetWordleScoreFromDOM() {
    const shareFromDom = tryGetShareFromDOM();
    if (shareFromDom && /Wordle\s+\d+\s+\d\s*\/\s*6/i.test(shareFromDom)) return shareFromDom;

    // NYT Wordle stores current game in localStorage. Use boardState length when WIN (most reliable). Try both this frame and top frame (game may be in iframe or parent).
    const storageKeys = ['nyt-wordle-state', 'nyt_wordle_state'];
    const storages = [];
    try {
      storages.push({ storage: localStorage, label: 'local' });
      storages.push({ storage: sessionStorage, label: 'session' });
      if (window.top !== window && window.top.localStorage) storages.push({ storage: window.top.localStorage, label: 'top-local' });
      if (window.top !== window && window.top.sessionStorage) storages.push({ storage: window.top.sessionStorage, label: 'top-session' });
    } catch (_) {}
    for (const { storage, label } of storages) {
      for (const key of storageKeys) {
        try {
          if (!storage || typeof storage.getItem !== 'function') continue;
          const raw = storage.getItem(key);
          if (!raw) continue;
          const state = JSON.parse(raw);
          if (!state || state.gameStatus !== 'WIN') continue;
          let guesses = null;
          if (Array.isArray(state.boardState)) {
            const filled = state.boardState.filter(function (row) { return row && String(row).length >= 5; });
            if (filled.length >= 1 && filled.length <= 6) guesses = filled.length;
          }
          if (guesses == null && state.rowIndex != null) {
            guesses = typeof state.rowIndex === 'number' ? state.rowIndex : parseInt(state.rowIndex, 10);
            if (guesses === 0) guesses = 1;
          }
          if (guesses != null && guesses >= 1 && guesses <= 6) return 'Wordle 0 ' + guesses + '/6';
        } catch (_) {}
      }
    }
    // NYT Wordle V2: games-state-wordleV2/... has structure { states: [{ data: { gameStatus, boardState, ... } }] }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.indexOf('games-state-wordle') !== 0) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const p = JSON.parse(raw);
          const top = p && p.value && typeof p.value === 'object' ? p.value : p;
          const states = top && top.states;
          if (states == null) continue;
          const isArr = Array.isArray(states);
          const list = isArr ? states : (typeof states === 'object' ? Object.values(states) : []);
          for (let j = 0; j < list.length; j++) {
            const entry = list[j];
            if (!entry || typeof entry !== 'object') continue;
            const s = entry.data && typeof entry.data === 'object' ? entry.data : entry;
            const status = s.gameStatus || s.game_status || s.status;
            if (status !== 'WIN' && status !== 'win') continue;
            const board = s.boardState || s.board_state || s.board;
            let guesses = null;
            if (Array.isArray(board)) {
              const filled = board.filter(function (row) { return row && String(row).length >= 5; });
              if (filled.length >= 1 && filled.length <= 6) guesses = filled.length;
            }
            if (guesses == null && s.rowIndex != null) guesses = Math.min(6, Math.max(1, parseInt(s.rowIndex, 10) || 0));
            if (guesses != null && guesses >= 1 && guesses <= 6) return 'Wordle 0 ' + guesses + '/6';
          }
        } catch (_) {}
      }
    } catch (_) {}

    const body = document.body && document.body.innerText;
    if (!body || !/GUESS DISTRIBUTION/i.test(body)) return null;

    // Find the row that represents today's result (highlighted / current)
    const distributionSelectors = [
      '[class*="current"]',
      '[class*="highlight"]',
      '[class*="today"]',
      '[class*="active"]',
      '[class*="selected"]',
      '[data-current="true"]',
      '[data-today="true"]',
    ];
    for (const sel of distributionSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const text = (el.textContent || el.innerText || '').trim();
          const guessMatch = text.match(/\b([1-6])\b/);
          if (guessMatch && guessMatch[1]) {
            const g = parseInt(guessMatch[1], 10);
            if (g >= 1 && g <= 6) return 'Wordle 0 ' + g + '/6';
          }
        }
      } catch (_) {}
    }

    // Fallback: find GUESS DISTRIBUTION section and look for a row with green bar
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node;
      while ((node = walker.nextNode())) {
        if ((node.textContent || '').indexOf('GUESS DISTRIBUTION') !== -1) {
          const container = node.closest ? node.closest('[class*="distribution"], [class*="Distribution"], [class*="stats"], [class*="modal"]') || node : node;
          const rows = (container || document.body).querySelectorAll('[class*="row"], [class*="bar"], [class*="guess"], li, [role="listitem"]');
          for (const row of rows) {
            const style = window.getComputedStyle ? window.getComputedStyle(row) : {};
            const bg = (style.backgroundColor || '').toLowerCase();
            const isHighlight = /green|rgb\s*\(\s*106\s*,\s*170\s*,\s*100|#6aaa64|var\s*\(--.*green/i.test(bg) || row.getAttribute('data-current') === 'true';
            if (isHighlight) {
              const m = (row.textContent || '').match(/\b([1-6])\b/);
              if (m && m[1]) return 'Wordle 0 ' + m[1] + '/6';
            }
          }
          break;
        }
      }
    } catch (_) {}

    return null;
  }

  /** True when we're inside the Keyword game iframe (not the parent wrapper). */
  function isKeywordIframe() {
    return /\/games-static\/keyword-game\//.test(window.location.pathname || '');
  }

  /** Returns true when the page shows a finished game (share text or Keyword time/errors). */
  function isGameComplete(slug) {
    const body = document.body && document.body.innerText;
    
    // Keyword: only show in the game iframe, and only when time+guesses are visible
    if (slug === 'keyword') {
      if (!isKeywordIframe()) return false;  // Parent page: no button (iframe will show it)
      if (!body) return false;
      const hasTime = /\d{2}:\d{2}/i.test(body);
      const hasGuesses = /guesses?[:\s]+\d+/i.test(body) || /\d+\s*guesses?/i.test(body);
      return hasTime && hasGuesses;
    }
    
    // Wordle: require results-only indicators (no "Share" alone – that's in the page header). Any one of these means the results view is visible.
    if (slug === 'wordle') {
      if (!body) return false;
      const hasShareLine = /Wordle\s+\d+\s+\d\/6/i.test(body);
      const hasStatistics = /Statistics/i.test(body);
      const hasEmoji = /[🟪🟦🟩🟨⬜]/.test(body);
      return hasShareLine || hasStatistics || hasEmoji;
    }
    
    // Check if we can extract share text from DOM
    if (tryGetShareFromDOM()) return true;
    
    // Check body text for share-like content
    if (body && looksLikeShareText(body)) return true;
    
    // Game-specific completion indicators (more lenient)
    if (!body) return false;
    
    // Connections: "Puzzle #" and category groups visible
    if (slug === 'connections' && /Puzzle\s*#\d+/i.test(body) && /🟨🟩🟦🟪/.test(body)) return true;
    
    // Spelling Bee: "Genius" or "Queen Bee" or score summary
    if (slug === 'spelling-bee' && (/Genius|Queen Bee|Great|Nice|Good|Solid|Amazing/i.test(body) || /You found \d+ words?/i.test(body))) return true;
    
    // Strands: completion message
    if (slug === 'strands' && /words?/i.test(body) && /Strands/i.test(body)) return true;
    
    // Other games: if body has emoji squares or game-specific patterns, assume complete
    if (/[🟪🟦🟩🟨⬜⬛🟥]/.test(body)) return true;
    
    return false;
  }

  // Keyword (Washington Post): no share output; scrape time (seconds) and guesses from page. 
  // Score = time + errors*10, where errors = guesses - 6 (minimum is 6 guesses for a perfect game)
  function tryGetKeywordFromDOM() {
    const text = (document.body && document.body.innerText) || '';
    
    // Parse time from "00:11" format (MM:SS) or "X seconds"
    let time = null;
    const mmssMatch = text.match(/(\d{2}):(\d{2})/);
    if (mmssMatch) {
      const minutes = parseInt(mmssMatch[1], 10);
      const seconds = parseInt(mmssMatch[2], 10);
      time = minutes * 60 + seconds;
    }
    if (time == null) {
      const timeLabel = text.match(/time[:\s]+(\d+)/i);
      if (timeLabel && timeLabel[1]) time = parseInt(timeLabel[1], 10);
    }
    if (time == null) {
      const secMatches = text.matchAll(/(\d+)\s*seconds?/gi);
      for (const m of secMatches) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n < 3600 && (time == null || n > time)) time = n;
      }
    }
    
    // Parse guesses (Keyword uses "Guesses" not "Errors")
    const guessMatch = text.match(/guesses?[:\s]+(\d+)/i) || text.match(/(\d+)\s*guesses?/i);
    const guesses = guessMatch && guessMatch[1] ? parseInt(guessMatch[1], 10) : null;
    
    if (time != null && !isNaN(time) && guesses != null && !isNaN(guesses) && time >= 0 && time < 3600 && guesses >= 6 && guesses < 50) {
      // Calculate errors: guesses - 6 (minimum perfect game is 6 guesses)
      const errors = guesses - 6;
      return 'Time: ' + time + ', Errors: ' + errors;
    }
    return null;
  }

  function createButton() {
    const slug = getGameSlug();
    if (!slug) return;

    const existing = document.getElementById('geniusness-extension-root');
    if (existing) return;

    if (!document.body) {
      setTimeout(maybeShowButton, 100);
      return;
    }

    if (!isGameComplete(slug)) return;

    const root = document.createElement('div');
    root.id = 'geniusness-extension-root';
    root.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const btn = document.createElement('button');
    btn.textContent = 'Send to Geniusness';
    btn.style.cssText = `
      padding: 10px 16px;
      background: #4a7c59;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    btn.addEventListener('click', async () => {
      let shareText = null;
      try {
        const perm = await navigator.permissions.query({ name: 'clipboard-read' });
        if (perm.state === 'granted' || perm.state === 'prompt') {
          try {
            const clip = await navigator.clipboard.readText();
            if (clip && looksLikeShareText(clip)) shareText = clip;
          } catch (_) {}
        }
      } catch (_) {}
      if (!shareText) shareText = tryGetShareFromDOM();
      // Wordle: if we got stats panel text (no "Wordle N M/6"), try to get score from highlighted distribution row
      if (slug === 'wordle' && (!shareText || !/Wordle\s+\d+\s+\d\s*\/\s*6/i.test(shareText))) {
        const wordleScore = tryGetWordleScoreFromDOM();
        if (wordleScore) shareText = wordleScore;
      }
      // Keyword has no share output; try to grab time + errors from the page
      if (!shareText && slug === 'keyword') shareText = tryGetKeywordFromDOM();
      if (!shareText) {
        const paste = window.prompt(
          slug === 'keyword'
            ? 'Paste "Time: X, Errors: Y" (e.g. Time: 11, Errors: 1) or we\'ll try to read it from the page after you click OK.'
            : 'Paste your puzzle share text here (or click Share on the game first, then try again):'
        );
        const keywordMatch = slug === 'keyword' && paste && (/Time:\s*\d+.*Errors:\s*\d+/i.test(paste) || /^\d+\s*,\s*\d+$/.test(paste.trim()));
        const otherMatch = slug !== 'keyword' && paste && looksLikeShareText(paste);
        if (keywordMatch || otherMatch) shareText = paste;
      }
      if (!shareText && slug === 'keyword') shareText = tryGetKeywordFromDOM();
      if (!shareText) {
        alert(slug === 'keyword'
          ? 'Couldn\'t find time and errors on the page. Make sure you\'ve finished the game, then try again. Or paste "Time: 11, Errors: 1" (your numbers).'
          : "Couldn't get your score from the page. Try this: click the game's Share button first (to copy the result), then click Send to Geniusness again. The extension will read from your clipboard.");
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GENIUSNESS_SUBMIT_SCORE',
          payload: { shareText, gameSlug: slug },
        });
        if (response && response.ok) {
          btn.textContent = 'Sent ✓';
          btn.style.background = '#2d5a3d';
          setTimeout(() => {
            btn.textContent = 'Send to Geniusness';
            btn.style.background = '#4a7c59';
            btn.disabled = false;
          }, 2000);
        } else {
          btn.textContent = 'Send to Geniusness';
          btn.disabled = false;
          alert(response && response.error ? response.error : 'Failed to send score.');
        }
      } catch (e) {
        btn.textContent = 'Send to Geniusness';
        btn.disabled = false;
        const msg = (e && e.message) || '';
        if (msg.includes('Extension context invalidated')) {
          alert('The extension was reloaded or updated. Please refresh this page (F5 or reload) and try again.');
        } else {
          alert('Extension error: ' + (msg || 'Check that you are connected in the extension popup.'));
        }
      }
    });

    root.appendChild(btn);
    document.body.appendChild(root);
  }

  /** Show button when game is complete; remove it when completion indicators disappear. */
  function maybeShowButton() {
    const slug = getGameSlug();
    const root = document.getElementById('geniusness-extension-root');

    if (!slug) {
      if (root) root.remove();
      return;
    }

    const complete = isGameComplete(slug);
    if (root) {
      if (!complete) root.remove();
    } else if (complete) {
      createButton();
    }
  }

  function init() {
    function scheduleCheck() {
      maybeShowButton();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleCheck);
    } else {
      scheduleCheck();
    }
    // Retry after a short delay for SPAs that reveal completion state later
    setTimeout(scheduleCheck, 1500);
    setTimeout(scheduleCheck, 4000);

    // When the DOM changes (e.g. game shows results), re-check. Throttle to avoid excessive work.
    let checkScheduled = false;
    function throttledCheck() {
      if (checkScheduled) return;
      checkScheduled = true;
      setTimeout(function () {
        checkScheduled = false;
        maybeShowButton();
      }, 500);
    }
    const observer = new MutationObserver(throttledCheck);
    function observeBody() {
      if (!document.body) {
        setTimeout(observeBody, 100);
        return;
      }
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    if (document.body) observeBody();
    else document.addEventListener('DOMContentLoaded', observeBody);
  }

  init();
})();
