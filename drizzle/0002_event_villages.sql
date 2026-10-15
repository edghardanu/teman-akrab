CREATE TABLE IF NOT EXISTS event_villages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  village_id INTEGER NOT NULL REFERENCES villages(id),
  UNIQUE(event_id, village_id)
);
CREATE INDEX IF NOT EXISTS event_villages_village_idx ON event_villages(village_id);

INSERT OR IGNORE INTO event_villages (event_id, village_id)
SELECT events.id, villages.id
FROM events CROSS JOIN villages
WHERE villages.is_active = 1;
