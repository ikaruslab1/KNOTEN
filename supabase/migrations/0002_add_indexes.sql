-- 0002_add_indexes.sql
-- Add performance indexes for foreign keys and common query filters

CREATE INDEX IF NOT EXISTS idx_courses_profesor_id ON courses(profesor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_curso_id ON sessions(curso_id);
CREATE INDEX IF NOT EXISTS idx_sessions_orden ON sessions(curso_id, orden);
CREATE INDEX IF NOT EXISTS idx_activities_session_id ON activities(session_id);
CREATE INDEX IF NOT EXISTS idx_activities_orden ON activities(session_id, orden);
CREATE INDEX IF NOT EXISTS idx_blocks_activity_id ON blocks(activity_id);
CREATE INDEX IF NOT EXISTS idx_blocks_orden ON blocks(activity_id, orden_correcto);
CREATE INDEX IF NOT EXISTS idx_connections_activity_id ON connections(activity_id);
CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_block_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_block_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_progress_student_activity ON progress(student_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_profiles_rol ON profiles(rol);
