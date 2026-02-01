const express = require('express');

function parseShareString(shareText, parser, gameSlug) {
  // Keyword: no share output; score = time (seconds) + errors * 10. Accept "Time: X, Errors: Y" or "X,Y"
  if (gameSlug === 'keyword' && shareText && typeof shareText === 'string') {
    const timeErr = shareText.match(/Time:\s*(\d+)\s*,\s*Errors:\s*(\d+)/i) ||
      shareText.match(/Time:\s*(\d+).*Errors:\s*(\d+)/is) ||
      shareText.match(/(\d+)\s*,\s*(\d+)/) ||
      shareText.match(/(\d+)\s+seconds?.*?(\d+)\s+errors?/is) ||
      shareText.match(/(\d+)\s+sec.*?(\d+)\s+errors?/is);
    if (timeErr && timeErr[1] != null && timeErr[2] != null) {
      const time = parseInt(timeErr[1], 10);
      const errors = parseInt(timeErr[2], 10);
      if (!isNaN(time) && !isNaN(errors) && time >= 0 && errors >= 0) {
        return time + errors * 10;
      }
    }
  }

  if (!parser) return null;
  
  try {
    if (parser.pattern_type === 'regex') {
      // Special handling for Connections: count lines that aren't all one color
      if (gameSlug === 'connections' && parser.score_path === 'count_errors') {
        const lines = shareText.split('\n').filter(line => {
          const trimmed = line.trim();
          // Only consider lines that contain emoji squares
          return trimmed && /[🟪🟦🟩🟨]/.test(trimmed);
        });
        let errors = 0;
        const colorPatterns = [/^[🟪]+$/, /^[🟦]+$/, /^[🟩]+$/, /^[🟨]+$/];
        
        for (const line of lines) {
          const trimmed = line.trim();
          // If line contains emoji squares but isn't all one color, it's an error
          if (!colorPatterns.some(pattern => pattern.test(trimmed))) {
            errors++;
          }
        }
        return errors;
      }
      
      // Special handling for Wordle: count number of lines (guesses)
      if (gameSlug === 'wordle' && parser.score_path === 'count_lines') {
        const lines = shareText.split('\n').filter(line => {
          const trimmed = line.trim();
          // Count lines that contain emoji squares (⬜🟨🟩)
          return /[⬜🟨🟩]/.test(trimmed);
        });
        return lines.length;
      }
      
      // Special handling for Pyramid Scheme: extract time (BuzzFeed / NYT-style share text)
      // Score = total seconds. Formats: "0:23", "1:30", "23 seconds", "23 sec"
      if (gameSlug === 'pyramid-scheme' && parser.score_path === 'time_mm_ss') {
        // MM:SS or M:SS (e.g. 0:23, 1:05)
        const mmSsPatterns = [
          /Solved on Expert Mode in (\d+):(\d+)/i,
          /Solved in (\d+):(\d+)/i,
          /Expert Mode in (\d+):(\d+)/i,
          /Completed in (\d+):(\d+)/i,
          /(?:in|:)\s*(\d+):(\d{1,2})\b/,
          /\b(\d{1,2}):(\d{1,2})\b/,  // "0:23" or "1:30" (allow 1-digit seconds)
        ];
        for (const re of mmSsPatterns) {
          const match = shareText.match(re);
          if (match && match[1] != null && match[2] != null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            if (seconds < 60 && minutes < 60) {
              return minutes * 60 + seconds;
            }
          }
        }
        // "23 seconds" or "23 sec" (seconds only)
        const secOnly = shareText.match(/(\d+)\s*seconds?/i) || shareText.match(/(\d+)\s*sec\b/i);
        if (secOnly && secOnly[1]) {
          const sec = parseInt(secOnly[1], 10);
          if (sec < 3600) return sec; // reasonable for a single game
        }
        // Last resort: "0:23" with flexible formatting (spaces, unicode colon ∶)
        const zeroColon = shareText.match(/0\s*[:\u2236]\s*(\d{1,2})\b/);
        if (zeroColon && zeroColon[1]) {
          const sec = parseInt(zeroColon[1], 10);
          if (sec < 60) return sec;
        }
        // Any "M:SS" or "M:S" with optional spaces around colon
        const anyTime = shareText.match(/(\d{1,2})\s*[:\u2236]\s*(\d{1,2})\b/);
        if (anyTime && anyTime[1] != null && anyTime[2] != null) {
          const minutes = parseInt(anyTime[1], 10);
          const seconds = parseInt(anyTime[2], 10);
          if (seconds < 60 && minutes < 60) return minutes * 60 + seconds;
        }
      }

      // Bracket City: extract score (Atlantic format has "Total Score: 100.0" on its own line)
      if (gameSlug === 'bracket-city') {
        const scorePatterns = [
          /Total Score:\s*(\d+(?:\.\d+)?)/i,
          /Score:\s*(\d+(?:\.\d+)?)/i,
          /score is\s*(\d+(?:\.\d+)?)/i,
          /(\d+(?:\.\d+)?)\s*points?/i,
          /(\d+(?:\.\d+)?)\s*\/\s*\d+/,  // "100/100" style
        ];
        for (const re of scorePatterns) {
          const match = shareText.match(re);
          if (match && match[1]) {
            const score = parseFloat(match[1]);
            if (!isNaN(score) && score >= 0) return score;
          }
        }
      }
      
      // Standard regex extraction
      let regex = new RegExp(parser.pattern, 'm');
      let match = shareText.match(regex);
      if (!match) {
        regex = new RegExp(parser.pattern, 'g');
        match = shareText.match(regex);
      }
      if (match && match[1]) {
        const score = parseFloat(match[1]);
        if (!isNaN(score)) return score;
      }
    }
    
    // URL parameter parsing (for Spelling Bee)
    if (parser.pattern_type === 'url_param') {
      try {
        const url = new URL(shareText);
        const paramValue = url.searchParams.get(parser.pattern);
        if (gameSlug === 'spelling-bee' && parser.score_path === 'spelling_bee_rank') {
          if (paramValue === 'Queen Bee') return 2;
          if (paramValue === 'Genius') return 1;
          return 0;
        }
      } catch (urlErr) {
        // If shareText isn't a valid URL, try to extract from text
        if (gameSlug === 'spelling-bee' && parser.score_path === 'spelling_bee_rank') {
          if (/Queen\s+Bee/i.test(shareText)) return 2;
          if (/Genius/i.test(shareText)) return 1;
          return 0;
        }
      }
    }
    
    // Try matching the whole pattern as a number (fallback)
    const numMatch = shareText.match(/\d+/);
    if (numMatch) {
      let score = parseFloat(numMatch[0]);
      // Pyramid Scheme: first number "0" from "0:23" is wrong — use seconds part instead
      if (gameSlug === 'pyramid-scheme' && score === 0) {
        const allNums = shareText.match(/\d+/g);
        if (allNums && allNums.length >= 2) {
          const seconds = parseInt(allNums[1], 10);
          if (seconds >= 1 && seconds < 60) return seconds; // 0:23 → 23
        }
      }
      // Bracket City: first number "1" from "100" or "Round 1... 100" is wrong — use largest number (the score)
      if (gameSlug === 'bracket-city' && score === 1) {
        const allNums = shareText.match(/\d+(?:\.\d+)?/g);
        if (allNums && allNums.length >= 1) {
          const nums = allNums.map((n) => parseFloat(n)).filter((n) => !isNaN(n) && n > 1);
          if (nums.length > 0) return Math.max(...nums);
        }
      }
      if (!isNaN(score)) return score;
    }
  } catch (err) {
    console.error('Parse error:', err);
    return null;
  }
  
  return null;
}

