import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Day } from '../api';

export default function Home() {
  const [days, setDays] = useState<Day[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [daysData, activeSession] = await Promise.all([
        api.getDays(),
        api.getActiveSession(),
      ]);
      setDays(daysData);
      setActiveSessionId(activeSession);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (dayId: number) => {
    try {
      const result = await api.startSession(dayId);
      navigate(`/session/${result.session_id}`);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const handleResumeSession = () => {
    if (activeSessionId) {
      navigate(`/session/${activeSessionId}`);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Workout Tracker</h1>

      {activeSessionId ? (
        <div>
          <h2>Resume Workout</h2>
          <button
            onClick={handleResumeSession}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Resume Workout
          </button>
        </div>
      ) : (
        <div>
          <h2>Select Workout Day</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {days.map((day) => (
              <button
                key={day.id}
                onClick={() => handleStartSession(day.id)}
                style={{
                  padding: '15px',
                  fontSize: '16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
