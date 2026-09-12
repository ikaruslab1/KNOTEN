import pg from 'pg'
import fs from 'fs'
import path from 'path'

// Read .env manually
const envPath = path.resolve(process.cwd(), '.env')
let connectionString = ''
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('POSTGRES_URL_NON_POOLING=')) {
      connectionString = trimmed.replace('POSTGRES_URL_NON_POOLING=', '').replace(/^["']|["']$/g, '')
    }
  }
  if (!connectionString) {
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('POSTGRES_URL=')) {
        connectionString = trimmed.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '')
      }
    }
  }
}

if (!connectionString) {
  console.error('No POSTGRES connection string found in .env')
  process.exit(1)
}

// Strip sslmode so pg doesn't enforce verify-full
const cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&]+/g, '')

console.log('Connecting to PostgreSQL with:', cleanConnectionString.replace(/:[^:@]+@/, ':***@'))
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const client = new pg.Client({
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  try {
    await client.connect()
    console.log('Connected to Supabase PostgreSQL successfully!')

    console.log('Cleaning up existing schema and auth data...')

    // 1. Drop existing triggers on auth.users if any
    await client.query(`
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
    `)

    // 2. Drop all public tables and custom types
    await client.query(`
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
          FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
              EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
      END $$;
    `)

    // 3. Clean auth.users so everything is completely fresh
    try {
      await client.query(`DELETE FROM auth.users;`)
      console.log('Cleaned auth.users.')
    } catch (e) {
      console.warn('Note: could not clear auth.users:', e.message)
    }

    console.log('All previous public tables and data dropped.')

    // 4. Read and execute migration
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/0001_initial_schema.sql')
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8').replace(/^\uFEFF/, '')

    console.log('Applying migration 0001_initial_schema.sql...')
    await client.query(migrationSQL)
    console.log('Migration applied successfully!')

    // 5. Verify tables
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
    `)
    console.log('Tables created in public schema:')
    res.rows.forEach((row) => console.log(' - ' + row.table_name))

    await client.end()
    console.log('Database setup complete!')
  } catch (err) {
    console.error('Error running setup:', err)
    if (client) await client.end()
    process.exit(1)
  }
}

run()