module.exports = function (supabase) {
  const router = express.Router();

  router.post('/parse', async (req, res) => {
    const { gameId, shareText } = req.body;
    
    if (!gameId || !shareText) {
      return res.status(400).json({ error: 'Missing gameId or shareText' });
    }

    try {
      // Get game info and parser
      const [gameRes, parserRes] = await Promise.all([
        supabase.from('games').select('slug').eq('gameid', gameId).single(),
        supabase.from('game_share_parsers').select('*').eq('game_id', gameId).single()
      ]);
      
      const game = gameRes.data;
      const parser = parserRes.data;
      const gameSlug = game?.slug;
      
      let score = null;
      
      // Keyword can be parsed without a parser row (no share output; extension sends "Time: X, Errors: Y")
      if (gameSlug === 'keyword') {
        score = parseShareString(shareText, parser, gameSlug);
      }
      if ((score === null || isNaN(score)) && !parserRes.error && parser) {
        score = parseShareString(shareText, parser, gameSlug);
      }
      
      // Fallback: try to extract any number from the text
      if (score === null || isNaN(score)) {
        const numbers = shareText.match(/\d+(?:\.\d+)?/g);
        if (numbers && numbers.length > 0) {
          score = parseFloat(numbers[0]);
          // Pyramid Scheme: "0:23" gives numbers [0, 23] — use 23 (seconds), not 0
          if (gameSlug === 'pyramid-scheme' && score === 0 && numbers.length >= 2) {
            const sec = parseFloat(numbers[1]);
            if (sec >= 1 && sec < 3600) score = sec;
          }
          // Bracket City: "1" from "100" or "Round 1... 100" — use largest number (the score)
          if (gameSlug === 'bracket-city' && score <= 1) {
            const nums = numbers.map((n) => parseFloat(n)).filter((n) => !isNaN(n) && n > 1);
            if (nums.length > 0) score = Math.max(...nums);
          }
          // Keyword: "2" from "Time: 12, Errors: 1" — use time + errors*10; try both orderings
          if (gameSlug === 'keyword' && numbers.length >= 2) {
            const a = parseFloat(numbers[0]);
            const b = parseFloat(numbers[1]);
            if (!isNaN(a) && !isNaN(b)) {
              const s1 = a + b * 10;
              const s2 = b + a * 10;
              if (s1 >= 10 && s1 < 2000) score = s1;
              if (s2 >= 10 && s2 < 2000 && s2 > score) score = s2;
            }
          }
        }
      }
      
      if (score === null || isNaN(score)) {
        return res.status(400).json({ error: 'Could not extract score from share text' });
      }

      res.json({ score });
    } catch (err) {
      console.error('Parse error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
