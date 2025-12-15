import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const API_URL = '/api/auth';

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                setToken(storedToken);
                try {
                    const response = await axios.get(`${API_URL}/me`, {
                        headers: { Authorization: `Bearer ${storedToken}` }
                    });
                    setUser(response.data.user);
                } catch (error) {
                    console.error('Token verification failed:', error);
                    logout();
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const verifyToken = async () => {
        // Kept for backward compatibility if needed, but logic moved to useEffect
    };

    const register = async (nombre, email, password) => {
        try {
            const response = await axios.post(`${API_URL}/register`, {
                nombre,
                email,
                password
            });

            const { token: newToken, user: newUser } = response.data;
            setToken(newToken);
            setUser(newUser);
            localStorage.setItem('token', newToken);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Error al registrar'
            };
        }
    };

    const login = async (email, password) => {
        try {
            const response = await axios.post(`${API_URL}/login`, {
                email,
                password
            });

            const { token: newToken, user: newUser } = response.data;
            setToken(newToken);
            setUser(newUser);
            localStorage.setItem('token', newToken);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.error || 'Error al iniciar sesión'
            };
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
    };

    const value = {
        user,
        token,
        loading,
        register,
        login,
        logout,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
