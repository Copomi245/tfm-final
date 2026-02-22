import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { setupApiClient } from '../../services/api';

const Login = ({ open, onClose, onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  try {
    const url = isRegistering 
      ? 'http://localhost:3001/api/auth/register'
      : 'http://localhost:3001/api/auth/login';

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('apiKey', data.user.apiKey);
      localStorage.setItem('userEmail', formData.email);
      
      if (typeof setupApiClient === 'function') {
        setupApiClient(data.user.apiKey);
      }
      
      onLoginSuccess(data.user.apiKey, formData.email);
      onClose();
    } else {
      setError(data.error || 'Error de autenticación');
    }
  } catch (error) {
    setError('Error de conexión con el servidor');
  } finally {
    setLoading(false);
  }
};

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <LockIcon sx={{ mr: 1 }} />
          {isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <form onSubmit={handleSubmit}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Contraseña"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            margin="normal"
            required
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ mt: 3, mb: 2, py: 1.5 }}
          >
            {loading ? <CircularProgress size={24} /> : 
             isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
          </Button>

          <Box textAlign="center">
            <Button
              onClick={() => setIsRegistering(!isRegistering)}
              color="primary"
            >
              {isRegistering 
                ? 'Iniciar sesión' 
                : 'Registrarse'}
            </Button>
          </Box>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Login;