CREATE POLICY "Allow INSERT on attendance_records" ON attendance_records FOR INSERT WITH CHECK (
  marked_by = current_user_id() OR user_id = current_user_id()
);
