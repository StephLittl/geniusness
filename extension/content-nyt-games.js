// Geniusness – content script on NYT Games pages
// Injects "Send to Geniusness" and captures share text (clipboard or DOM).

(function () {
  // NYT uses /games/... (Wordle, Connections, etc.) and /puzzles/spelling-bee
  const PATH_PREFIX_TO_SLUG = [
    ['/games/wordle', 'wordle'],
    ['/games/connections', 'connections'],
    ['/games/strands', 'strands'],
    ['/games/spelling-bee', 'spelling-bee'],
    ['/puzzles/spelling-bee', 'spelling-bee'],
    ['/games/letter-boxed', 'letter-boxed'],
    ['/games/vertex', 'vertex'],
    ['/games/sudoku', 'sudoku'],
    ['/games/mini-crossword', 'mini-crossword'],
    ['/games/crossword', 'crossword'],
    ['/games/tiles', 'tiles'],
    ['/games/pyramid-scheme', 'pyramid-scheme'],
    ['/games/bracket-city', 'bracket-city'],
    ['/games/keyword', 'keyword'],
    ['/games/quintumble', 'quintumble'],
  ];

  function getGameSlug() {
    // Use top frame URL so we detect the game even when script runs inside an iframe
    let pathname = '';
    try {
      pathname = window.top && window.top.location ? window.top.location.pathname : window.location.pathname;
    } catch (_) {
      pathname = window.location.pathname || '';
    }
    const path = (pathname || '').replace(/\/$/, '') || '/';
    for (const [prefix, slug] of PATH_PREFIX_TO_SLUG) {
      if (path === prefix || path.startsWith(prefix + '/')) return slug;
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
      if (!shareText) {
        const paste = window.prompt(
          "Paste your puzzle share text here (or click Share on the game first, then try again):"
        );
        if (paste && looksLikeShareText(paste)) shareText = paste;
      }
      if (!shareText) {
        alert("Couldn't get share text. Click Share on the game first to copy results, then click Send to Geniusness again.");
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
        alert('Extension error: ' + (e.message || 'Check that you are connected in the extension popup.'));
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
