import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

const JobParams = ({ params, job }) => {
    if (!params || typeof params !== 'object') {
        return <Typography variant="body2">No parameters</Typography>;
    }

    const preferredOrder = [
        'palabras',
        'fraseExacta',
        'busqueda1', 
        'busqueda2',
        'busqueda3', 
        'busqueda4',
        'hashtags',
        'usuarioBusqueda',
        'fechaDesde',
        'fechaHasta',
        'tweetsLimit',
        'query',
        'keywords',
        'since',
        'until',
        'esRecurrente',
        'recurrenteHasta'
    ];

    const hiddenParams = [
        'esPadre',          
        'bullmq_id',        
        'user_id',
        'platform',
        'status',
        'limit',
        'tweetsLimit'
    ];

    const formatKey = (key) => {
        const translations = {
            'busqueda1': 'Palabras2',
            'busqueda2': 'Frase Exacta', 
            'busqueda3': 'Puede contener',
            'busqueda4': 'No contiene:',
            'fechaDesde': 'Desde',
            'fechaHasta': 'Hasta',
            'tweetsLimit': 'Límite',
            'query': 'Consulta',
            'keywords': 'Palabras clave',
            'since': 'Desde fecha',
            'until': 'Hasta fecha',
            'palabras': 'Palabras',
            'fraseExacta': 'Frase Exacta', 
            'fechaDesde': 'Desde',
            'hashtags': 'Hashtags',
            'usuarioBusqueda': 'Usuario',
            'esRecurrente': 'Tipo',
            'recurrenteHasta': 'Recurrente hasta'
        };
        return translations[key] || key;
    };

    const formatValue = (key, value) => {
        if (value === null || value === '') return 'N/A';
        if (key === 'tweetsLimit' || key === 'limit') return `${value} items`;
        if (key === 'esRecurrente') return value ? 'Recurrente' : 'Único';
        return value.toString();
    };

    const filteredEntries = Object.entries(params)
        .filter(([key, value]) => {
            // Ocultar parámetros técnicos específicos
            if (hiddenParams.includes(key)) {
                return false;
            }
            
            if (key === 'esRecurrente' || key === 'recurrenteHasta') {
                return true;
            }
            
            return value !== null && value !== undefined && value !== '' && value !== 'N/A';
        });

    const orderedEntries = filteredEntries
        .sort(([keyA], [keyB]) => {
            const indexA = preferredOrder.indexOf(keyA);
            const indexB = preferredOrder.indexOf(keyB);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return keyA.localeCompare(keyB);
        });

    if (orderedEntries.length === 0) {
        return <Typography variant="body2">No parameters</Typography>;
    }

    return (
        <Box sx={{ mt: 1, mb: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
                <strong>Parámetros de búsqueda: {}</strong>
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {orderedEntries.map(([key, value]) => (
                    <Chip
                        key={key}
                        label={`${formatKey(key)}: ${formatValue(key, value)}`}
                        size="small"
                        variant="outlined"
                        sx={{ 
                            fontSize: '0.75rem',
                            height: '24px',
                            ...(key === 'esRecurrente' && value === true && {
                                backgroundColor: '#e3f2fd',
                                borderColor: '#2196f3'
                            }),
                            ...(key === 'recurrenteHasta' && {
                                backgroundColor: '#fff3e0',
                                borderColor: '#ff9800'
                            })
                        }}
                    />
                ))}
            </Box>
        </Box>
    );
};

export default JobParams;