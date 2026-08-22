const { supabase } = require('../src/config/supabase');

async function clean() {
  const allowed = ['nagababuy92@gmail.com', 'nagababuy48@gmail.com'];
  
  const { data: users, error: fetchErr } = await supabase.from('users').select('id, email');
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  for (const u of users) {
    if (!allowed.includes(u.email.toLowerCase())) {
      const { error: delErr } = await supabase.from('users').delete().eq('id', u.id);
      if (delErr) {
        console.error('Delete error for', u.email, delErr);
      } else {
        console.log('Deleted test user:', u.email);
      }
    }
  }

  const { data: remaining } = await supabase.from('users').select('id, email, role');
  console.log('REMAINING REGISTERED USERS IN DATABASE:', remaining);
}

clean();
