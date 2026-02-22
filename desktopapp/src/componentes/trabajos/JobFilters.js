import React from 'react';
import {
    Card,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Box,
    Button
} from '@mui/material';
import { FilterList, Clear } from '@mui/icons-material';

const JobFilters = ({ filters, onFilterChange, onClearFilters }) => {
    return (
        <Card sx={{ mb: 3, p: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                    <FilterList color="primary" />
                    <strong>Filtros de búsqueda</strong>
                </Box>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Clear />}
                    onClick={onClearFilters}
                    disabled={!filters.status && !filters.platform && !filters.search}
                >
                    Limpiar
                </Button>
            </Box>
            
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                        <InputLabel>Estado</InputLabel>
                        <Select
                            value={filters.status}
                            label="Estado"
                            onChange={(e) => onFilterChange('status', e.target.value)}
                        >
                            <MenuItem value="">Todos</MenuItem>
                            <MenuItem value="waiting">En espera</MenuItem>
                            <MenuItem value="processing">Procesando</MenuItem>
                            <MenuItem value="completed">Completados</MenuItem>
                            <MenuItem value="failed">Fallidos</MenuItem>
                            <MenuItem value="cancelled">Cancelados</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                        <InputLabel>Plataforma</InputLabel>
                        <Select
                            value={filters.platform}
                            label="Plataforma"
                            onChange={(e) => onFilterChange('platform', e.target.value)}
                        >
                            <MenuItem value="">Todas</MenuItem>
                            <MenuItem value="twitter">Twitter</MenuItem>
                            <MenuItem value="bluesky">Bluesky</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <TextField
                        fullWidth
                        label="Buscar"
                        value={filters.search}
                        onChange={(e) => onFilterChange('search', e.target.value)}
                        placeholder="Buscar en parámetros..."
                    />
                </Grid>
            </Grid>
        </Card>
    );
};

export default JobFilters;