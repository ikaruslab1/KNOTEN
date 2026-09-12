-- ============================================================
-- 0001_initial_schema.sql
-- Initial schema for pynodes – Next.js + Supabase project
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE user_role    AS ENUM ('estudiante', 'profesor');
CREATE TYPE session_type AS ENUM ('clase', 'repaso');
CREATE TYPE block_type   AS ENUM ('codigo', 'indentacion', 'sticker');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- profiles ---------------------------------------------------------
CREATE TABLE profiles (
  id                     uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre                 text        NOT NULL,
  apellido_paterno       text        NOT NULL,
  apellido_materno       text        NOT NULL,
  grupo                  text,
  semestre               text,
  carrera                text,
  correo_personal        text        UNIQUE NOT NULL,
  correo_institucional   text,
  rol                    user_role   NOT NULL DEFAULT 'estudiante',
  created_at             timestamptz DEFAULT now()
);

-- courses ----------------------------------------------------------
CREATE TABLE courses (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text        NOT NULL,
  imagen_url   text,
  profesor_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now()
);

-- sessions ---------------------------------------------------------
CREATE TABLE sessions (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id          uuid         NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  nombre            text         NOT NULL,
  tipo              session_type NOT NULL DEFAULT 'clase',
  fecha_liberacion  timestamptz,
  orden             integer      NOT NULL DEFAULT 0,
  created_at        timestamptz  DEFAULT now()
);

-- activities -------------------------------------------------------
CREATE TABLE activities (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  titulo             text        NOT NULL DEFAULT 'Actividad',
  enunciado          text,
  resultado_esperado text,
  orden              integer     NOT NULL DEFAULT 0,
  created_at         timestamptz DEFAULT now()
);

-- blocks -----------------------------------------------------------
CREATE TABLE blocks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     uuid        NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  tipo            block_type  NOT NULL DEFAULT 'codigo',
  contenido       text,
  orden_correcto  integer     NOT NULL,
  posicion_x      float8      DEFAULT 0,
  posicion_y      float8      DEFAULT 0,
  indent_level    integer     DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- connections ------------------------------------------------------
CREATE TABLE connections (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     uuid    NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  source_block_id uuid    NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  target_block_id uuid    NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  source_handle   text,
  target_handle   text,
  orden           integer NOT NULL DEFAULT 0
);

-- enrollments ------------------------------------------------------
CREATE TABLE enrollments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id         uuid        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  fecha_inscripcion timestamptz DEFAULT now(),
  UNIQUE (student_id, course_id)
);

-- progress ---------------------------------------------------------
CREATE TABLE progress (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id      uuid        NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  completado       boolean     DEFAULT false,
  intentos         integer     DEFAULT 0,
  fecha_completado timestamptz,
  UNIQUE (student_id, activity_id)
);

-- ============================================================
-- 3. TRIGGER – auto-create profile on new auth user
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    nombre,
    apellido_paterno,
    apellido_materno,
    grupo,
    semestre,
    carrera,
    correo_personal,
    correo_institucional
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre',                ''),
    COALESCE(NEW.raw_user_meta_data->>'apellido_paterno',      ''),
    COALESCE(NEW.raw_user_meta_data->>'apellido_materno',      ''),
    NEW.raw_user_meta_data->>'grupo',
    NEW.raw_user_meta_data->>'semestre',
    NEW.raw_user_meta_data->>'carrera',
    COALESCE(NEW.raw_user_meta_data->>'correo_personal', NEW.email),
    NEW.raw_user_meta_data->>'correo_institucional'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- Helper function to check if current user is professor without causing RLS recursion
CREATE OR REPLACE FUNCTION public.is_profesor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'profesor'
  );
$$;

-- ── profiles ────────────────────────────────────────────────
-- SELECT: own row OR professor profile OR viewer is a profesor
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO public
  USING (
    id = auth.uid()
    OR rol = 'profesor'
    OR is_profesor()
  );

-- UPDATE: own row only
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── courses ─────────────────────────────────────────────────
-- SELECT: everyone (including anon)
CREATE POLICY "courses_select_all"
  ON courses FOR SELECT
  USING (true);

-- INSERT: authenticated professors only
CREATE POLICY "courses_insert_profesor"
  ON courses FOR INSERT
  TO authenticated
  WITH CHECK (
    profesor_id = auth.uid()
    AND is_profesor()
  );

-- UPDATE: course owner
CREATE POLICY "courses_update_owner"
  ON courses FOR UPDATE
  TO authenticated
  USING (profesor_id = auth.uid())
  WITH CHECK (profesor_id = auth.uid());

