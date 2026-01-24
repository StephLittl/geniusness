const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const scoreRoutes = require('./routes/scores');
const authRoutes = require('./routes/auth');

dotenv.config({ path: __dirname + '/.env' });
const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/scores', scoreRoutes(supabase));
app.use('/api/auth', authRoutes(supabase));

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const leagueRoutes = require('./routes/league');
app.use('/api/league', leagueRoutes(supabase));

const userGamesRoutes = require('./routes/userGames');
app.use('/api/user-games', userGamesRoutes(supabase));
