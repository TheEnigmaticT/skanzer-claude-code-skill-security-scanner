CREATE INDEX idx_skills_file_path_github
ON skills(file_path text_pattern_ops)
WHERE file_path LIKE 'github:%';
