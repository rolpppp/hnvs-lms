-- Enable RLS on courses table
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Allow teachers to view their own courses
CREATE POLICY "Teachers can view their own courses"
ON courses FOR SELECT
USING (auth.uid() = created_by);

-- Allow students to view courses they are enrolled in
CREATE POLICY "Students can view enrolled courses"
ON courses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM enrollments
    WHERE enrollments.course_id = courses.id
    AND enrollments.student_id = auth.uid()
  )
);

-- Allow teachers to insert/update/delete their own courses
CREATE POLICY "Teachers can manage their own courses"
ON courses FOR ALL
USING (auth.uid() = created_by);
