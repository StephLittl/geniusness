const express = require('express');

module.exports = function (supabase) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { user_id, league_id, game_id, date, score } = req.body;

    if (!user_id || !league_id || !game_id || !date || score == null) {
      return res.status(400).json({ error: 'Missing user_id, league_id, game_id, date, or score' });
    }

    const { data, error } = await supabase
      .from('scores')
      .upsert([{ user_id, league_id, game_id, date, score }], {
        onConflict: 'user_id,league_id,game_id,date',
      })
      .select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data?.[0] ?? { user_id, league_id, game_id, date, score });
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
