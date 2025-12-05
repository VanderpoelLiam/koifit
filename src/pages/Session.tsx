import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, SessionWithExercises, SessionExerciseWithSlot, SetEntry } from '../api';

export default function Session() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionWithExercises | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const notesTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    if (!sessionId) return;
    try {
      const data = await api.getSession(parseInt(sessionId));
      setSession(data);
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveExercise = useCallback(async (exercise: SessionExerciseWithSlot) => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const sets = exercise.sets.map((set) => ({
        set_number: set.set_number,
        weight_kg: set.weight_kg,
        reps: set.reps,
        is_done: set.is_done,
      }));

      await api.saveExercise(parseInt(sessionId), exercise.session_exercise.id, {
        notes: exercise.session_exercise.next_time_note,
        effort_tag: exercise.session_exercise.effort_tag,
        dropset_done: exercise.session_exercise.dropset_done,
        sets,
      });
    } catch (error) {
      console.error('Failed to save exercise:', error);
    } finally {
      setSaving(false);
    }
  }, [sessionId]);

  const debouncedSave = useCallback((exercise: SessionExerciseWithSlot, delay: number) => {
    const timeoutKey = exercise.session_exercise.id;
    const existingTimeout = saveTimeouts.current.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    const timeout = setTimeout(() => {
      saveExercise(exercise);
      saveTimeouts.current.delete(timeoutKey);
    }, delay);
    saveTimeouts.current.set(timeoutKey, timeout);
  }, [saveExercise]);

  const debouncedSaveNotes = useCallback((exercise: SessionExerciseWithSlot) => {
    const timeoutKey = exercise.session_exercise.id;
    const existingTimeout = notesTimeouts.current.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    const timeout = setTimeout(() => {
      saveExercise(exercise);
      notesTimeouts.current.delete(timeoutKey);
    }, 2000);
    notesTimeouts.current.set(timeoutKey, timeout);
  }, [saveExercise]);

  const updateExercise = (exerciseId: number, updater: (ex: SessionExerciseWithSlot) => SessionExerciseWithSlot) => {
    if (!session) return;
    setSession({
      ...session,
      exercises: session.exercises.map((ex) =>
        ex.session_exercise.id === exerciseId ? updater(ex) : ex
      ),
    });
  };


  const handleFinish = async () => {
    if (!sessionId || !session) return;
    if (!window.confirm('Finish this workout?')) return;

    // Save all exercises one final time
    for (const exercise of session.exercises) {
      await saveExercise(exercise);
    }

    try {
      await api.finishSession(parseInt(sessionId));
      navigate('/');
    } catch (error) {
      console.error('Failed to finish session:', error);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!session) {
    return <div style={{ padding: '20px' }}>Session not found</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', paddingBottom: '100px' }}>
      <h1>{session.day.label} - {new Date(session.session.date).toLocaleDateString()}</h1>

      {session.exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.session_exercise.id}
          exercise={exercise}
          sessionId={parseInt(sessionId!)}
          onUpdate={(updater) => {
            updateExercise(exercise.session_exercise.id, updater);
          }}
          onSave={(ex) => {
            saveExercise(ex);
          }}
          onDebouncedSave={(ex) => {
            debouncedSave(ex, 1000);
          }}
          onDebouncedSaveNotes={(ex) => {
            debouncedSaveNotes(ex);
          }}
        />
      ))}

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px',
          backgroundColor: 'white',
          borderTop: '1px solid #ccc',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        }}
      >
        <button
          onClick={handleFinish}
          disabled={saving}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Finish Workout'}
        </button>
      </div>
    </div>
  );
}

interface ExerciseCardProps {
  exercise: SessionExerciseWithSlot;
  sessionId?: number;
  onUpdate: (updater: (ex: SessionExerciseWithSlot) => SessionExerciseWithSlot) => void;
  onSave: (ex: SessionExerciseWithSlot) => void;
  onDebouncedSave: (ex: SessionExerciseWithSlot) => void;
  onDebouncedSaveNotes: (ex: SessionExerciseWithSlot) => void;
}

