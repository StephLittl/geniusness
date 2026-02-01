const express = require('express');
const { getEasternDate } = require('../lib/dateUtils');

module.exports = function (supabase) {
  const router = express.Router();

  router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    
    // Get user's selected games
    const { data: userGamesData, error: userGamesError } = await supabase
      .from('user_games')
      .select('game_id, games(*)')
      .eq('user_id', userId);
    if (userGamesError) return res.status(400).json({ error: userGamesError.message });
    
    // Get all games from leagues user is in
    const { data: leagueMemberships } = await supabase
      .from('league_player')
      .select('leagueid')
      .eq('userid', userId);
    
    const leagueIds = (leagueMemberships || []).map(m => m.leagueid);
    let leagueGameIds = [];
    if (leagueIds.length) {
      const today = getEasternDate();
      const { data: leagueGamesData } = await supabase
        .from('league_game')
        .select('gameid')
        .in('leagueid', leagueIds)
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`);
      leagueGameIds = [...new Set((leagueGamesData || []).map(lg => lg.gameid))];
    }
    
    // Get all available games
    const { data: allGames } = await supabase.from('games').select('*');
    
    // Combine: user games + league games
    const userGameIds = new Set((userGamesData || []).map(d => d.game_id));
    const leagueGameIdsSet = new Set(leagueGameIds);
    const combinedGameIds = new Set([...userGameIds, ...leagueGameIdsSet]);
    
    const games = (allGames || [])
      .filter(g => combinedGameIds.has(g.gameid))
      .map(g => ({
        ...g,
        inUserGames: userGameIds.has(g.gameid),
        inLeagueGames: leagueGameIdsSet.has(g.gameid)
      }));
    
    res.json({ games });
  });

  router.post('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { gameIds } = req.body;
    if (!Array.isArray(gameIds)) {
      return res.status(400).json({ error: 'gameIds must be an array' });
    }
    const rows = gameIds.map(gameId => ({ user_id: userId, game_id: gameId }));
    const { error } = await supabase
      .from('user_games')
      .upsert(rows, { onConflict: 'user_id,game_id' });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  router.delete('/:userId/:gameId', async (req, res) => {
    const { userId, gameId } = req.params;
    const { error } = await supabase
      .from('user_games')
      .delete()
      .eq('user_id', userId)
      .eq('game_id', gameId);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  return router;
};
