
export interface Migration {
version: number;
name: string;
statements: string[];
}

export const MIGRATIONS: readonly Migration[]=[
{
version: 1,
name: "initial schema",
statements: [
`CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schema_note TEXT NOT NULL DEFAULT '',
        ai_consent INTEGER NOT NULL DEFAULT 0,
        ai_consent_at TEXT,
        health_permission TEXT NOT NULL DEFAULT 'not_asked',
        location_permission TEXT NOT NULL DEFAULT 'not_asked',
        notifications_permission TEXT NOT NULL DEFAULT 'not_asked',
        camera_permission TEXT NOT NULL DEFAULT 'not_asked',
        loosen_sessions_target INTEGER NOT NULL DEFAULT 2,
        loosen_session_length_s INTEGER NOT NULL DEFAULT 300,
        loosen_long_unlocked INTEGER NOT NULL DEFAULT 0,
        loosen_cue TEXT,
        loosen_reminder_time TEXT,
        onboarding_done INTEGER NOT NULL DEFAULT 0,
        reduce_motion_override INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

`CREATE TABLE aura_versions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        background_type TEXT NOT NULL,
        -- Provenance for the describe-to-render path, kept separate from the
        -- state itself so the user's own edits are always distinguishable
        -- from what the model proposed.
        source_text TEXT,
        ai_draft_json TEXT,
        ai_model TEXT,
        ai_warnings_json TEXT,
        -- Still image captured at save time, as a file path under the app's
        -- documents directory. Used by the timeline, the compare view, and
        -- the doctor report.
        thumbnail_path TEXT
      )`,
`CREATE INDEX idx_aura_versions_created ON aura_versions (created_at DESC)`,

`CREATE TABLE day_logs (
        local_date TEXT PRIMARY KEY,
        headache TEXT NOT NULL CHECK (headache IN ('none','mild','moderate','severe')),
        attack_day INTEGER NOT NULL CHECK (attack_day IN (0,1)),
        acute_med INTEGER NOT NULL CHECK (acute_med IN (0,1)),
        alcohol INTEGER NOT NULL CHECK (alcohol IN (0,1)),
        caffeine_change INTEGER NOT NULL CHECK (caffeine_change IN (0,1)),
        skipped_meal INTEGER NOT NULL CHECK (skipped_meal IN (0,1)),
        stress TEXT CHECK (stress IS NULL OR stress IN ('low','medium','high')),
        logged_at TEXT NOT NULL,
        -- 0 when logged on the day, 1 when backfilled as yesterday. The
        -- engine may want to weight these differently, and at minimum it
        -- should be possible to find out whether it matters.
        backfilled INTEGER NOT NULL DEFAULT 0
      )`,

`CREATE TABLE attacks (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        local_date TEXT NOT NULL,
        ended_at TEXT,
        aura TEXT NOT NULL DEFAULT 'unsure' CHECK (aura IN ('yes','no','unsure')),
        meds INTEGER NOT NULL DEFAULT 0 CHECK (meds IN (0,1)),
        severity TEXT CHECK (severity IS NULL OR severity IN ('mild','moderate','severe')),
        voice_note_path TEXT,
        note TEXT
      )`,
`CREATE INDEX idx_attacks_date ON attacks (local_date)`,

`CREATE TABLE passive_daily (
        local_date TEXT PRIMARY KEY,
        sleep_minutes REAL,
        steps REAL,
        cycle_phase TEXT,
        menstrual_flow TEXT,
        pressure_msl REAL,
        pressure_surface REAL,
        pressure_change REAL,
        temp_mean REAL,
        temp_change REAL,
        humidity REAL,
        -- Which source supplied the row, so a gap caused by a declined
        -- permission is distinguishable from a gap caused by a failed fetch.
        health_source TEXT NOT NULL DEFAULT 'none',
        weather_source TEXT NOT NULL DEFAULT 'none',
        fetched_at TEXT
      )`,

`CREATE TABLE loosen_sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        local_date TEXT NOT NULL,
        length_s INTEGER NOT NULL,
        played_fraction REAL NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
        source TEXT NOT NULL DEFAULT 'manual',
        tension_before INTEGER CHECK (tension_before IS NULL OR (tension_before BETWEEN 0 AND 10)),
        tension_after INTEGER CHECK (tension_after IS NULL OR (tension_after BETWEEN 0 AND 10))
      )`,
`CREATE INDEX idx_loosen_date ON loosen_sessions (local_date)`,

`CREATE TABLE engine_runs (
        id TEXT PRIMARY KEY,
        run_at TEXT NOT NULL,
        input_window_start TEXT NOT NULL,
        input_window_end TEXT NOT NULL,
        engine_version TEXT NOT NULL,
        output_json TEXT NOT NULL
      )`,
`CREATE INDEX idx_engine_runs_at ON engine_runs (run_at DESC)`,

`CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        local_date TEXT NOT NULL,
        kind TEXT NOT NULL,
        detail_json TEXT
      )`,
`CREATE INDEX idx_events_date ON events (local_date)`,
],
},
{
version: 2,
name: "severity readings over time, for attacks that do not end",
statements: [
`CREATE TABLE attack_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attack_id TEXT NOT NULL,
        at TEXT NOT NULL,
        local_date TEXT NOT NULL,
        severity TEXT,
        note TEXT,
        FOREIGN KEY (attack_id) REFERENCES attacks (id) ON DELETE CASCADE
      )`,
`CREATE INDEX idx_readings_attack ON attack_readings (attack_id)`,
`CREATE INDEX idx_readings_date ON attack_readings (local_date)`,
`ALTER TABLE attacks ADD COLUMN continuous INTEGER NOT NULL DEFAULT 0`,
],
},
{
version: 3,
name: "a name to greet them by",
statements: [`ALTER TABLE settings ADD COLUMN display_name TEXT`],
},
{
version:4,
name:"link generated aura versions to their recorded attack",
statements:[`ALTER TABLE aura_versions ADD COLUMN source_attack_id TEXT REFERENCES attacks(id) ON DELETE SET NULL`],
},
];

export const LATEST_VERSION=MIGRATIONS.reduce(
(max, m) => Math.max(max, m.version),
0,
);
