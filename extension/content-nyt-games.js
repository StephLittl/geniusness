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

  // Keyword (Washington Post): no share output; scrape time (seconds) and errors from page. Score = time + errors*10.
  function tryGetKeywordFromDOM() {
    const text = (document.body && document.body.innerText) || '';
    // Prefer "Time: X" so we get the full number (e.g. 12 not 2)
    let time = null;
    const timeLabel = text.match(/time[:\s]+(\d+)/i);
    if (timeLabel && timeLabel[1]) time = parseInt(timeLabel[1], 10);
    if (time == null) {
      // Match all "X seconds" / "X sec" and take the largest (avoids "2" from "12" split across DOM)
      const secMatches = text.matchAll(/(\d+)\s*seconds?/gi);
      for (const m of secMatches) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n < 3600 && (time == null || n > time)) time = n;
      }
    }
    if (time == null) {
      const secMatches = text.matchAll(/(\d+)\s*sec\b/gi);
      for (const m of secMatches) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n < 3600 && (time == null || n > time)) time = n;
      }
    }
    const errMatch = text.match(/(\d+)\s*errors?/i) || text.match(/(\d+)\s*wrong/i) || text.match(/(\d+)\s*mistakes?/i) || text.match(/errors?[:\s]+(\d+)/i);
    const errors = errMatch && errMatch[1] ? parseInt(errMatch[1], 10) : null;
    if (time != null && !isNaN(time) && errors != null && !isNaN(errors) && time >= 0 && time < 3600 && errors >= 0 && errors < 20) {
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
      setTimeout(createButton, 100);
      return;
    }

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
          : "Couldn't get share text. Click Share on the game first to copy results, then click Send to Geniusness again.");
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

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createButton);
    } else {
      createButton();
    }
    // Retry after a short delay for SPAs that change the DOM after load
    setTimeout(createButton, 1500);
  }

  init();
})();
