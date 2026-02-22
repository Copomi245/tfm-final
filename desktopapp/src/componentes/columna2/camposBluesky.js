import React ,{ useState } from 'react';
import { Typography } from '@mui/material';
import TextField from '@mui/material/TextField';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import FechaCampos from './fecha';
import dayjs from 'dayjs';
import {  Alert } from '@mui/material';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateField } from '@mui/x-date-pickers/DateField';




const Item = styled(Paper)(({ theme }) => ({
  
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  
}));





function CamposBluesky(){

  


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
            <TextField fullWidth label="Hastags" id="fullWidth" helperText="Ejemplo: #JuevesDeAntaño · contiene el hashtag #JuevesDeAntaño"/>
            </Box> 
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Usuario" id="fullWidth" helperText="Ejemplo: @uva-es.bsky.social · enviado desde @uva-es.bsky.social"/>
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

export default CamposBluesky;