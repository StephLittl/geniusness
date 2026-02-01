const express = require('express');
const { generateInviteCode } = require('../lib/inviteCode');
const wordleWords = require('../lib/wordleWords');
const { getEasternDate } = require('../lib/dateUtils');

module.exports = function (supabase) {
  const router = express.Router();

  router.get('/games', async (req, res) => {
    const { data, error } = await supabase.from('games').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ games: data });
  });

  router.post('/create', async (req, res) => {
    const { name, gameIds, userId, leagueType, startDate, endDate, resetPeriod, customPeriodDays, requiresStartingWord } = req.body;

    if (!name || !gameIds || gameIds.length === 0 || !userId) {
      return res.status(400).json({ error: 'Missing league name, games, or user' });
    }

    if (!leagueType || !['tracking', 'periodic', 'dated'].includes(leagueType)) {
      return res.status(400).json({ error: 'Invalid league type. Must be tracking, periodic, or dated' });
    }

    // Validate periodic league
    if (leagueType === 'periodic') {
      if (!resetPeriod || !['weekly', 'monthly', 'yearly', 'custom'].includes(resetPeriod)) {
        return res.status(400).json({ error: 'Periodic leagues require a reset period (weekly, monthly, yearly, or custom)' });
      }
      if (resetPeriod === 'custom' && (!customPeriodDays || customPeriodDays <= 0)) {
        return res.status(400).json({ error: 'Custom period requires customPeriodDays > 0' });
      }
    }

    // Validate dated league
    if (leagueType === 'dated') {
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Dated leagues require both start and end dates' });
      }
      if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: 'Start date must be before end date' });
      }
    }

    // Validate starting word requirement
    if (requiresStartingWord) {
      // Check if another league already requires a starting word
      const { data: existingStartingWordLeague } = await supabase
        .from('league')
        .select('leagueid, name')
        .eq('requires_starting_word', true)
        .single();
      
      if (existingStartingWordLeague) {
        return res.status(400).json({ 
          error: `Another league ("${existingStartingWordLeague.name}") already requires a starting word. Only one league can have this feature enabled.` 
        });
      }

      // Ensure Wordle is in the selected games
      const { data: wordleGame } = await supabase
        .from('games')
        .select('gameid')
        .eq('slug', 'wordle')
        .single();
      
      if (!wordleGame || !gameIds.includes(wordleGame.gameid)) {
        return res.status(400).json({ 
          error: 'Leagues with required starting words must include Wordle' 
        });
      }
    }

    try {
      let raw = generateInviteCode(8);
      let inviteCode = raw.toUpperCase();
      let attempts = 0;
      const maxAttempts = 5;
      while (attempts < maxAttempts) {
        const { data: existing } = await supabase
          .from('league')
          .select('leagueid')
          .eq('invite_code', inviteCode)
          .single();
        if (!existing) break;
        raw = generateInviteCode(8);
        inviteCode = raw.toUpperCase();
        attempts++;
      }

      const leaguePayload = {
        name,
        invite_code: inviteCode,
        created_by: userId,
        league_type: leagueType,
        requires_starting_word: requiresStartingWord || false,
      };

      // Set dates based on league type
      if (leagueType === 'dated') {
        leaguePayload.start_date = startDate;
        leaguePayload.end_date = endDate;
      } else if (leagueType === 'tracking') {
        // Optional: can set start_date for tracking leagues
        if (startDate) leaguePayload.start_date = startDate;
      } else if (leagueType === 'periodic') {
        // Optional: can set start_date for periodic leagues
        if (startDate) leaguePayload.start_date = startDate;
        leaguePayload.reset_period = resetPeriod;
        if (resetPeriod === 'custom') {
          leaguePayload.custom_period_days = customPeriodDays;
        }
      }

      const { data: leagueData, error: leagueError } = await supabase
        .from('league')
        .insert([leaguePayload])
        .select();
      if (leagueError) throw leagueError;

      const leagueId = leagueData[0].leagueid;
      const leagueStartDate = leagueData[0].start_date || getEasternDate();

      const leagueGameRows = gameIds.map((gameid) => ({
        leagueid: leagueId,
        gameid,
        start_date: leagueStartDate
      }));
      const { error: lgError } = await supabase
        .from('league_game')
        .insert(leagueGameRows);
      if (lgError) throw lgError;

      const { error: lpError } = await supabase
        .from('league_player')
        .insert([{ leagueid: leagueId, userid: userId }]);
      if (lpError) throw lpError;

      res.status(201).json({ leagueId, inviteCode });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/my', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const { data: memberships, error: memErr } = await supabase
      .from('league_player')
      .select('leagueid')
      .eq('userid', userId);
    if (memErr) return res.status(500).json({ error: memErr.message });

    const leagueIds = (memberships || []).map((m) => m.leagueid);
    if (leagueIds.length === 0) return res.json({ leagues: [] });

    const { data: leagues, error } = await supabase
      .from('league')
      .select('leagueid, name, invite_code, start_date, end_date, created_by, created_at')
      .in('leagueid', leagueIds)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const today = getEasternDate();
    const leaguesWithGames = await Promise.all(
      leagues.map(async (l) => {
        const { data: lg } = await supabase
          .from('league_game')
          .select('gameid')
          .eq('leagueid', l.leagueid)
          .lte('start_date', today)
          .or(`end_date.is.null,end_date.gte.${today}`);
        const gameIds = (lg || []).map((g) => g.gameid);
        let games = [];
        if (gameIds.length) {
          const { data: g } = await supabase.from('games').select('*').in('gameid', gameIds);
          games = g || [];
        }
        return { ...l, games };
      })
    );

    res.json({ leagues: leaguesWithGames });
  });

  router.get('/:id', async (req, res) => {
    const { id } = req.params;

    const { data: league, error: leagueErr } = await supabase
      .from('league')
      .select('*')
      .eq('leagueid', id)
      .single();
    if (leagueErr || !league) return res.status(404).json({ error: 'League not found' });

    const today = getEasternDate();
    const { data: lg } = await supabase
      .from('league_game')
      .select('gameid')
      .eq('leagueid', id)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`);
    const gameIds = (lg || []).map((g) => g.gameid);
    let games = [];
    if (gameIds.length) {
      const { data: g } = await supabase.from('games').select('*').in('gameid', gameIds);
      games = g || [];
    }

    const { data: players } = await supabase
      .from('league_player')
      .select('userid')
      .eq('leagueid', id);
    const userIds = (players || []).map((p) => p.userid);
    let users = [];
    if (userIds.length) {
      const { data: u } = await supabase
        .from('users')
        .select('user_id, username, first_name, last_name, email')
        .in('user_id', userIds);
      users = u || [];
    }

    res.json({ ...league, games, players: users });
  });

  // Add games to a league (with optional start_date for backdating)
  router.post('/:id/games', async (req, res) => {
    const { id: leagueId } = req.params;
    const { gameIds, startDate } = req.body;
    if (!gameIds || !Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ error: 'Missing gameIds array' });
    }

    const { data: league, error: leagueErr } = await supabase
      .from('league')
      .select('leagueid')
      .eq('leagueid', leagueId)
      .single();
    if (leagueErr || !league) return res.status(404).json({ error: 'League not found' });

    const today = getEasternDate();
    const effectiveStart = startDate || today;

    // Filter out games already active in this league
    const { data: existing } = await supabase
      .from('league_game')
      .select('gameid')
      .eq('leagueid', leagueId)
      .in('gameid', gameIds)
      .is('end_date', null);
    const alreadyActive = new Set((existing || []).map((e) => e.gameid));
    const toAdd = gameIds.filter((g) => !alreadyActive.has(g));
    if (toAdd.length === 0) {
      return res.status(400).json({ error: 'All games are already in the league' });
    }

    const rows = toAdd.map((gameid) => ({
      leagueid: leagueId,
      gameid,
      start_date: effectiveStart
    }));
    const { error: insertErr } = await supabase
      .from('league_game')
      .insert(rows);
    if (insertErr) return res.status(400).json({ error: insertErr.message });
    res.status(201).json({ success: true });
  });

  // Drop a game from a league (sets end_date to today)
  router.patch('/:id/games/:gameId', async (req, res) => {
    const { id: leagueId, gameId } = req.params;

    const { data: active, error: findErr } = await supabase
      .from('league_game')
      .select('id')
      .eq('leagueid', leagueId)
      .eq('gameid', gameId)
      .is('end_date', null)
      .single();
    if (findErr || !active) return res.status(404).json({ error: 'Game not found or already dropped' });

    const today = getEasternDate();
    const { error: updateErr } = await supabase
      .from('league_game')
      .update({ end_date: today })
      .eq('id', active.id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    res.json({ success: true });
  });

  router.post('/join', async (req, res) => {
    const { userId, inviteCode } = req.body;
    if (!userId || !inviteCode) {
      return res.status(400).json({ error: 'Missing userId or inviteCode' });
    }

    const { data: league, error: leagueErr } = await supabase
      .from('league')
      .select('leagueid, name, start_date, end_date')
      .eq('invite_code', String(inviteCode).trim().toUpperCase())
      .single();
    if (leagueErr || !league) return res.status(404).json({ error: 'Invalid invite code' });

    const now = new Date();
    const end = league.end_date ? new Date(league.end_date) : null;
    if (end && end < now) {
      return res.status(400).json({ error: 'This league has ended' });
    }

    const { error: joinErr } = await supabase
      .from('league_player')
      .upsert([{ leagueid: league.leagueid, userid: userId }], {
        onConflict: ['leagueid', 'userid'],
      });
    if (joinErr) return res.status(400).json({ error: joinErr.message });

    res.status(200).json({ leagueId: league.leagueid, name: league.name });
  });

  // Get or generate today's starting Wordle word
  router.get('/starting-word/today', async (req, res) => {
    try {
      // Find the league that requires a starting word
      const { data: league, error: leagueErr } = await supabase
        .from('league')
        .select('leagueid, name')
        .eq('requires_starting_word', true)
        .single();

      if (leagueErr || !league) {
        return res.json({ word: null, leagueName: null });
      }

      const today = getEasternDate();

      // Check if we already have a word for today
      const { data: existingWord, error: wordErr } = await supabase
        .from('league_starting_words')
        .select('word')
        .eq('league_id', league.leagueid)
        .eq('date', today)
        .single();

      if (wordErr && wordErr.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching starting word:', wordErr);
        return res.status(500).json({ error: 'Failed to fetch starting word' });
      }

      if (existingWord) {
        return res.json({ word: existingWord.word, leagueName: league.name });
      }

      // Generate a new word for today
      if (!wordleWords || wordleWords.length === 0) {
        return res.status(500).json({ error: 'Word list is empty. Please populate wordleWords.js' });
      }

      // Use date as seed for consistent word selection per day
      // Simple hash function to convert date string to a number
      const dateHash = today.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
      }, 0);
      const seed = Math.abs(dateHash);
      const wordIndex = seed % wordleWords.length;
      const selectedWord = wordleWords[wordIndex].toUpperCase();

      // Save the word to the database
      const { error: insertErr } = await supabase
        .from('league_starting_words')
        .insert([{
          league_id: league.leagueid,
          date: today,
          word: selectedWord
        }]);

      if (insertErr) {
        console.error('Error saving starting word:', insertErr);
        return res.status(500).json({ error: 'Failed to save starting word' });
      }

      res.json({ word: selectedWord, leagueName: league.name });
    } catch (err) {
      console.error('Error in starting-word/today:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
