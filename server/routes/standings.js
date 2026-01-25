const express = require('express');

// Helper function to assign points with tie handling
// Returns array of { userId, points } sorted by rank
function assignPoints(rankedItems, getScore) {
  if (rankedItems.length === 0) return [];
  
  const result = [];
  let currentRank = 1;
  let i = 0;
  
  while (i < rankedItems.length) {
    const currentScore = getScore(rankedItems[i]);
    const tiedGroup = [rankedItems[i]];
    let j = i + 1;
    
    // Find all items with the same score (ties)
    while (j < rankedItems.length && getScore(rankedItems[j]) === currentScore) {
      tiedGroup.push(rankedItems[j]);
      j++;
    }
    
    // All tied items get the same points (currentRank)
    const points = currentRank;
    for (const item of tiedGroup) {
      result.push({ ...item, points });
    }
    
    // Next rank is currentRank + tiedGroup.length
    currentRank += tiedGroup.length;
    i = j;
  }
  
  return result;
}

module.exports = function (supabase) {
  const router = express.Router();

  router.get('/:leagueId', async (req, res) => {
    const { leagueId } = req.params;
    
    try {
      // Get league info
      const { data: league, error: leagueErr } = await supabase
        .from('league')
        .select('*')
        .eq('leagueid', leagueId)
        .single();
      
      if (leagueErr || !league) {
        return res.status(404).json({ error: 'League not found' });
      }

      // Get all scores for this league
      const { data: scores, error: scoresErr } = await supabase
        .from('scores')
        .select('id, user_id, league_id, game_id, date, score')
        .eq('league_id', leagueId)
        .order('date', { ascending: true });
      
      if (scoresErr) {
        return res.status(500).json({ error: scoresErr.message });
      }

      // Get games and users
      const { data: games } = await supabase
        .from('league_game')
        .select('gameid, games(*)')
        .eq('leagueid', leagueId);
      
      const gameIds = (games || []).map(g => g.gameid);
      const gameMap = {};
      for (const g of games || []) {
        gameMap[g.gameid] = g.games;
      }

      const { data: players } = await supabase
        .from('league_player')
        .select('userid')
        .eq('leagueid', leagueId);
      
      const userIds = (players || []).map(p => p.userid);
      
      let userMap = {};
      if (userIds.length) {
        const { data: users } = await supabase
          .from('users')
          .select('user_id, username')
          .in('user_id', userIds);
        userMap = Object.fromEntries((users || []).map(u => [u.user_id, u]));
      }

      if (scores.length === 0) {
        return res.json({
          league,
          overallStandings: [],
          dailyStandings: {},
          gameStandings: {}
        });
      }

      // Group scores by date
      const scoresByDate = {};
      for (const score of scores) {
        if (!scoresByDate[score.date]) {
          scoresByDate[score.date] = [];
        }
        scoresByDate[score.date].push(score);
      }

      // For each date, compute game rankings and daily totals
      const dailyTotals = {}; // { date: { userId: totalPoints } }
      const gameStandings = {}; // { gameId: { date: { userId: points } } }

      for (const date of Object.keys(scoresByDate).sort()) {
        const dateScores = scoresByDate[date];
        dailyTotals[date] = {};
        
        // Initialize daily totals for all players
        for (const userId of userIds) {
          dailyTotals[date][userId] = 0;
        }

        // For each game, rank players and assign points
        for (const gameId of gameIds) {
          const gameScores = dateScores.filter(s => s.game_id === gameId);
          if (gameScores.length === 0) continue;

          const game = gameMap[gameId];
          const isLowerBetter = game?.score_type === 'lower_better';
          
          // Sort by score (lower is better or higher is better)
          gameScores.sort((a, b) => {
            const aScore = Number(a.score);
            const bScore = Number(b.score);
            return isLowerBetter ? aScore - bScore : bScore - aScore;
          });

          // Assign points with tie handling
          const ranked = assignPoints(gameScores, s => Number(s.score));
          
          // Store game standings
          if (!gameStandings[gameId]) {
            gameStandings[gameId] = {};
          }
          gameStandings[gameId][date] = {};
          for (const item of ranked) {
            gameStandings[gameId][date][item.user_id] = item.points;
            dailyTotals[date][item.user_id] += item.points;
          }
        }
      }

      // Rank days by daily totals (lower total is better)
      const dailyRankings = [];
      for (const date of Object.keys(dailyTotals).sort()) {
        const totals = dailyTotals[date];
        const dayData = userIds.map(userId => ({
          userId,
          totalPoints: totals[userId] || 0
        }));
        
        // Sort by total points (lower is better)
        dayData.sort((a, b) => a.totalPoints - b.totalPoints);
        
        // Assign points for the day
        const dayRanked = assignPoints(dayData, d => d.totalPoints);
        dailyRankings.push({ date, rankings: dayRanked });
      }

      // Calculate overall standings (sum of daily points)
      const overallPoints = {};
      for (const userId of userIds) {
        overallPoints[userId] = 0;
      }

      for (const day of dailyRankings) {
        for (const ranking of day.rankings) {
          overallPoints[ranking.userId] += ranking.points;
        }
      }

      // Sort overall standings (lower is better)
      const overallStandings = userIds.map(userId => ({
        userId,
        username: userMap[userId]?.username || '—',
        totalPoints: overallPoints[userId]
      })).sort((a, b) => a.totalPoints - b.totalPoints);

      res.json({
        league,
        overallStandings,
        dailyStandings: Object.fromEntries(
          dailyRankings.map(d => [d.date, d.rankings])
        ),
        gameStandings
      });
    } catch (err) {
      console.error('Standings error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
