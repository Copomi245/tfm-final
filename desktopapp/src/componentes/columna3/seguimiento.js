import React ,{ useState } from 'react';
import { styled } from '@mui/material/styles';
import FechaCampos from '../columna2/fecha';

import { Grid, Typography, TextField, Button, Paper, Box, FormControlLabel, Checkbox, MenuItem, Select } from '@mui/material';




const Item = styled(Paper)(({ theme }) => ({
  
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  
}));


function Alfate(){

    const [selectedNetwork, setSelectedNetwork] = React.useState(null);
      const [scheduledSearch, setScheduledSearch] = React.useState(false);
      const [interval, setInterval] = React.useState(30);
    return(
        
        <Box sx={{ mt: 3, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={scheduledSearch}
                onChange={(e) => setScheduledSearch(e.target.checked)}
                color="primary"
              />
            }
            label="Búsqueda programada automática"
          />
          
          {scheduledSearch && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body1">Repetir hasta:</Typography>
              <FechaCampos disablePast="true"/>
            </Box>
          )}
        </Box>
    );
}


function Seguimiento(){

  


  return(
    <Box sx={{ flexGrow: 1 }}>
      <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
 
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Palabras" id="fullWidth" helperText="Ejemplo: qué pasa · contiene tanto “qué” como “pasa”"/>
            </Box>
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Frase exacta" id="fullWidth" helperText="Ejemplo: hora feliz · contiene la frase exacta “hora feliz”"/>
            </Box> 
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Cualquiera de estas palabras" id="fullWidth" helperText="Ejemplo: gatos perros · contiene “gatos” o “perros” (o ambos)"/>
            </Box> 
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Ninguna de estas palabras" id="fullWidth" helperText="Ejemplo: gatos perros · no contiene “gatos” y no contiene “perros”"/>
            </Box> 
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Hastags" id="fullWidth" helperText="Ejemplo: #JuevesDeAntaño · contiene el hashtag #JuevesDeAntaño"/>
            </Box> 
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Usuario" id="fullWidth" helperText="Ejemplo: @X · enviado desde @X"/>
            </Box> 
        </Grid>
        
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <FechaCampos label="Fecha de inicio"/>
            </Box> 
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <FechaCampos label="Fecha de fin"/>
            </Box> 
        </Grid>
  
      </Grid>
    </Box>
  );
}

export default Alfate;