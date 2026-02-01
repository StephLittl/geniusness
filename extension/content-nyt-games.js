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
    
    // Check if we can extract share text from DOM
    if (tryGetShareFromDOM()) return true;
    
    // Check body text for share-like content
    if (body && looksLikeShareText(body)) return true;
    
    // Game-specific completion indicators (more lenient)
    if (!body) return false;
    
    // Wordle: "Statistics" or share button visible
    if (slug === 'wordle' && (/Statistics/i.test(body) || /Share/i.test(body))) return true;
    
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

  /** Show the button only when we're on a known game and it's complete. */
  function maybeShowButton() {
    const slug = getGameSlug();
    if (!slug) return;
    if (document.getElementById('geniusness-extension-root')) return;
    createButton();
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