-- DELETE: course owner
CREATE POLICY "courses_delete_owner"
  ON courses FOR DELETE
  TO authenticated
  USING (profesor_id = auth.uid());

-- ── sessions ────────────────────────────────────────────────
-- SELECT: everyone
CREATE POLICY "sessions_select_all"
  ON sessions FOR SELECT
  USING (true);

-- INSERT: course owner
CREATE POLICY "sessions_insert_owner"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = curso_id AND c.profesor_id = auth.uid()
    )
  );

-- UPDATE: course owner
CREATE POLICY "sessions_update_owner"
  ON sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = curso_id AND c.profesor_id = auth.uid()
    )
  );

-- DELETE: course owner
CREATE POLICY "sessions_delete_owner"
  ON sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = curso_id AND c.profesor_id = auth.uid()
    )
  );

-- ── activities ──────────────────────────────────────────────
-- SELECT: everyone
CREATE POLICY "activities_select_all"
  ON activities FOR SELECT
  USING (true);

-- INSERT: session course owner
CREATE POLICY "activities_insert_owner"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN courses c ON c.id = s.curso_id
      WHERE s.id = session_id AND c.profesor_id = auth.uid()
    )
  );

-- UPDATE: session course owner
CREATE POLICY "activities_update_owner"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN courses c ON c.id = s.curso_id
      WHERE s.id = session_id AND c.profesor_id = auth.uid()
    )
  );

-- DELETE: session course owner
CREATE POLICY "activities_delete_owner"
  ON activities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN courses c ON c.id = s.curso_id
      WHERE s.id = session_id AND c.profesor_id = auth.uid()
    )
  );

-- ── blocks ──────────────────────────────────────────────────
-- SELECT: everyone
CREATE POLICY "blocks_select_all"
  ON blocks FOR SELECT
  USING (true);

-- INSERT: activity -> session -> course owner
CREATE POLICY "blocks_insert_owner"
  ON blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN sessions s  ON s.id = a.session_id
      JOIN courses  c  ON c.id = s.curso_id
      WHERE a.id = activity_id AND c.profesor_id = auth.uid()
    )
  );

-- UPDATE: activity -> session -> course owner
CREATE POLICY "blocks_update_owner"
  ON blocks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN sessions s ON s.id = a.session_id
      JOIN courses  c ON c.id = s.curso_id
      WHERE a.id = activity_id AND c.profesor_id = auth.uid()
    )
  );

-- DELETE: activity -> session -> course owner
CREATE POLICY "blocks_delete_owner"
  ON blocks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN sessions s ON s.id = a.session_id
      JOIN courses  c ON c.id = s.curso_id
      WHERE a.id = activity_id AND c.profesor_id = auth.uid()
    )
  );

-- ── connections ─────────────────────────────────────────────
-- SELECT: everyone
CREATE POLICY "connections_select_all"
  ON connections FOR SELECT
  USING (true);

-- INSERT: activity -> session -> course owner
CREATE POLICY "connections_insert_owner"
  ON connections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN sessions s ON s.id = a.session_id
      JOIN courses  c ON c.id = s.curso_id
      WHERE a.id = activity_id AND c.profesor_id = auth.uid()
    )
  );

-- UPDATE: activity -> session -> course owner
CREATE POLICY "connections_update_owner"
  ON connections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN sessions s ON s.id = a.session_id
      JOIN courses  c ON c.id = s.curso_id
      WHERE a.id = activity_id AND c.profesor_id = auth.uid()
    )
  );

-- DELETE: activity -> session -> course owner
CREATE POLICY "connections_delete_owner"
  ON connections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN sessions s ON s.id = a.session_id
      JOIN courses  c ON c.id = s.curso_id
      WHERE a.id = activity_id AND c.profesor_id = auth.uid()
    )
  );

-- ── enrollments ─────────────────────────────────────────────
-- SELECT: own enrollment
CREATE POLICY "enrollments_select_own"
  ON enrollments FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- INSERT: own enrollment
CREATE POLICY "enrollments_insert_own"
  ON enrollments FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- DELETE: own enrollment
CREATE POLICY "enrollments_delete_own"
  ON enrollments FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

-- ── progress ────────────────────────────────────────────────
-- SELECT: own progress OR professor of the related course
CREATE POLICY "progress_select"
  ON progress FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM activities a
      JOIN sessions s ON s.id = a.session_id
      JOIN courses  c ON c.id = s.curso_id
      WHERE a.id = activity_id AND c.profesor_id = auth.uid()
    )
  );

-- INSERT: own progress
CREATE POLICY "progress_insert_own"
  ON progress FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- UPDATE: own progress
CREATE POLICY "progress_update_own"
  ON progress FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
