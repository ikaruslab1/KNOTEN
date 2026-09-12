import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Testing Supabase with URL:', url)

const supabaseAnon = createClient(url, anonKey)
const supabaseAdmin = createClient(url, serviceKey)

async function test() {
  // Test courses table
  const { data: courses, error: err1 } = await supabaseAnon.from('courses').select('*')
  if (err1) {
    console.error('Anon courses query failed:', err1)
  } else {
    console.log('Anon courses query OK. Courses count:', courses.length)
  }

  // Test profiles table with admin client
  const { data: profiles, error: err2 } = await supabaseAdmin.from('profiles').select('*')
  if (err2) {
    console.error('Admin profiles query failed:', err2)
  } else {
    console.log('Admin profiles query OK. Profiles count:', profiles.length)
  }

  // Test public read on professor profiles
  const { data: profs, error: err3 } = await supabaseAnon.from('profiles').select('id, nombre, apellido_paterno, rol').eq('rol', 'profesor')
  if (err3) {
    console.error('Anon professor profiles query failed:', err3)
  } else {
    console.log('Anon professor profiles query OK. Count:', profs.length)
  }

  console.log('All Supabase checks finished!')
}

test()
