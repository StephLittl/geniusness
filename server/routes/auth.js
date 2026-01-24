const express = require('express');

module.exports = function (supabase) {
  const router = express.Router();

  router.post('/signup', async (req, res) => {
    console.log("📩 Signup request received with body:", req.body);

    const { firstName, lastName, username, email, password } = req.body;

    // Step 1: Create a Supabase Auth user
    console.log("➡️ Creating Supabase Auth user for:", email);

    const { data: authUser, error: signupError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (signupError) {
      console.error("❌ Auth signup error:", signupError);
      return res.status(400).json({ error: signupError.message });
    }

    console.log("✅ Auth user created:", authUser);

    // Step 2: Insert into `users` table
    console.log("➡️ Inserting into users table:", {
      user_id: authUser.user.id,
      first_name: firstName,
      last_name: lastName,
      username,
      email,
    });

    const { data: userInsert, error: insertError } = await supabase
      .from('users')
      .insert([{
        user_id: authUser.user.id,
        first_name: firstName,
        last_name: lastName,
        username,
        email,
      }]);

    if (insertError) {
      console.error("❌ DB insert error:", insertError);
      return res.status(400).json({ error: insertError.message });
    }

    console.log("✅ User inserted into DB:", userInsert);

    res.status(201).json({ user: authUser.user, profile: userInsert });
  });

  router.post('/login', async (req, res) => {
    console.log("📩 Login request received with body:", req.body);

    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("❌ Login error:", error);
      return res.status(401).json({ error: error.message });
    }

    const { session, user } = data;
    console.log("✅ Login success for user:", user);

    const { data: profile } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, username, email')
      .eq('user_id', user.id)
      .single();

    res.status(200).json({
      access_token: session.access_token,
      user: {
        id: user.id,
        email: user.email,
        username: profile?.username ?? user.email?.split('@')[0],
        first_name: profile?.first_name,
        last_name: profile?.last_name,
      },
    });
  });

  return router;
};
