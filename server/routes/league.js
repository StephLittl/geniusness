const express = require('express');
const { generateInviteCode } = require('../lib/inviteCode');

module.exports = function (supabase) {
  const router = express.Router();

  router.get('/games', async (req, res) => {
    const { data, error } = await supabase.from('games').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ games: data });
  });

  router.post('/create', async (req, res) => {
    const { name, gameIds, userId, startDate, endDate, durationType, isRepeating } = req.body;

    if (!name || !gameIds || gameIds.length === 0 || !userId) {
      return res.status(400).json({ error: 'Missing league name, games, or user' });
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
        duration_type: durationType || 'indefinite',
        is_repeating: isRepeating || false,
      };
      if (startDate) leaguePayload.start_date = startDate;
      if (endDate) leaguePayload.end_date = endDate;

      const { data: leagueData, error: leagueError } = await supabase
        .from('league')
        .insert([leaguePayload])
        .select();
      if (leagueError) throw leagueError;

      const leagueId = leagueData[0].leagueid;

      const leagueGameRows = gameIds.map((gameid) => ({ leagueid: leagueId, gameid }));
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

    const leaguesWithGames = await Promise.all(
      leagues.map(async (l) => {
        const { data: lg } = await supabase
          .from('league_game')
          .select('gameid')
          .eq('leagueid', l.leagueid);
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

    const { data: lg } = await supabase
      .from('league_game')
      .select('gameid')
      .eq('leagueid', id);
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

  return router;
};
