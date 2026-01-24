const express = require('express');

module.exports = function (supabase) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { user_id, league_id, game_id, date, score } = req.body;

    if (!user_id || !league_id || !game_id || !date || score == null) {
      return res.status(400).json({ error: 'Missing user_id, league_id, game_id, date, or score' });
    }

    // Convert score to number if it's a string
    const scoreNum = typeof score === 'string' ? parseFloat(score) : Number(score);
    if (isNaN(scoreNum)) {
      return res.status(400).json({ error: 'Score must be a valid number' });
    }

    console.log('Saving score:', { user_id, league_id, game_id, date, score: scoreNum });

    // Verify user is in the league
    const { data: membership } = await supabase
      .from('league_player')
      .select('leagueid')
      .eq('leagueid', league_id)
      .eq('userid', user_id)
      .single();
    
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this league' });
    }

    // Verify game is in the league
    const { data: leagueGame } = await supabase
      .from('league_game')
      .select('gameid')
      .eq('leagueid', league_id)
      .eq('gameid', game_id)
      .single();
    
    if (!leagueGame) {
      return res.status(400).json({ error: 'This game is not part of this league' });
    }

    const { data, error } = await supabase
      .from('scores')
      .upsert([{ user_id, league_id, game_id, date, score: scoreNum }], {
        onConflict: ['user_id', 'league_id', 'game_id', 'date'],
      })
      .select();

    if (error) {
      console.error('Score save error:', error);
      return res.status(400).json({ error: error.message });
    }
    
    console.log('Score saved successfully:', data?.[0]);
    res.status(201).json(data?.[0] ?? { user_id, league_id, game_id, date, score: scoreNum });
  });

  router.get('/stats', async (req, res) => {
    const { userId, leagueId, gameId, from, to } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    let q = supabase
      .from('scores')
      .select('id, user_id, league_id, game_id, date, score, created_at')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (leagueId) q = q.eq('league_id', leagueId);
    if (gameId) q = q.eq('game_id', gameId);
    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);

    const { data: scores, error } = await q;
    if (error) return res.status(400).json({ error: error.message });

    let games = [];
    const gids = [...new Set((scores || []).map((s) => s.game_id))];
    if (gids.length) {
      const { data: g } = await supabase.from('games').select('gameid, name, slug, score_type').in('gameid', gids);
      games = g || [];
    }
    const gameMap = Object.fromEntries(games.map((g) => [g.gameid, g]));

    const withGame = (scores || []).map((s) => ({
      ...s,
      game: gameMap[s.game_id] || null,
    }));

    res.json({ scores: withGame });
  });

  router.get('/league/:league_id', async (req, res) => {
    const { league_id } = req.params;
    const { from, to } = req.query;

    let q = supabase
      .from('scores')
      .select('id, user_id, league_id, game_id, date, score, created_at')
      .eq('league_id', league_id)
      .order('date', { ascending: false });

    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);

    const { data: scores, error } = await q;
    if (error) return res.status(400).json({ error: error.message });

    const gids = [...new Set((scores || []).map((s) => s.game_id))];
    let games = [];
    if (gids.length) {
      const { data: g } = await supabase.from('games').select('gameid, name, slug, score_type').in('gameid', gids);
      games = g || [];
    }
    const gameMap = Object.fromEntries(games.map((g) => [g.gameid, g]));

    const uids = [...new Set((scores || []).map((s) => s.user_id))];
    let users = [];
    if (uids.length) {
      const { data: u } = await supabase.from('users').select('user_id, username').in('user_id', uids);
      users = u || [];
    }
    const userMap = Object.fromEntries(users.map((u) => [u.user_id, u]));

    const enriched = (scores || []).map((s) => ({
      ...s,
      game: gameMap[s.game_id] || null,
      user: userMap[s.user_id] || null,
    }));

    res.json({ scores: enriched });
  });

  router.get('/today/:userId', async (req, res) => {
    const { userId } = req.params;
    const today = new Date().toISOString().slice(0, 10);
    const { data: scores, error } = await supabase
      .from('scores')
      .select('id, user_id, league_id, game_id, date, score')
      .eq('user_id', userId)
      .eq('date', today);
    if (error) return res.status(400).json({ error: error.message });
    
    // Enrich with game and league data
    const gids = [...new Set((scores || []).map(s => s.game_id))];
    const lids = [...new Set((scores || []).map(s => s.league_id))];
    
    let games = [];
    let leagues = [];
    if (gids.length) {
      const { data: g } = await supabase.from('games').select('*').in('gameid', gids);
      games = g || [];
    }
    if (lids.length) {
      const { data: l } = await supabase.from('league').select('leagueid, name').in('leagueid', lids);
      leagues = l || [];
    }
    
    const gameMap = Object.fromEntries(games.map(g => [g.gameid, g]));
    const leagueMap = Object.fromEntries(leagues.map(l => [l.leagueid, l]));
    
    const enriched = (scores || []).map(s => ({
      ...s,
      game: gameMap[s.game_id] || null,
      league: leagueMap[s.league_id] || null
    }));
    
    res.json({ scores: enriched });
  });

  router.get('/:league_id/:date', async (req, res) => {
    const { league_id, date } = req.params;

    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('league_id', league_id)
      .eq('date', date);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  return router;
};
