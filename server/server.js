const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const scoreRoutes = require('./routes/scores');

dotenv.config();
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

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
