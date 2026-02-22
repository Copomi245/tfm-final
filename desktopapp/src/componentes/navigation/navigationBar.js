import React from 'react';
import { Button, Box, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

const NavigationBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="h6" sx={{ mr: 4 }}>
        AppScraping
      </Typography>
      
      <Button 
        color="inherit" 
        onClick={() => navigate('/')}
        sx={{ 
          mr: 2, 
          fontWeight: location.pathname === '/' ? 'bold' : 'normal',
          backgroundColor: location.pathname === '/' ? 'rgba(0, 0, 0, 0.1)' : 'transparent'
        }}
      >
        Principal
      </Button>
      
      <Button 
        color="inherit" 
        onClick={() => navigate('/jobs')}
        sx={{ 
          fontWeight: location.pathname === '/jobs' ? 'bold' : 'normal',
          backgroundColor: location.pathname === '/jobs' ? 'rgba(0, 0, 0, 0.1)' : 'transparent'
        }}
      >
        Trabajos
      </Button>
    </Box>
  );
};

export default NavigationBar;