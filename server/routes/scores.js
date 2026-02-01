const express = require('express');

// Helper function to get today's date in Eastern time zone
function getEasternDate() {
  const now = new Date();
  // Convert to Eastern time using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // 'en-CA' format gives us YYYY-MM-DD directly
  return formatter.format(now);
}

module.exports = function (supabase) {
  const router = express.Router();

  router.post('/daily', async (req, res) => {
    const { user_id, game_id, date, score } = req.body;

    if (!user_id || !game_id || score == null) {
      return res.status(400).json({ error: 'Missing user_id, game_id, date, or score' });
    }

    // Convert score to number if it's a string
    const scoreNum = typeof score === 'string' ? parseFloat(score) : Number(score);
    if (isNaN(scoreNum)) {
      return res.status(400).json({ error: 'Score must be a valid number' });
    }

    // Use Eastern date for consistency (client date ignored; extension may omit date)
    const easternDate = getEasternDate();

    // Save score (one per user/game/date, league-agnostic)
    const { data, error } = await supabase
      .from('scores')
      .upsert([{
        user_id,
        game_id,
        date: easternDate,
        score: scoreNum
      }], {
        onConflict: ['user_id', 'game_id', 'date'],
      })
      .select()
      .single();

    if (error) {
      console.error('Daily score save error:', error);
      return res.status(400).json({ error: error.message });
    }
    
    res.status(201).json({ score: data });
  });

  router.post('/', async (req, res) => {
    const { user_id, game_id, date, score } = req.body;

    if (!user_id || !game_id || !date || score == null) {
      return res.status(400).json({ error: 'Missing user_id, game_id, date, or score' });
    }

    // Convert score to number if it's a string
    const scoreNum = typeof score === 'string' ? parseFloat(score) : Number(score);
    if (isNaN(scoreNum)) {
      return res.status(400).json({ error: 'Score must be a valid number' });
    }

    // Save score (league-agnostic)
    const { data, error } = await supabase
      .from('scores')
      .upsert([{ user_id, game_id, date, score: scoreNum }], {
        onConflict: ['user_id', 'game_id', 'date'],
      })
      .select()
      .single();

    if (error) {
      console.error('Score save error:', error);
      return res.status(400).json({ error: error.message });
    }
    
    res.status(201).json(data ?? { user_id, game_id, date, score: scoreNum });
  });

  router.get('/stats', async (req, res) => {
    const { userId, leagueId, gameId, from, to } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // Build base query
    let q = supabase
      .from('scores')
      .select('id, user_id, game_id, date, score, created_at')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    // If filtering by league, we need to join through league_player
    if (leagueId) {
      // Get all users in this league
      const { data: leaguePlayers } = await supabase
        .from('league_player')
        .select('userid')
        .eq('leagueid', leagueId);
      
      const leagueUserIds = (leaguePlayers || []).map(p => p.userid);
      
      // Only include scores from users in this league
      if (leagueUserIds.length > 0) {
        q = q.in('user_id', leagueUserIds);
      } else {
        // No players in league, return empty
        return res.json({ scores: [] });
      }
    }
    
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

    // Get all users in this league
    const { data: leaguePlayers, error: playersError } = await supabase
      .from('league_player')
      .select('userid')
      .eq('leagueid', league_id);
    
    if (playersError) return res.status(400).json({ error: playersError.message });
    
    const leagueUserIds = (leaguePlayers || []).map(p => p.userid);
    
    if (leagueUserIds.length === 0) {
      return res.json({ scores: [] });
    }

    // Get scores for users in this league
    let q = supabase
      .from('scores')
      .select('id, user_id, game_id, date, score, created_at')
      .in('user_id', leagueUserIds)
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
    // Get today's date in Eastern time zone
    const today = getEasternDate();
    
    const { data: scores, error } = await supabase
      .from('scores')
      .select('id, user_id, game_id, date, score')
      .eq('user_id', userId)
      .eq('date', today);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    // Enrich with game data
    const gids = [...new Set((scores || []).map(s => s.game_id))];
    
    let games = [];
    if (gids.length) {
      const { data: g } = await supabase.from('games').select('*').in('gameid', gids);
      games = g || [];
    }
    
    const gameMap = Object.fromEntries(games.map(g => [g.gameid, g]));
    
    const enriched = (scores || []).map(s => ({
      ...s,
      game: gameMap[s.game_id] || null
    }));
    
    // Return the enriched scores
    res.json({ scores: enriched || [] });
  });

  router.get('/:league_id/:date', async (req, res) => {
    const { league_id, date } = req.params;

    // Get all users in this league
    const { data: leaguePlayers, error: playersError } = await supabase
      .from('league_player')
      .select('userid')
      .eq('leagueid', league_id);
    
    if (playersError) return res.status(400).json({ error: playersError.message });
    
    const leagueUserIds = (leaguePlayers || []).map(p => p.userid);
    
    if (leagueUserIds.length === 0) {
      return res.json([]);
    }

    // Get scores for users in this league for the specified date
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .in('user_id', leagueUserIds)
      .eq('date', date);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  return router;
};
