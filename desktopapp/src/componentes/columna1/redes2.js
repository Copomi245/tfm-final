import React from 'react';
import { Grid, Button } from '@mui/material';
import TwitterIcon from '@mui/icons-material/Twitter';
import blueskyLogo from '../../imagenes/bluesky.png';

function Redes2({ selectedNetwork, onNetworkSelect }) {
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6}>
        <Button
          fullWidth
          variant={selectedNetwork === 'twitter' ? 'contained' : 'outlined'}
          color="primary"
          startIcon={<TwitterIcon sx={{ fontSize: 30 }} />}
          sx={{
            py: 2,
            borderRadius: 1,
            borderWidth: 2,
            '&:hover': { borderWidth: 2 },
            gap: 1
          }}
          onClick={() => onNetworkSelect('twitter')}
        >
          Twitter
        </Button>
      </Grid>
      <Grid item xs={6}>
        <Button
          fullWidth
          variant={selectedNetwork === 'bluesky' ? 'contained' : 'outlined'}
          color="secondary"
          sx={{
            py: 2,
            borderRadius: 1,
            borderWidth: 2,
            '&:hover': { borderWidth: 2 },
            gap: 1
          }}
          onClick={() => onNetworkSelect('bluesky')}
        >
          <img 
            src={blueskyLogo} 
            alt="Bluesky" 
            style={{
              width: '20px',
              height: '20px',
              objectFit: 'contain'
            }} 
          />
          Bluesky
        </Button>
      </Grid>
    </Grid>
  );
}

export default Redes2;