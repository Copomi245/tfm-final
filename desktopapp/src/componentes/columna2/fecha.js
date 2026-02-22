import React, { useState } from 'react';
import { Box } from '@mui/material';
import dayjs from 'dayjs';
import isLeapYear from 'dayjs/plugin/isLeapYear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

dayjs.extend(isLeapYear);

const isValidDate = (dateString, format = 'DD-MM-YYYY', disablePast = false) => {
  // Parsear la fecha con el formato especificado
  const date = dayjs(dateString, format, true);
  
  // Verificar si el parsing fue exitoso
  if (!date.isValid()) {
    return { isValid: false, error: 'Formato de fecha inválido' };
  }
  
  // Verificación adicional para el día 29 de febrero
  const day = date.date();
  const month = date.month() + 1; 
  
  if (day === 29 && month === 2) {
    // Verificar si es año bisiesto
    if (!date.isLeapYear()) {
      return { isValid: false, error: '29 de febrero solo es válido en años bisiestos' };
    }
  }
  
  if (disablePast && date.isBefore(dayjs(), 'day')) {
    return { isValid: false, error: 'No se permiten fechas pasadas' };
  }
  
  return { isValid: true, error: '' };
};

const FechaCampos = ({ 
  onFechaChange, 
  titulo, 
  label,
  disablePast = false,
  disableFuture = false,
  selectedNetwork
}) => {
  const [startDateError, setStartDateError] = useState('');
  const [startDateValue, setStartDateValue] = useState(null);
  const [touched, setTouched] = useState(false);

  const handleStartDateChange = (newValue) => {
    setStartDateValue(newValue);
  setTouched(true);
    
    if (newValue) {
      const dateString = newValue.format('DD-MM-YYYY');
      const validation = isValidDate(dateString, 'DD-MM-YYYY', disablePast);
      
      if (!validation.isValid) {
        setStartDateError(validation.error);
        if (onFechaChange) onFechaChange(null, true);
      } else {
        setStartDateError('');
        if (onFechaChange) onFechaChange(newValue, false);
      }
    } else {
      setStartDateError('');
      if (onFechaChange) onFechaChange(null, false);
    }
  };

  // Función para validar manualmente al perder el foco
  const validateDateOnBlur = () => {
    setTouched(true);
    if (startDateValue) {
      const dateString = startDateValue.format('DD-MM-YYYY');
      const validation = isValidDate(dateString, 'DD-MM-YYYY', disablePast);
      
      if (!validation.isValid) {
        setStartDateError(validation.error);
        if (onFechaChange) onFechaChange(null, true);
      }
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: '100%' }}>
        <DatePicker 
          fullWidth 
          label={label}
          format="DD-MM-YYYY"
          value={startDateValue}
          onChange={handleStartDateChange}
          onBlur={validateDateOnBlur}
          disablePast={disablePast}
          disableFuture={disableFuture}
          disabled={!selectedNetwork}
          slotProps={{
            textField: {
              error: !!startDateError,
              helperText: startDateError || "Formato: día-mes-año (ej: 25-12-2023)",
              fullWidth: true
            }
          }}
          sx={{ width: '100%' }}
        />
      </Box>
    </LocalizationProvider>
  );
};

export default FechaCampos;