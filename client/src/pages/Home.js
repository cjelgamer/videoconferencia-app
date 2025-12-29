import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function Home() {
  const [loading, setLoading] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [createdRoomId, setCreatedRoomId] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const createRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const backendUrl = '/api/rooms';

      const response = await axios.post(backendUrl, {
        creatorId: user.id
      });

      const { roomId } = response.data;
      setCreatedRoomId(roomId);
    } catch (error) {
      console.error("Error creating room:", error);
      setError("Error al crear sala. ¿Está el servidor corriendo?");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!roomCode.trim()) {
      setError('Por favor ingresa un código de sala');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Validate that room exists
      const response = await axios.get(`/api/rooms/${roomCode.toUpperCase()}`);

      if (response.data && response.data.room) {
        // Room exists, navigate to it
        navigate(`/room/${roomCode.toUpperCase()}`);
      } else {
        setError('La sala no existe. Verifica el código.');
      }
    } catch (error) {
      console.error('Error joining room:', error);
      // If 404, it means room doesn't exist
      if (error.response && error.response.status === 404) {
        setError('La sala no existe. Verifica el código.');
      } else {
        // If other error (e.g. network), let them try to join anyway in case it's a false negative
        console.warn("Error validating room, attempting to join anyway:", error);
        navigate(`/room/${roomCode.toUpperCase()}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(createdRoomId);
    alert('Código copiado al portapapeles!');
  };

  const goToRoom = () => {
    navigate(`/room/${createdRoomId}`);
  };

  if (createdRoomId) {
    return (
      <div className="fade-in" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px'
      }}>
        <div className="card" style={{ maxWidth: '500px', width: '90%', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
            ¡Sala Creada!
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Comparte este código con los participantes:
          </p>
          <div style={{
            padding: '20px',
            background: '#f0f7ff',
            border: '2px solid var(--accent-primary)',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 'bold',
              color: 'var(--accent-primary)',
              letterSpacing: '0.2em',
              fontFamily: 'monospace'
            }}>
              {createdRoomId}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
            <button className="btn" onClick={copyRoomCode} style={{ width: '100%' }}>
              📋 Copiar Código
            </button>
            <button
              className="btn"
              onClick={goToRoom}
              style={{
                width: '100%',
                background: 'var(--accent-primary)'
              }}
            >
              Entrar a la Sala
            </button>
            <button
              onClick={() => setCreatedRoomId('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                padding: '10px',
                textDecoration: 'underline'
              }}
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          Hola, <strong style={{ color: 'var(--text-primary)' }}>{user?.nombre}</strong>
        </span>
        <button
          onClick={logout}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Cerrar Sesión
        </button>
      </div>

      <div className="card" style={{ maxWidth: '500px', width: '90%', textAlign: 'center' }}>
        <h1 style={{
          marginBottom: '0.5rem',
          fontSize: '2.5rem',
          color: 'var(--accent-primary)',
          fontWeight: '600'
        }}>
          Videoconferencia
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: '2rem',
          lineHeight: '1.6'
        }}>
          Conecta con tus amigos y colegas. Comparte PDFs, pantalla y chatea en tiempo real.
        </p>

        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '1rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {!showJoin ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              className="btn"
              onClick={createRoom}
              disabled={loading}
              style={{ width: '100%', fontSize: '1.1rem' }}
            >
              {loading ? 'Creando...' : '🎥 Nueva Reunión'}
            </button>
            <button
              className="btn"
              onClick={() => setShowJoin(true)}
              style={{
                width: '100%',
                fontSize: '1.1rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              📱 Unirse a Reunión
            </button>
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="Ingresa el código"
              style={{
                width: '100%',
                padding: '15px',
                marginBottom: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '1.2rem',
                textAlign: 'center',
                letterSpacing: '0.2em',
                fontFamily: 'monospace',
                textTransform: 'uppercase'
              }}
              maxLength="8"
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn"
                onClick={joinRoom}
                style={{ flex: 1, fontSize: '1.1rem' }}
              >
                Unirse
              </button>
              <button
                onClick={() => {
                  setShowJoin(false);
                  setRoomCode('');
                  setError('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '1.1rem'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
