-- Koifit Workout Tracker Seed Data

-- Exercises
INSERT INTO exercise (name, min_increment, notes) VALUES
('Flat DB Press', 2.5, 'Tuck chin a little'),
('Seated DB Shoulder Press', 2.5, '75-85° bench angle. Bring dumbbells all the way down'),
('2-Grip Lat Pulldown', 2.5, 'Use lat bar then easy grip bar. Pull to chest'),
('Seated Cable Row', 2.5, 'Squeeze shoulder blades'),
('Hack Squat', 2.5, 'Foot rest mid position, top all way flat, safety 6. Control weight on way down'),
('Overhead Cable Triceps Extension', 2.5, 'Both arms at once, resist the negative'),
('EZ Bar Curl', 1.25, 'Arc bar ''out'' not ''up'', squeeze biceps'),
('Lying Hamstring Curl', 2.5, 'Legs at 3, circle at 2'),
('Pendlay Row', 2.5, 'Squeeze shoulder blades, pull to lower chest'),
('Machine Shoulder Press', 2.5, 'Smooth controlled tension, no stopping'),
('Weighted Pullup', 1.25, 'Pull elbows down and in, minimize swinging'),
('Cable Chest Press', 2.5, 'Squeeze chest'),
('DB Lateral Raise', 1.25, 'Raise ''out'' not ''up'''),
('Romanian Deadlift', 2.5, 'Neutral lower back, hips back, no rounding'),
('Leg Press', 5.0, 'Foot above middle so heel doesn''t raise in bottom. Safety 3, back mid hole'),
('DB Incline Curl', 1.25, '38° bench angle. Keep shoulders back as you curl'),
('Triceps Pressdown', 2.5, 'Squeeze triceps to move weight'),
('Leg Extension', 2.5, 'Squeeze quads');

-- Days
INSERT INTO day (label, ordinal) VALUES
('Upper 1', 1),
('Lower 1', 2),
('Upper 2', 3),
('Lower 2', 4);

-- Day 1: Upper 1 - Slots
INSERT INTO slot (day_id, ordinal, title, preferred_exercise_id, warmup_sets, working_sets_count, rep_target, rpe_range, rest_minutes, has_dropset) VALUES
(1, 1, 'Flat DB Press (Heavy)', 1, '2-3', 1, '4-6', '8-9', 3.0, 0),
(1, 2, 'Flat DB Press (Back off)', 1, '0', 1, '8-10', '9-10', 3.0, 0),
(1, 3, 'Seated DB Shoulder Press', 2, '1', 2, '10-12', '9-10', 2.0, 0),
(1, 4, '2-Grip Lat Pulldown', 3, '2', 2, '10-12', '9-10', 2.0, 0),
(1, 5, 'Seated Cable Row', 4, '1', 2, '10-12', '9-10', 2.0, 1);

-- Day 2: Lower 1 - Slots
INSERT INTO slot (day_id, ordinal, title, preferred_exercise_id, warmup_sets, working_sets_count, rep_target, rpe_range, rest_minutes, has_dropset) VALUES
(2, 1, 'Hack Squat (Heavy)', 5, '2-3', 1, '4-6', '8-9', 3.0, 0),
(2, 2, 'Hack Squat (Back off)', 5, '0', 1, '8-10', '8-9', 3.0, 0),
(2, 3, 'Overhead Cable Triceps Extension', 6, '1', 2, '12-15', '10', 1.5, 0),
(2, 4, 'EZ Bar Curl', 7, '1', 2, '12-15', '10', 1.5, 0),
(2, 5, 'Lying Hamstring Curl', 8, '1', 1, '10-12', '10', 1.5, 1);

-- Day 3: Upper 2 - Slots
INSERT INTO slot (day_id, ordinal, title, preferred_exercise_id, warmup_sets, working_sets_count, rep_target, rpe_range, rest_minutes, has_dropset) VALUES
(3, 1, 'Pendlay Row', 9, '2', 2, '8-10', '9-10', 2.0, 0),
(3, 2, 'Machine Shoulder Press', 10, '2', 2, '10-12', '9-10', 2.0, 0),
(3, 3, 'Weighted Pullup', 11, '1', 2, '8-10', '9-10', 2.0, 0),
(3, 4, 'Cable Chest Press', 12, '2', 2, '10-12', '9-10', 2.0, 1),
(3, 5, 'DB Lateral Raise', 13, '1', 1, '12-15', '10', 1.5, 1);

-- Day 4: Lower 2 - Slots
INSERT INTO slot (day_id, ordinal, title, preferred_exercise_id, warmup_sets, working_sets_count, rep_target, rpe_range, rest_minutes, has_dropset) VALUES
(4, 1, 'Romanian Deadlift', 14, '2', 2, '10-12', '8-9', 2.0, 0),
(4, 2, 'Leg Press', 15, '2', 3, '10-12', '8-9', 2.0, 0),
(4, 3, 'DB Incline Curl', 16, '1', 2, '12-15', '10', 1.5, 0),
(4, 4, 'Triceps Pressdown', 17, '1', 2, '12-15', '10', 1.5, 0),
(4, 5, 'Leg Extension', 18, '1', 1, '10-12', '9-10', 1.5, 1);

