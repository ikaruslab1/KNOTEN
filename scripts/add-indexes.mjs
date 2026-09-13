import pg from 'pg'
import fs from 'fs'
import path from 'path'

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
  console.error('No connection string found')
  process.exit(1)
}

const cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&]+/g, '')
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const client = new pg.Client({
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  try {
    await client.connect()
    console.log('Connected to PostgreSQL!')

    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/0002_add_indexes.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    await client.query(sql)
    console.log('Indexes created successfully!')

    const res = await client.query(`
      SELECT indexname, tablename FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname;
    `)
    console.log('Public indexes in database:')
    res.rows.forEach(r => console.log(`  - ${r.tablename}: ${r.indexname}`))

    await client.end()
  } catch (err) {
    console.error('Error applying indexes:', err)
    if (client) await client.end()
    process.exit(1)
  }
}

run()
