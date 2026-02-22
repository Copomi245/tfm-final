import React, { useCallback, useState, useEffect } from 'react';
import {
  Grid, Typography, Button, Paper, Box, AppBar, Toolbar, IconButton
} from '@mui/material';
import { AccountCircle, Logout } from '@mui/icons-material';
import Redes2 from '../../componentes/columna1/redes2.js';
import CamposBusqueda from '../../componentes/columna2/campos.js';
import Alfate from '../../componentes/columna3/seguimiento.js';
import Login from '../../componentes/login/Login.js';
import NavigationBar from '../../componentes/navigation/navigationBar';
import { setupApiClient } from '../../services/api.js';
import api from '../../services/api';
import { Alert, Snackbar } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

const SocialMediaForm = () => {
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [palabras, setPalabras] = useState(null);
  const [fraseExacta, setFraseExacta] = useState(null);
  const [cualquieraPalabras, setCualquieraPalabras] = useState(null);
  const [ningunaPalabras, setNingunaPalabras] = useState(null);
  const [hashtags, setHashtags] = useState(null);
  const [usuarioBusqueda, setUsuarioBusqueda] = useState(null);
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [esRecurrente, setEsRecurrente] = useState(false);
  const [recurrenteHasta, setRecurrenteHasta] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    const checkAuth = () => {
      const savedApiKey = localStorage.getItem('apiKey');
      const savedEmail = localStorage.getItem('userEmail');
      
      if (savedApiKey && savedEmail) {
        setupApiClient(savedApiKey);
        setApiKey(savedApiKey);
        setUser(savedEmail);
      } else {
        setLoginOpen(true);
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (newApiKey, email) => {
    setApiKey(newApiKey);
    setUser(email);
    setLoginOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('apiKey');
    localStorage.removeItem('userEmail');
    setApiKey(null);
    setUser(null);
    setLoginOpen(true);
  };

  const handleNetworkSelection = useCallback((network) => {
    setSelectedNetwork(network);
  }, []);

  const handlePalabras = useCallback((palabras) => {
    setPalabras(palabras);
  }, []);

  const handleFraseExacta = useCallback((fraseExacta) => {
    setFraseExacta(fraseExacta);
  }, []);

  const handleCualquieraPalabras = useCallback((cualquieraPalabras) => {
    setCualquieraPalabras(cualquieraPalabras);
  }, []);

  const handleNingunaPalabras = useCallback((ningunaPalabras) => {
    setNingunaPalabras(ningunaPalabras);
  }, []);

  const handleHashtags = useCallback((hashtags) => {
    setHashtags(hashtags);
  }, []);

  const handleUsuarioBusqueda = useCallback((usuarioBusqueda) => {
    setUsuarioBusqueda(usuarioBusqueda);
  }, []);

  const handleFechaDesde = (fecha, hasError) => {
    if (!hasError && fecha) { 
      setFechaDesde(fecha.format('YYYY-MM-DD'));
    } else {
      setFechaDesde(null);
    }
  };

  const handleFechaHasta = (fecha, hasError) => {
    if (!hasError && fecha) { 
      setFechaHasta(fecha.format('YYYY-MM-DD'));
    } else {
      setFechaHasta(null);
    }
  };

  const handleRecurrenteChange = useCallback((isRecurrente) => {
    setEsRecurrente(isRecurrente);
    // Limpiar fechas normales si se activa recurrente
    if (isRecurrente) {
      setFechaDesde('');
      setFechaHasta('');
    }
  }, []);

  const handleRecurrenteHastaChange = useCallback((fecha) => {
    setRecurrenteHasta(fecha);
  }, []);

  const resetForm = () => {
    setSelectedNetwork(null);
    setPalabras(null);
    setFraseExacta(null);
    setCualquieraPalabras(null);
    setNingunaPalabras(null);
    setHashtags(null);
    setUsuarioBusqueda(null);
    setFechaDesde('');
    setFechaHasta('');
    setEsRecurrente(false);
    setRecurrenteHasta('');
  };

  const handleConfirm = async () => {
    if (!selectedNetwork) {
        setSnackbar({ open: true, message: 'Por favor selecciona una red social', severity: 'warning' });
        return;
    }

    if (!palabras && !fraseExacta && !hashtags && !usuarioBusqueda) {
        setSnackbar({ open: true, message: 'Por favor completa al menos un campo de búsqueda', severity: 'warning' });
        return;
    }

    if (esRecurrente && !recurrenteHasta) {
        setSnackbar({ open: true, message: 'Por favor selecciona una fecha límite para búsquedas recurrentes', severity: 'warning' });
        return;
    }

    setLoading(true);

    try {
        const jobData = {
            palabras: palabras || '',
            fraseExacta: fraseExacta || '',
            cualquieraPalabras: cualquieraPalabras || '',
            ningunaPalabras: ningunaPalabras || '',
            hashtags: hashtags || '',
            usuarioBusqueda: usuarioBusqueda || '',
            fechaDesde: (esRecurrente==true?new Date().toISOString().split('T')[0]:(fechaDesde || '')),
            fechaHasta: (esRecurrente==true?recurrenteHasta:((fechaDesde && !fechaHasta) ? new Date().toISOString().split('T')[0] : (fechaHasta || ''))),
            tweetsLimit: 10,
            esRecurrente: esRecurrente,
            recurrenteHasta: recurrenteHasta
        };

        let response;
        let endpoint;
        
        if (selectedNetwork === 'bluesky') {
            endpoint = '/scraping/bluesky';
        } else if (selectedNetwork === 'twitter') {
            endpoint = '/scraping/twitter'; 
        }

        response = await api.post(endpoint, jobData);

        setSnackbar({ 
            open: true, 
            message: esRecurrente 
                ? `Trabajo recurrente de ${selectedNetwork} programado hasta ${recurrenteHasta}` 
                : `Trabajo de ${selectedNetwork} iniciado correctamente. ID: ${response.data.jobId || response.data.trabajoPadreId}`, 
            severity: 'success' 
        });

        resetForm();

    } catch (error) {
        console.error('Error al iniciar el trabajo:', error);
        setSnackbar({ 
            open: true, 
            message: error.response?.data?.error || 'Error al iniciar el trabajo', 
            severity: 'error' 
        });
    } finally {
        setLoading(false);
    }
};

  if (!user) {
    return (
      <Login 
        open={loginOpen} 
        onClose={() => {}} 
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#a50034' }}>
      <AppBar position="static" sx={{ bgcolor: 'white', color: 'black', mb: 2 }}>
        <Toolbar>
          <NavigationBar currentPage="main" />
          <Box display="flex" alignItems="center" sx={{ ml: 'auto' }}>
            <AccountCircle sx={{ mr: 1 }} />
            <Typography variant="body1" sx={{ mr: 2 }}>{user}</Typography>
            <IconButton color="inherit" onClick={handleLogout}><Logout /></IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        <Paper elevation={8} sx={{ maxWidth: 800, margin: 'auto', p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
            Selecciona tu red social
          </Typography>
          
          <Redes2 
            selectedNetwork={selectedNetwork}
            onNetworkSelect={handleNetworkSelection}
          />

          <CamposBusqueda 
            selectedNetwork={selectedNetwork} 
            onPalabrasChange={handlePalabras}
            onFraseExactaChange={handleFraseExacta}
            onCualquieraPalabrasChange={handleCualquieraPalabras}
            onNingunaPalabrasChange={handleNingunaPalabras}
            onHashtagsChange={handleHashtags}
            onUsuarioBusquedaChange={handleUsuarioBusqueda}
            onFechaDesdeSelect={handleFechaDesde}
            onFechaHastaSelect={handleFechaHasta}
            onRecurrenteChange={handleRecurrenteChange}
            onRecurrenteHastaChange={handleRecurrenteHastaChange}
          />

          
          <Grid container spacing={2} sx={{ mt: 4 }} justifyContent="center">
            <Grid item xs={12} sm={8} md={6} lg={4}>
              <Button 
                fullWidth 
                variant="contained" 
                color="primary" 
                size="large"
                onClick={handleConfirm}
                disabled={loading || !selectedNetwork}
              >
                {loading ? <CircularProgress size={24} /> : 'Confirmar'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Box>
  );
};

export default SocialMediaForm;