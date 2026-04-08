PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL,
    avatar_seed TEXT,
    age_band TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grade_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS subject_branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grade_level_id INTEGER NOT NULL,
    subject_key TEXT NOT NULL,
    title TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    anchor_x REAL NOT NULL,
    anchor_y REAL NOT NULL,
    canopy_width REAL NOT NULL,
    canopy_height REAL NOT NULL,
    path_points_json TEXT,
    FOREIGN KEY (grade_level_id) REFERENCES grade_levels (id) ON DELETE CASCADE,
    UNIQUE (grade_level_id, subject_key)
);

CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL,
    subtopic_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    lesson_seed_prompt TEXT,
    leaf_x REAL NOT NULL,
    leaf_y REAL NOT NULL,
    render_radius REAL NOT NULL DEFAULT 24.0 CHECK (render_radius > 0),
    hit_radius REAL NOT NULL DEFAULT 48.0 CHECK (hit_radius >= render_radius),
    unlock_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES subject_branches (id) ON DELETE CASCADE,
    UNIQUE (branch_id, subtopic_key)
);

CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    leaf_id INTEGER NOT NULL,
    lesson_title TEXT NOT NULL,
    body_text TEXT NOT NULL,
    vocabulary_words_json TEXT NOT NULL,
    raw_payload_json TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    challenge_score INTEGER,
    challenge_total INTEGER,
    completed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (leaf_id) REFERENCES leaves (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_leaf_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    leaf_id INTEGER NOT NULL,
    mastery_level INTEGER NOT NULL DEFAULT 0 CHECK (mastery_level >= 0),
    lessons_completed INTEGER NOT NULL DEFAULT 0 CHECK (lessons_completed >= 0),
    last_lesson_id INTEGER,
    last_opened_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (leaf_id) REFERENCES leaves (id) ON DELETE CASCADE,
    FOREIGN KEY (last_lesson_id) REFERENCES lessons (id) ON DELETE SET NULL,
    UNIQUE (profile_id, leaf_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_branches_grade_order
    ON subject_branches (grade_level_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_leaves_branch_unlock
    ON leaves (branch_id, unlock_order);

CREATE INDEX IF NOT EXISTS idx_lessons_profile_leaf_created
    ON lessons (profile_id, leaf_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_leaf_progress_profile
    ON profile_leaf_progress (profile_id);
