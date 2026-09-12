// ============================================================
// types/supabase.ts
// Manual TypeScript types matching the pynodes database schema.
// Field names mirror the SQL column names exactly.
// ============================================================

// ── Enums ────────────────────────────────────────────────────
export type UserRole    = 'estudiante' | 'profesor'
export type SessionType = 'clase' | 'repaso'
export type BlockType   = 'codigo' | 'indentacion' | 'sticker'

// ── Base table interfaces ────────────────────────────────────

export interface Profile {
  id:                   string        // uuid – references auth.users
  nombre:               string
  apellido_paterno:     string
  apellido_materno:     string
  grupo:                string | null
  semestre:             string | null
  carrera:              string | null
  correo_personal:      string
  correo_institucional: string | null
  rol:                  UserRole
  created_at:           string        // timestamptz as ISO string
}

export interface Course {
  id:          string
  nombre:      string
  imagen_url:  string | null
  profesor_id: string        // uuid – references profiles(id)
  created_at:  string
}

export interface Session {
  id:               string
  curso_id:         string        // uuid – references courses(id)
  nombre:           string
  tipo:             SessionType
  fecha_liberacion: string | null // timestamptz as ISO string
  orden:            number
  created_at:       string
}

export interface Activity {
  id:                 string
  session_id:         string        // uuid – references sessions(id)
  titulo:             string
  enunciado:          string | null
  resultado_esperado: string | null
  orden:              number
  created_at:         string
}

export interface Block {
  id:             string
  activity_id:    string        // uuid – references activities(id)
  tipo:           BlockType
  contenido:      string | null
  orden_correcto: number
  posicion_x:     number
  posicion_y:     number
  indent_level:   number
  created_at:     string
}

export interface Connection {
  id:              string
  activity_id:     string        // uuid – references activities(id)
  source_block_id: string        // uuid – references blocks(id)
  target_block_id: string        // uuid – references blocks(id)
  source_handle:   string | null
  target_handle:   string | null
  orden:           number
}

export interface Enrollment {
  id:                string
  student_id:        string        // uuid – references profiles(id)
  course_id:         string        // uuid – references courses(id)
  fecha_inscripcion: string        // timestamptz as ISO string
}

export interface Progress {
  id:               string
  student_id:       string        // uuid – references profiles(id)
  activity_id:      string        // uuid – references activities(id)
  completado:       boolean
  intentos:         number
  fecha_completado: string | null // timestamptz as ISO string
}

// ── Joined / convenience types ───────────────────────────────

/** Course with its professor's profile embedded. */
export interface CourseWithProfessor extends Course {
  professor: Profile
}

/** Session with its activities list embedded. */
export interface SessionWithActivities extends Session {
  activities: Activity[]
}

/** Activity with its blocks and connections embedded. */
export interface ActivityWithBlocks extends Activity {
  blocks:      Block[]
  connections: Connection[]
}

/** Course with sessions (each session containing its activities). */
export interface CourseWithSessions extends Course {
  sessions: SessionWithActivities[]
}

/** Enrollment with course details embedded. */
export interface EnrollmentWithCourse extends Enrollment {
  course: Course
}

/** Progress with activity details embedded. */
export interface ProgressWithActivity extends Progress {
  activity: Activity
}

// ── Database shape (Supabase-compatible) ─────────────────────
// Manually maintained until `supabase gen types typescript` is run.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row:    Profile
        Insert: Omit<Profile, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<Profile, 'id'>>
      }
      courses: {
        Row:    Course
        Insert: Omit<Course, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Course, 'id'>>
      }
      sessions: {
        Row:    Session
        Insert: Omit<Session, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Session, 'id'>>
      }
      activities: {
        Row:    Activity
        Insert: Omit<Activity, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Activity, 'id'>>
      }
      blocks: {
        Row:    Block
        Insert: Omit<Block, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Block, 'id'>>
      }
      connections: {
        Row:    Connection
        Insert: Omit<Connection, 'id'> & { id?: string }
        Update: Partial<Omit<Connection, 'id'>>
      }
      enrollments: {
        Row:    Enrollment
        Insert: Omit<Enrollment, 'id' | 'fecha_inscripcion'> & { id?: string; fecha_inscripcion?: string }
        Update: Partial<Omit<Enrollment, 'id'>>
      }
      progress: {
        Row:    Progress
        Insert: Omit<Progress, 'id'> & { id?: string }
        Update: Partial<Omit<Progress, 'id'>>
      }
    }
    Enums: {
      user_role:    UserRole
      session_type: SessionType
      block_type:   BlockType
    }
  }
}
