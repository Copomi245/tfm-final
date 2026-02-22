import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Card,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button
} from '@mui/material';
import { AccountCircle, Logout, FilterList, Clear } from '@mui/icons-material';
import NavigationBar from '../../componentes/navigation/navigationBar';
import JobList from '../../componentes/trabajos/jobsList';
import { useDebounce } from '../../hooks/useDebounce';

const JobsPage = () => {
  const [user, setUser] = React.useState(localStorage.getItem('userEmail'));
  const [filters, setFilters] = useState({
    status: '',
    platform: '',
    search: '',
    //esPadre: 'true' 
});
  const [tempSearch, setTempSearch] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const debouncedSearch = useDebounce(tempSearch, 500);

  const handleLogout = () => {
    localStorage.removeItem('apiKey');
    localStorage.removeItem('userEmail');
    setUser(null);
    window.location.href = '/';
  };

  const handleFilterChange = (filter, value) => {
    setFilters(prev => ({ ...prev, [filter]: value }));
  };

  const handleSearchChange = (e) => {
    setTempSearch(e.target.value);
  };

  const handleClearFilters = () => {
    setFilters({
      status: '',
      platform: '',
      search: ''
    });
    setTempSearch(''); 
    setRefreshTrigger(prev => prev + 1);
  };

  // Efecto para sincronizar el debouncedSearch con los filters
  useEffect(() => {
    setFilters(prev => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#a50034' }}>
      {/* Header con navegación y usuario */}
      <AppBar position="static" sx={{ bgcolor: 'white', color: 'black', mb: 2 }}>
        <Toolbar>
          <NavigationBar currentPage="jobs" />
          
          <Box display="flex" alignItems="center" sx={{ ml: 'auto' }}>
            <AccountCircle sx={{ mr: 1 }} />
            <Typography variant="body1" sx={{ mr: 2 }}>
              {user}
            </Typography>
            <IconButton color="inherit" onClick={handleLogout}>
              <Logout />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Contenido de la página de trabajos */}
      <Box sx={{ p: 3 }}>
        <Paper elevation={8} sx={{ maxWidth: 1000, margin: 'auto', p: 3 }}>
          {/* Título */}
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
            Mis Trabajos de Scraping
          </Typography>

          {/* Filtros integrados en la página */}
          <Card sx={{ mb: 3, p: 2, bgcolor: 'grey.50' }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <FilterList color="primary" />
                <Typography variant="h6">
                  Filtros de Búsqueda
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Clear />}
                onClick={handleClearFilters}
                disabled={!filters.status && !filters.platform && !filters.search}
              >
                Limpiar Filtros
              </Button>
            </Box>

            <Grid container spacing={2} alignItems="center">
              {/* FILTRO ESTADO */}
              <Grid item xs={12} md={3} lg={2.5}>
                <FormControl fullWidth>
                  <InputLabel>Estado</InputLabel>
                  <Select
                    value={filters.status}
                    label="Estado"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="">Todos los estados</MenuItem>
                    <MenuItem value="waiting">En espera</MenuItem>
                    <MenuItem value="processing">Procesando</MenuItem>
                    <MenuItem value="completed">Completados</MenuItem>
                    <MenuItem value="failed">Fallidos</MenuItem>
                    <MenuItem value="cancelled">Cancelados</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* FILTRO PLATAFORMA */}
              <Grid item xs={12} md={3} lg={2.5}>
                <FormControl fullWidth>
                  <InputLabel>Plataforma</InputLabel>
                  <Select
                    value={filters.platform}
                    label="Plataforma"
                    onChange={(e) => handleFilterChange('platform', e.target.value)}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="">Todas las plataformas</MenuItem>
                    <MenuItem value="twitter">Twitter</MenuItem>
                    <MenuItem value="bluesky">Bluesky</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* CAMPO BÚSQUEDA CON DEBOUNCE */}
              <Grid item xs={12} md={6} lg={7}>
                <TextField
                  fullWidth
                  label="Buscar en parámetros"
                  value={tempSearch} 
                  onChange={handleSearchChange} 
                  placeholder="Ej: madrid, barcelona..."
                />
              </Grid>
            </Grid>
          </Card>

          {/* Lista de trabajos */}
          <JobList 
            filters={filters}
            refreshTrigger={refreshTrigger}
            key={`${refreshTrigger}-${filters.search}`} 
          />
        </Paper>
      </Box>
    </Box>
  );
};

export default JobsPage;