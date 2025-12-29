import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        nombre: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let result;
            if (isLogin) {
                result = await login(formData.email, formData.password);
            } else {
                if (!formData.nombre) {
                    setError('El nombre es requerido');
                    setLoading(false);
                    return;
                }
                result = await register(formData.nombre, formData.email, formData.password);
            }

            if (result.success) {
                navigate('/');
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-in" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px'
        }}>
            <div className="card" style={{ maxWidth: '450px', width: '100%' }}>
                <h1 style={{
                    marginBottom: '0.5rem',
                    fontSize: '2.5rem',
                    color: 'var(--accent-primary)',
                    textAlign: 'center',
                    fontWeight: '600'
                }}>
                    Videoconferencia
                </h1>
                <p style={{
                    color: 'var(--text-secondary)',
                    marginBottom: '2rem',
                    textAlign: 'center'
                }}>
                    {isLogin ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
                </p>

                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                color: 'var(--text-primary)',
                                fontWeight: '500'
                            }}>
                                Nombre
                            </label>
                            <input
                                type="text"
                                name="nombre"
                                value={formData.nombre}
                                onChange={handleChange}
                                placeholder="Tu nombre"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem'
                                }}
                                required={!isLogin}
                            />
                        </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: 'var(--text-primary)',
                            fontWeight: '500'
                        }}>
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="tu@email.com"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem'
                            }}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            color: 'var(--text-primary)',
                            fontWeight: '500'
                        }}>
                            Contraseña
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '1rem'
                            }}
                            required
                            minLength="6"
                        />
                    </div>

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

                    <button
                        type="submit"
                        className="btn"
                        disabled={loading}
                        style={{ width: '100%', fontSize: '1.1rem', marginBottom: '1rem' }}
                    >
                        {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
                    </button>

                    <div style={{ textAlign: 'center' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                                setFormData({ nombre: '', email: '', password: '' });
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                textDecoration: 'underline'
                            }}
                        >
                            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Login;
