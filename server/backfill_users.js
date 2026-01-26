// Script to create users via Supabase Admin API
// Run this with: node backfill_users.js
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const users = [
  {
    email: 'stolowd@example.com',
    password: 'TempPassword123!', // User should change this
    user_metadata: {
      first_name: 'Stolowd',
      username: 'stolowd'
    },
    email_confirm: true
  },
  {
    email: 'bob@example.com',
    password: 'TempPassword123!', // User should change this
    user_metadata: {
      first_name: 'Bob',
      username: 'bob'
    },
    email_confirm: true
  },
  {
    email: 'sary@example.com',
    password: 'TempPassword123!', // User should change this
    user_metadata: {
      first_name: 'Sary',
      username: 'sary'
    },
    email_confirm: true
  }
];

async function createUsers() {
  const results = [];

  for (const user of users) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: user.user_metadata
      });

      if (authError) {
        console.error(`Error creating auth user for ${user.email}:`, authError);
        results.push({ email: user.email, success: false, error: authError.message });
        continue;
      }

      console.log(`✅ Created auth user: ${user.email} (ID: ${authData.user.id})`);

      // Insert into users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{
          user_id: authData.user.id,
          first_name: user.user_metadata.first_name,
          last_name: null,
          username: user.user_metadata.username,
          email: user.email
        }])
        .select()
        .single();

      if (userError) {
        console.error(`Error inserting user ${user.email} into users table:`, userError);
        results.push({ 
          email: user.email, 
          authId: authData.user.id,
          success: false, 
          error: userError.message 
        });
      } else {
        console.log(`✅ Inserted user into users table: ${user.email}`);
        results.push({ 
          email: user.email, 
          authId: authData.user.id,
          userId: userData.user_id,
          success: true 
        });
      }
    } catch (error) {
      console.error(`Unexpected error for ${user.email}:`, error);
      results.push({ email: user.email, success: false, error: error.message });
    }
  }

  console.log('\n📊 Summary:');
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.email} - Auth ID: ${result.authId}, User ID: ${result.userId}`);
    } else {
      console.log(`❌ ${result.email} - Error: ${result.error}`);
    }
  });

  return results;
}

createUsers()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
