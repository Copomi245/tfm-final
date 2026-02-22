import React from 'react';
import { Button, Typography } from '@mui/material';
import twitterLogo from '../../imagenes/twitter.png';
import blueskyLogo from '../../imagenes/bluesky.png';

function Redes() {
  const handleClick = () => {
    console.log("CLICKED");
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center', 
      gap: '8px' 
    }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 1 }}>
        Red Social
      </Typography>
      <Button
        variant="outlined"
        sx={{ 
          p: 0.5,
          width: '120px', 
          height: '40px',
          border: '1px solid #ddd',
          '&:hover': { borderColor: '#1976d2' }
        }}
        onClick={handleClick}
      >
        <img 
          src={twitterLogo}
          alt="Twitter"
          style={{
            width: '100%',
            height: '30px',
            objectFit: 'contain'
          }}
        />
      </Button>
      <Button
        variant="outlined"
        sx={{ 
          p: 0.5,
          width: '120px', 
          height: '40px',
          border: '1px solid #ddd',
          '&:hover': { borderColor: '#1976d2' }
        }}
        onClick={handleClick}
      >
        <img 
          src={blueskyLogo}
          alt="Bluesky"
          style={{
            width: '100%',
            height: '30px',
            objectFit: 'contain'
          }}
        />
      </Button>
    </div>
  );
}

export default Redes;