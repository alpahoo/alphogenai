const { createClient } = require('@supabase/supabase-js');

async function createDigitalpahoAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminPassword = 'C@mer2025';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'digitalpaho@outlook.com',
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: 'application_admin',
        created_by: 'system',
      },
    });

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        console.log('✅ Admin user already exists: digitalpaho@outlook.com');

        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users.users.find(u => u.email === 'digitalpaho@outlook.com');
        if (existingUser) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            {
              password: adminPassword,
              user_metadata: {
                role: 'application_admin',
                created_by: 'system',
              },
            },
          );

          if (updateError) {
            console.error('❌ Failed to update admin user:', updateError.message);
            process.exit(1);
          }

          console.log('✅ Admin user updated successfully');
        }
      } else {
        console.error('❌ Failed to create admin user:', error.message);
        process.exit(1);
      }
    } else {
      console.log('✅ Admin user created successfully:', data.user.email);
    }

    console.log('✅ Digitalpaho admin setup complete');
    console.log('📧 Email: digitalpaho@outlook.com');
    console.log('🔑 Password: C@mer2025 (changeable later)');
    console.log('👤 Role: application_admin');
  } catch (err) {
    console.error('❌ Script error:', err.message);
    process.exit(1);
  }
}

createDigitalpahoAdmin();
