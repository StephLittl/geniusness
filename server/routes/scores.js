const express = require('express');

module.exports = function(supabase) {
  const router = express.Router();

  // POST /api/scores
  router.post('/', async (req, res) => {
    const { user_id, league_id, date, score } = req.body;

    const { data, error } = await supabase
      .from('scores')
      .insert([{ user_id, league_id, date, score }]);

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  });

  // GET /api/scores/:league_id/:date
  router.get('/:league_id/:date', async (req, res) => {
    const { league_id, date } = req.params;

    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('league_id', league_id)
      .eq('date', date);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  return router;
};
