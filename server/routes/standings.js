const express = require('express');
const { getEasternDate } = require('../lib/dateUtils');

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

      // Get all users in this league
      const { data: leaguePlayers, error: playersErr } = await supabase
        .from('league_player')
        .select('userid')
        .eq('leagueid', leagueId);
      
      if (playersErr) {
        return res.status(500).json({ error: playersErr.message });
      }
      
      const leagueUserIds = (leaguePlayers || []).map(p => p.userid);
      
      if (leagueUserIds.length === 0) {
        return res.json({
          league,
          overallStandings: [],
          dailyStandings: {},
          gameStandings: {}
        });
      }

      // Get all scores for users in this league
      const { data: scores, error: scoresErr } = await supabase
        .from('scores')
        .select('id, user_id, game_id, date, score')
        .in('user_id', leagueUserIds)
        .order('date', { ascending: true });
      
      if (scoresErr) {
        return res.status(500).json({ error: scoresErr.message });
      }

      // Get all league_game rows (with dates) for historical filtering
      const { data: leagueGames } = await supabase
        .from('league_game')
        .select('gameid, start_date, end_date, games(*)')
        .eq('leagueid', leagueId);
      
      const gameMap = {};
      for (const lg of leagueGames || []) {
        gameMap[lg.gameid] = lg.games;
      }

      // Helper: games active in the league on a given date
      function gamesActiveOnDate(dateStr) {
        const date = dateStr;
        return (leagueGames || [])
          .filter(lg => lg.start_date <= date && (!lg.end_date || lg.end_date >= date))
          .map(lg => lg.gameid);
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

      // Fetch handicaps for this league (any that might apply to score dates)
      const scoreDates = Object.keys(scoresByDate);
      const minDate = scoreDates.length ? scoreDates.sort()[0] : null;
      const maxDate = scoreDates.length ? scoreDates.sort().reverse()[0] : null;
      let handicaps = [];
      if (minDate && maxDate) {
        const { data: handicapRows } = await supabase
          .from('league_handicap')
          .select('*')
          .eq('league_id', leagueId)
          .lte('start_date', maxDate)
          .or(`end_date.is.null,end_date.gte.${minDate}`);
        handicaps = handicapRows || [];
      }

      // Day of week from YYYY-MM-DD (0=Sun, 1=Mon, ... 6=Sat)
      function getDayOfWeek(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).getDay();
      }

      // Get adjusted score for ranking: raw * handicap multiplier for (league, user, game, date)
      function getAdjustedScore(rawScore, userId, gameId, dateStr) {
        const dow = String(getDayOfWeek(dateStr));
        const h = handicaps.find(
          x =>
            x.user_id === userId &&
            x.game_id === gameId &&
            dateStr >= x.start_date &&
            (x.end_date == null || dateStr <= x.end_date)
        );
        const mult = h?.day_multipliers?.[dow];
        const multiplier = mult != null ? Number(mult) : 1;
        return Number(rawScore) * multiplier;
      }

      // For each date, compute game rankings and daily totals
      const dailyTotals = {}; // { date: { userId: totalPoints } }
      const gameStandings = {}; // { gameId: { date: { userId: points } } }

      for (const date of Object.keys(scoresByDate).sort()) {
        const dateScores = scoresByDate[date];
        dailyTotals[date] = {};
        const gameIdsForDate = gamesActiveOnDate(date);

        // Initialize daily totals for all players
        for (const userId of userIds) {
          dailyTotals[date][userId] = 0;
        }

        // For each game active on this date, rank players by adjusted score and assign points
        for (const gameId of gameIdsForDate) {
          const gameScores = dateScores.filter(s => s.game_id === gameId);
          if (gameScores.length === 0) continue;

          const game = gameMap[gameId];
          const isLowerBetter = game?.score_type === 'lower_better';

          // Sort by adjusted score (handicap applied per day-of-week and date range)
          gameScores.sort((a, b) => {
            const aAdj = getAdjustedScore(a.score, a.user_id, a.game_id, date);
            const bAdj = getAdjustedScore(b.score, b.user_id, b.game_id, date);
            return isLowerBetter ? aAdj - bAdj : bAdj - aAdj;
          });

          // Assign points with tie handling (using adjusted score for tie-breaking)
          const ranked = assignPoints(gameScores, s =>
            getAdjustedScore(s.score, s.user_id, s.game_id, date)
          );
          
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
