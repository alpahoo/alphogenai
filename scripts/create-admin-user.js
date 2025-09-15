const { createClient } = require('@supabase/supabase-js');

async function createAdminUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminPassword = process.env.ADMIN_BOOT_PWD;

  if (!supabaseUrl || !serviceRoleKey || !adminPassword) {
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
      email: 'founder@alphogen.com',
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        created_by: 'system',
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ Admin user already exists: founder@alphogen.com');

        const { error: updateError } = await supabase.auth.admin.updateUserById(
          data?.user?.id || '',
          { password: adminPassword },
        );

        if (updateError) {
          console.error('❌ Failed to update admin password:', updateError.message);
          process.exit(1);
        }

        console.log('✅ Admin password updated successfully');
      } else {
        console.error('❌ Failed to create admin user:', error.message);
        process.exit(1);
      }
    } else {
      console.log('✅ Admin user created successfully:', data.user.email);
    }

    console.log('✅ Admin user setup complete');
    console.log('📧 Email: founder@alphogen.com');
    console.log('🔑 Password: [stored in ADMIN_BOOT_PWD secret]');
  } catch (err) {
    console.error('❌ Script error:', err.message);
    process.exit(1);
  }
}

createAdminUser();
