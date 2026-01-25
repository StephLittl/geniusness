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

    if (!user_id || !game_id || !date || score == null) {
      return res.status(400).json({ error: 'Missing user_id, game_id, date, or score' });
    }

    // Convert score to number if it's a string
    const scoreNum = typeof score === 'string' ? parseFloat(score) : Number(score);
    if (isNaN(scoreNum)) {
      return res.status(400).json({ error: 'Score must be a valid number' });
    }

    // Use Eastern date for consistency - ignore client date and use server date
    const easternDate = getEasternDate();
    console.log('Saving daily score:', { 
      user_id, 
      game_id, 
      clientDate: date, 
      serverEasternDate: easternDate, 
      score: scoreNum 
    });

    // Find all leagues the user is in that include this game
    const { data: memberships } = await supabase
      .from('league_player')
      .select('leagueid')
      .eq('userid', user_id);
    
    const leagueIds = memberships && memberships.length > 0 ? memberships.map(m => m.leagueid) : [];
    
    // Find which leagues include this game (if any)
    let relevantLeagueIds = [];
    if (leagueIds.length > 0) {
      const { data: leagueGames } = await supabase
        .from('league_game')
        .select('leagueid')
        .in('leagueid', leagueIds)
        .eq('gameid', game_id);
      
      relevantLeagueIds = leagueGames ? leagueGames.map(lg => lg.leagueid) : [];
    }

    // Get or create a personal league for the user (for scores without leagues)
    let personalLeagueId = null;
    if (relevantLeagueIds.length === 0) {
      // Check if user has a personal league
      const { data: personalLeague } = await supabase
        .from('league')
        .select('leagueid')
        .eq('created_by', user_id)
        .eq('name', 'Personal')
        .single();
      
      if (personalLeague) {
        personalLeagueId = personalLeague.leagueid;
      } else {
        // Create a personal league for the user
        const { data: newLeague, error: leagueError } = await supabase
          .from('league')
          .insert([{
            name: 'Personal',
            created_by: user_id,
            duration_type: 'indefinite',
            is_repeating: false
          }])
          .select()
          .single();
        
        if (leagueError) {
          console.error('Error creating personal league:', leagueError);
          return res.status(400).json({ error: 'Failed to create personal league' });
        }
        
        personalLeagueId = newLeague.leagueid;
        
        // Add user as player
        await supabase
          .from('league_player')
          .insert([{ leagueid: personalLeagueId, userid: user_id }]);
      }
      
      // Ensure the game is in the personal league
      const { data: existingGame } = await supabase
        .from('league_game')
        .select('gameid')
        .eq('leagueid', personalLeagueId)
        .eq('gameid', game_id)
        .single();
      
      if (!existingGame) {
        await supabase
          .from('league_game')
          .insert([{ leagueid: personalLeagueId, gameid: game_id }]);
      }
      
      relevantLeagueIds = [personalLeagueId];
    }

    // Save score to all relevant leagues
    const scoreRows = relevantLeagueIds.map(league_id => ({
      user_id,
      league_id,
      game_id,
      date: easternDate, // Use Eastern date consistently
      score: scoreNum
    }));

    const { data, error } = await supabase
      .from('scores')
      .upsert(scoreRows, {
        onConflict: ['user_id', 'league_id', 'game_id', 'date'],
      })
      .select();

    if (error) {
      console.error('Daily score save error:', error);
      return res.status(400).json({ error: error.message });
    }
    
    console.log('Daily score saved to leagues:', relevantLeagueIds, 'with date:', easternDate);
    
    res.status(201).json({ 
      scores: data || [],
      leagues: relevantLeagueIds 
    });
  });

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
    // Get today's date in Eastern time zone
    const today = getEasternDate();
    console.log('=== FETCH SCORES DEBUG ===');
    console.log('Current UTC time:', new Date().toISOString());
    console.log('Eastern date calculated:', today);
    console.log('Fetching scores for today (Eastern):', today, 'for user:', userId);
    
    // First, let's check what dates exist in the database for this user
    const { data: allUserScores, error: checkError } = await supabase
      .from('scores')
      .select('date, game_id, score')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(10);
    
    console.log('=== FETCH SCORES DEBUG ===');
    console.log('Query date (Eastern):', today);
    console.log('User ID:', userId);
    if (!checkError && allUserScores) {
      console.log('Recent scores for user (last 10):', allUserScores.map(s => ({ date: s.date, game_id: s.game_id, score: s.score })));
      const uniqueDates = [...new Set(allUserScores.map(s => s.date))];
      console.log('Unique dates in DB:', uniqueDates);
      console.log('Query date matches any?', uniqueDates.includes(today));
    } else if (checkError) {
      console.log('Error checking recent scores:', checkError);
    } else {
      console.log('No scores found for user at all');
    }
    
    const { data: scores, error } = await supabase
      .from('scores')
      .select('id, user_id, league_id, game_id, date, score')
      .eq('user_id', userId)
      .eq('date', today);
    if (error) {
      console.error('Error fetching scores:', error);
      return res.status(400).json({ error: error.message });
    }
    console.log('Found scores for date', today, ':', scores?.length || 0);
    if (scores && scores.length > 0) {
      console.log('Sample score:', { game_id: scores[0].game_id, date: scores[0].date, score: scores[0].score });
    }
    
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
    
    // Always return debug info when no scores found
    if (!scores || scores.length === 0) {
      const datesInDb = allUserScores && allUserScores.length > 0 
        ? [...new Set(allUserScores.map(s => s.date))]
        : [];
      
      console.log('=== NO SCORES FOUND - RETURNING DEBUG INFO ===');
      console.log('Query date:', today);
      console.log('User ID:', userId);
      console.log('Dates found in DB for this user:', datesInDb);
      console.log('Query date matches?', datesInDb.includes(today));
      
      const debugResponse = { 
        scores: [],
        debug: {
          queryDate: today,
          datesInDatabase: datesInDb,
          recentScores: allUserScores ? allUserScores.slice(0, 5).map(s => ({ date: s.date, game_id: s.game_id, score: s.score })) : [],
          allUserScoresCount: allUserScores?.length || 0,
          userId: userId
        }
      };
      console.log('Sending debug response:', JSON.stringify(debugResponse, null, 2));
      return res.json(debugResponse);
    }
    
    // Return the enriched scores when found
    console.log('Returning', enriched.length, 'scores');
    res.json({ scores: enriched || [] });
  });

  // Test endpoint to verify date calculation
  router.get('/test-date', (req, res) => {
    const easternDate = getEasternDate();
    const now = new Date();
    res.json({
      utcTime: now.toISOString(),
      easternDate: easternDate,
      easternTimeString: now.toLocaleString('en-US', { timeZone: 'America/New_York' })
    });
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
