const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Day {
  id: number;
  label: string;
  ordinal: number;
}

export interface Exercise {
  id: number;
  name: string;
  min_increment: number;
  active: boolean;
  notes?: string;
}

export interface Slot {
  id: number;
  day_id: number;
  ordinal: number;
  title: string;
  preferred_exercise_id: number;
  warmup_sets: string;
  working_sets_count: number;
  rep_target: string;
  rpe_range?: string;
  rest_minutes: number;
  has_dropset: boolean;
}

export interface Session {
  id: number;
  day_id: number;
  date: string;
  is_finished: boolean;
}

export interface SessionExercise {
  id: number;
  session_id: number;
  slot_id: number;
  exercise_id: number;
  effort_tag?: string;
  next_time_note?: string;
  dropset_done: boolean;
}

export interface SetEntry {
  id: number;
  session_exercise_id: number;
  set_number: number;
  weight_kg: number;
  reps: number;
  is_done: boolean;
  is_drop: boolean;
}

export interface PreviousSessionExercise {
  sets: SetEntry[];
  effort_tag?: string;
  next_time_note?: string;
}

export interface SessionExerciseWithSlot {
  session_exercise: SessionExercise;
  slot: Slot;
  exercise: Exercise;
  previous_session_exercise?: PreviousSessionExercise;
  sets: SetEntry[];
}

export interface SessionWithExercises {
  session: Session;
  day: Day;
  exercises: SessionExerciseWithSlot[];
}

export interface SaveExerciseRequest {
  notes?: string;
  effort_tag?: string;
  dropset_done?: boolean;
  sets?: Array<{
    set_number: number;
    weight_kg: number;
    reps: number;
    is_done: boolean;
  }>;
}

export interface ExerciseHistoryEntry {
  session: Session;
  day: Day;
  session_exercise: SessionExercise;
  sets: SetEntry[];
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  getDays: () => fetchApi<Day[]>('/days'),
  getActiveSession: () => fetchApi<number | null>('/session/active'),
  startSession: (dayId: number) => fetchApi<{ session_id: number }>(`/sessions/start/${dayId}`, { method: 'POST' }),
  getSession: (sessionId: number) => fetchApi<SessionWithExercises>(`/sessions/${sessionId}`),
  finishSession: (sessionId: number) => fetchApi<{ status: string }>(`/sessions/${sessionId}/finish`, { method: 'POST' }),
  saveExercise: (sessionId: number, exerciseId: number, data: SaveExerciseRequest) =>
    fetchApi<{ status: string }>(`/sessions/${sessionId}/exercises/${exerciseId}/save`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getExerciseHistory: (exerciseId: number) => fetchApi<ExerciseHistoryEntry[]>(`/exercises/${exerciseId}/history`),
};

