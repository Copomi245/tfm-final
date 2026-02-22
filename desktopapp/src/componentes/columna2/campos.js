import React ,{ useState } from 'react';
import { Typography, TextField, Box, Grid, FormControlLabel, Checkbox } from '@mui/material';import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import FechaCampos from './fecha';
import dayjs from 'dayjs';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateField } from '@mui/x-date-pickers/DateField';




const Item = styled(Paper)(({ theme }) => ({
  
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  
}));





function CamposBusqueda({selectedNetwork,
             onPalabrasChange, 
            onFraseExactaChange,
            onCualquieraPalabrasChange,
            onNingunaPalabrasChange,
            onHashtagsChange,
            onUsuarioBusquedaChange,
            onFechaDesdeSelect,
            onFechaHastaSelect,
            onRecurrenteChange,
            onRecurrenteHastaChange 
        }){

    const [esRecurrente, setEsRecurrente] = useState(false);
  const [recurrenteHasta, setRecurrenteHasta] = useState(null);

  const handleRecurrenteChange = (checked) => {
    setEsRecurrente(checked);
    onRecurrenteChange(checked);
    
    // Si se desactiva, limpiar fecha límite
    if (!checked) {
      setRecurrenteHasta(null);
      onRecurrenteHastaChange(null);
    }
  };

  const handleRecurrenteHastaChange = (fecha, hasError) => {
    if (!hasError && fecha) {
      setRecurrenteHasta(fecha);
      onRecurrenteHastaChange(fecha.format('YYYY-MM-DD'));
    } else {
      setRecurrenteHasta(null);
      onRecurrenteHastaChange(null);
    }
  };


  return(
    <Box sx={{ flexGrow: 1 }}>
      <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
 
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Palabras" id="fullWidth" helperText="Ejemplo: qué pasa · contiene tanto “qué” como “pasa”"  disabled={!selectedNetwork}      
            onChange={(e) => onPalabrasChange(e.target.value)}/>
            </Box>
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Frase exacta" id="fullWidth" helperText="Ejemplo: hora feliz · contiene la frase exacta “hora feliz”" disabled={!selectedNetwork}
            onChange={(e) => onFraseExactaChange(e.target.value)}/>
            </Box> 
        </Grid>
        
       {selectedNetwork === "bluesky" ? (
            <>
               
            </>
            ) : (
            <>
                <Grid size={{xs: 12, md: 6}}>
                <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
                    <TextField fullWidth label="Cualquiera de estas palabras" id="fullWidth" helperText="Ejemplo: gatos perros · contiene 'gatos' o 'perros' (o ambos)" disabled={!selectedNetwork}
                    onChange={(e) => onCualquieraPalabrasChange(e.target.value)}/>
                </Box> 
                </Grid>
                <Grid size={{xs: 12, md: 6}}>
                <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
                    <TextField fullWidth label="Ninguna de estas palabras" id="fullWidth" helperText="Ejemplo: gatos perros · no contiene 'gatos' y no contiene 'perros'" disabled={!selectedNetwork}
                    onChange={(e) => onNingunaPalabrasChange(e.target.value)}/>
                </Box> 
                </Grid>
            </>
            )
            
        }
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Hastags" id="fullWidth" helperText="Ejemplo: #Valladolid · contiene el hashtag #valladolid" disabled={!selectedNetwork}
            onChange={(e) => onHashtagsChange(e.target.value)}/>
            </Box> 
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <TextField fullWidth label="Usuario" id="fullWidth" helperText="Ejemplo: @UVa_es · enviado desde @UVa_es" disabled={!selectedNetwork}
            onChange={(e) => onUsuarioBusquedaChange(e.target.value)}/>
            </Box> 
        </Grid>
        {!esRecurrente &&(
            <>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <FechaCampos label="Fecha de inicio" onFechaChange={onFechaDesdeSelect} selectedNetwork={selectedNetwork} disableFuture={true}
            />
            </Box> 
        </Grid>
        <Grid size={{xs: 12, md: 6}}>
            <Box sx={{ width: 500, maxWidth: '100%', mt:1}}>
            <FechaCampos label="Fecha de fin" 
            onFechaChange={onFechaHastaSelect} selectedNetwork={selectedNetwork} disableFuture={true} />
            </Box> 
        </Grid>
        </>
)}
        <Grid item size={{xs: 12, md: 12}}>
          <Box sx={{ mt: 1 }}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={esRecurrente}
                onChange={(e) => handleRecurrenteChange(e.target.checked)}
                color="primary"
              />
            }
            label="Búsqueda programada automática"
          />
          
          {esRecurrente && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              
              <FechaCampos label="Repetir hasta" onFechaChange={handleRecurrenteHastaChange} selectedNetwork={selectedNetwork} disablePast={true}/>
            </Box>
          )}
        </Box>
        </Grid>
  
      </Grid>
    </Box>
  );
}

export default CamposBusqueda;