function ExerciseCard({ exercise, onUpdate, onSave, onDebouncedSave, onDebouncedSaveNotes }: ExerciseCardProps) {
  const [showPrevious, setShowPrevious] = useState(false);
  const { slot, exercise: ex, previous_session_exercise, sets } = exercise;
  const sessionExercise = exercise.session_exercise;

  // Initialize sets if empty
  useEffect(() => {
    if (sets.length === 0 && slot.working_sets_count > 0) {
      const initialSets: SetEntry[] = [];
      const previousSets = previous_session_exercise?.sets || [];
      
      for (let i = 1; i <= slot.working_sets_count; i++) {
        const prevSet = previousSets.find((s) => s.set_number === i);
        initialSets.push({
          id: 0,
          session_exercise_id: sessionExercise.id,
          set_number: i,
          weight_kg: prevSet?.weight_kg || 0,
          reps: prevSet?.reps || 0,
          is_done: false,
          is_drop: false,
        });
      }
      
      if (initialSets.length > 0) {
        onUpdate((ex) => ({ ...ex, sets: initialSets }));
      }
    }
  }, []);

  const handleWeightChange = (setNumber: number, weight: number) => {
    onUpdate((ex) => {
      const updatedSets = ex.sets.map((set) =>
        set.set_number === setNumber ? { ...set, weight_kg: weight } : set
      );
      if (!updatedSets.find((s) => s.set_number === setNumber)) {
        updatedSets.push({
          id: 0,
          session_exercise_id: ex.session_exercise.id,
          set_number: setNumber,
          weight_kg: weight,
          reps: 0,
          is_done: false,
          is_drop: false,
        });
      }
      const updatedEx = { ...ex, sets: updatedSets };
      onDebouncedSave(updatedEx);
      return updatedEx;
    });
  };

  const handleRepsChange = (setNumber: number, reps: number) => {
    onUpdate((ex) => {
      const updatedSets = ex.sets.map((set) =>
        set.set_number === setNumber ? { ...set, reps } : set
      );
      if (!updatedSets.find((s) => s.set_number === setNumber)) {
        updatedSets.push({
          id: 0,
          session_exercise_id: ex.session_exercise.id,
          set_number: setNumber,
          weight_kg: 0,
          reps,
          is_done: false,
          is_drop: false,
        });
      }
      const updatedEx = { ...ex, sets: updatedSets };
      onDebouncedSave(updatedEx);
      return updatedEx;
    });
  };

  const handleSetDone = (setNumber: number, isDone: boolean) => {
    onUpdate((ex) => {
      const updatedSets = ex.sets.map((set) =>
        set.set_number === setNumber ? { ...set, is_done: isDone } : set
      );
      if (!updatedSets.find((s) => s.set_number === setNumber)) {
        updatedSets.push({
          id: 0,
          session_exercise_id: ex.session_exercise.id,
          set_number: setNumber,
          weight_kg: 0,
          reps: 0,
          is_done: isDone,
          is_drop: false,
        });
      }
      const updatedEx = { ...ex, sets: updatedSets };
      onSave(updatedEx); // Immediate save for checkboxes
      return updatedEx;
    });
  };

  const handleEffortTag = (tag: 'easy' | 'hard' | 'good') => {
    onUpdate((ex) => {
      const updatedEx = {
        ...ex,
        session_exercise: {
          ...ex.session_exercise,
          effort_tag: tag === 'good' ? undefined : tag,
        },
      };
      onSave(updatedEx); // Immediate save
      return updatedEx;
    });
  };

  const handleDropset = (done: boolean) => {
    onUpdate((ex) => {
      const updatedEx = {
        ...ex,
        session_exercise: {
          ...ex.session_exercise,
          dropset_done: done,
        },
      };
      onSave(updatedEx); // Immediate save
      return updatedEx;
    });
  };

  const handleNotesChange = (notes: string) => {
    onUpdate((ex) => {
      const updatedEx = {
        ...ex,
        session_exercise: {
          ...ex.session_exercise,
          next_time_note: notes,
        },
      };
      onDebouncedSaveNotes(updatedEx);
      return updatedEx;
    });
  };

  const currentSets = sets.length > 0 ? sets : Array.from({ length: slot.working_sets_count }, (_, i) => ({
    id: 0,
    session_exercise_id: sessionExercise.id,
    set_number: i + 1,
    weight_kg: 0,
    reps: 0,
    is_done: false,
    is_drop: false,
  }));

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#f9f9f9',
      }}
    >
      <h2>
        <Link
          to={`/exercise/${ex.id}/history`}
          style={{ color: '#007bff', textDecoration: 'none' }}
        >
          {slot.title}
        </Link>
      </h2>

      <div style={{ marginBottom: '15px' }}>
        <div>
          <strong>Reps:</strong> {slot.rep_target}
          {slot.rpe_range && ` | RPE: ${slot.rpe_range}`}
        </div>
        <div>
          <strong>Rest:</strong> {slot.rest_minutes} min
        </div>
        {ex.notes && (
          <div style={{ marginTop: '10px', fontStyle: 'italic', color: '#666' }}>
            {ex.notes}
          </div>
        )}
      </div>

      {previous_session_exercise && (
        <div style={{ marginBottom: '15px' }}>
          <button
            onClick={() => setShowPrevious(!showPrevious)}
            style={{
              padding: '5px 10px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {showPrevious ? 'Hide' : 'Show'} Last Time
          </button>
          {showPrevious && (
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
              {previous_session_exercise.sets.length > 0 && (
                <div>
                  <strong>Previous Sets:</strong>
                  {previous_session_exercise.sets.map((set) => (
                    <span key={set.id} style={{ marginLeft: '10px' }}>
                      {set.weight_kg}kg × {set.reps}
                    </span>
                  ))}
                </div>
              )}
              {previous_session_exercise.effort_tag && (
                <div style={{ marginTop: '5px' }}>
                  <strong>Effort:</strong> {previous_session_exercise.effort_tag}
                </div>
              )}
              {previous_session_exercise.next_time_note && (
                <div style={{ marginTop: '5px' }}>
                  <strong>Notes:</strong> {previous_session_exercise.next_time_note}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {slot.warmup_sets !== '0' && (
        <div style={{ marginBottom: '15px' }}>
          <label>
            <input type="checkbox" />
            {slot.warmup_sets} warmup sets
          </label>
        </div>
      )}

      <table style={{ width: '100%', marginBottom: '15px', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Set</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Weight (kg)</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Reps</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Done</th>
          </tr>
        </thead>
        <tbody>
          {currentSets.map((set) => (
            <tr key={set.set_number}>
              <td style={{ padding: '8px' }}>{set.set_number}</td>
              <td style={{ padding: '8px' }}>
                <input
                  type="number"
                  step={ex.min_increment}
                  value={set.weight_kg || ''}
                  onChange={(e) => handleWeightChange(set.set_number, parseFloat(e.target.value) || 0)}
                  style={{ width: '80px', padding: '4px' }}
                />
              </td>
              <td style={{ padding: '8px' }}>
                <input
                  type="number"
                  value={set.reps || ''}
                  onChange={(e) => handleRepsChange(set.set_number, parseInt(e.target.value) || 0)}
                  style={{ width: '60px', padding: '4px' }}
                />
              </td>
              <td style={{ padding: '8px' }}>
                <input
                  type="checkbox"
                  checked={set.is_done || false}
                  onChange={(e) => handleSetDone(set.set_number, e.target.checked)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {slot.has_dropset && (
        <div style={{ marginBottom: '15px' }}>
          <label>
            <input
              type="checkbox"
              checked={sessionExercise.dropset_done}
              onChange={(e) => handleDropset(e.target.checked)}
            />
            Dropset done
          </label>
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <div style={{ marginBottom: '5px' }}>
          <strong>Effort:</strong>
          <label style={{ marginLeft: '10px' }}>
            <input
              type="checkbox"
              checked={sessionExercise.effort_tag === 'hard'}
              onChange={(e) => handleEffortTag(e.target.checked ? 'hard' : 'good')}
            />
            - (hard)
          </label>
          <label style={{ marginLeft: '10px' }}>
            <input
              type="checkbox"
              checked={sessionExercise.effort_tag === 'easy'}
              onChange={(e) => handleEffortTag(e.target.checked ? 'easy' : 'good')}
            />
            + (easy)
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>
          <strong>Notes:</strong>
          <textarea
            value={sessionExercise.next_time_note || ''}
            onChange={(e) => handleNotesChange(e.target.value)}
            style={{ width: '100%', minHeight: '60px', padding: '8px', marginTop: '5px' }}
            placeholder="Notes for next time..."
          />
        </label>
      </div>
    </div>
  );
}
