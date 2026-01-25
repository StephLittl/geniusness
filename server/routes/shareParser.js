const express = require('express');

function parseShareString(shareText, parser, gameSlug) {
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
      
      // Special handling for Pyramid Scheme: extract time in MM:SS format
      if (gameSlug === 'pyramid-scheme' && parser.score_path === 'time_mm_ss') {
        const match = shareText.match(/Solved on Expert Mode in (\d+):(\d+)/);
        if (match && match[1] && match[2]) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          return minutes * 60 + seconds; // Return total seconds
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
      const score = parseFloat(numMatch[0]);
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
      
      if (!parserRes.error && parser) {
        score = parseShareString(shareText, parser, gameSlug);
      }
      
      // Fallback: try to extract any number from the text
      if (score === null || isNaN(score)) {
        const numbers = shareText.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          // Try the first number found
          score = parseFloat(numbers[0]);
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
