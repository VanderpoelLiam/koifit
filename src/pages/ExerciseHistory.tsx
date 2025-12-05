import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, ExerciseHistoryEntry, Exercise } from '../api';

export default function ExerciseHistory() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const [history, setHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (exerciseId) {
      loadHistory();
    }
  }, [exerciseId]);

  const loadHistory = async () => {
    if (!exerciseId) return;
    try {
      const data = await api.getExerciseHistory(parseInt(exerciseId));
      setHistory(data);
      if (data.length > 0) {
        // Get exercise info from first entry (all entries have same exercise)
        const firstEntry = data[0];
        // We need to get exercise details - for now, extract from API response
        // In a real app, we'd have a separate endpoint or include it in history
        setExercise({
          id: firstEntry.session_exercise.exercise_id,
          name: 'Exercise', // Would come from API
          min_increment: 2.5,
          active: true,
          notes: undefined,
        });
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEffortColor = (tag?: string) => {
    if (tag === 'easy') return '#007bff'; // blue
    if (tag === 'hard') return '#dc3545'; // red
    return '#666'; // default/good
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Link to="/" style={{ color: '#007bff', textDecoration: 'none', marginBottom: '20px', display: 'block' }}>
        ← Back
      </Link>

      {exercise && (
        <div style={{ marginBottom: '20px' }}>
          <h1>{exercise.name}</h1>
          {exercise.notes && (
            <div style={{ color: '#666', fontStyle: 'italic', marginTop: '10px' }}>
              {exercise.notes}
            </div>
          )}
        </div>
      )}

      {history.length === 0 ? (
        <div>No history found for this exercise.</div>
      ) : (
        <div>
          <h2>History (Last 50 sessions)</h2>
          {history.map((entry) => (
            <div
              key={entry.session.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '15px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <div style={{ marginBottom: '10px' }}>
                <strong>
                  {new Date(entry.session.date).toLocaleDateString()} - {entry.day.label}
                </strong>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <strong>Sets:</strong>
                {entry.sets.map((set) => (
                  <span key={set.id} style={{ marginLeft: '10px' }}>
                    Set {set.set_number}: {set.weight_kg}kg × {set.reps}
                    {set.is_drop && ' (drop)'}
                  </span>
                ))}
              </div>

              {entry.session_exercise.effort_tag && (
                <div style={{ marginBottom: '5px' }}>
                  <strong>Effort:</strong>{' '}
                  <span style={{ color: getEffortColor(entry.session_exercise.effort_tag) }}>
                    {entry.session_exercise.effort_tag}
                  </span>
                </div>
              )}

              {entry.session_exercise.dropset_done && (
                <div style={{ marginBottom: '5px' }}>
                  <strong>Dropset:</strong> ✓
                </div>
              )}

              {entry.session_exercise.next_time_note && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
                  <strong>Notes:</strong> {entry.session_exercise.next_time_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
