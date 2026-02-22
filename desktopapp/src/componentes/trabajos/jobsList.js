import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Chip,
    Grid,
    Pagination,
    Box,
    CircularProgress,
    Alert,
    Button,
    Typography,
    Collapse,
    IconButton
} from '@mui/material';

import * as MuiIconsMaterial from '@mui/icons-material';

import {
    CheckCircle,
    Error,
    Schedule,
    PlayArrow,
    Cancel,
    Download,
    ExpandMore,
    ExpandLess
} from '@mui/icons-material';
import JobParams from './JobParam';

const getStatusIcon = (status) => {
    switch (status) {
        case 'completed': return <CheckCircle color="success" />;
        case 'failed': return <Error color="error" />;
        case 'processing': return <PlayArrow color="primary" />;
        case 'waiting': return <Schedule color="warning" />;
        case 'cancelled': return <Cancel color="disabled" />;
        case 'programado': return <Schedule  color="info"/>
        default: return <Schedule/>;
    }
};

const getStatusColor = (status) => {
    switch (status) {
        case 'completed': return 'success';
        case 'failed': return 'error';
        case 'processing': return 'primary';
        case 'waiting': return 'warning';
        case 'cancelled': return 'default';
        case 'programado': return 'info';
        default: return 'default';
    }
};

const JobList = ({ filters = {}, refreshTrigger = 0 }) => {
    const [jobs, setJobs] = useState([]);
    const [childJobs, setChildJobs] = useState({});
    const [expandedParents, setExpandedParents] = useState({});
    const [loadingChildren, setLoadingChildren] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });

    const apiKey = localStorage.getItem('apiKey');

    const fetchChildJobs = async (parentId) => {
        try {
            setLoadingChildren(prev => ({ ...prev, [parentId]: true }));
            
            const response = await fetch(`http://localhost:3001/api/jobs/${parentId}/children`, {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Error al cargar trabajos hijos');
            }

            const data = await response.json();
            setChildJobs(prev => ({ ...prev, [parentId]: data.children || [] }));
        } catch (err) {
            console.error('Error fetching child jobs:', err);
        } finally {
            setLoadingChildren(prev => ({ ...prev, [parentId]: false }));
        }
    };

    const toggleExpand = async (parentId) => {
        const isExpanded = expandedParents[parentId];
        setExpandedParents(prev => ({ ...prev, [parentId]: !isExpanded }));
        
        if (!isExpanded && !childJobs[parentId]) {
            await fetchChildJobs(parentId);
        }
    };

    const fetchJobs = async (page = 1) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit: pagination.limit,
                ...filters,
                //esPadre: 'true'
            });

            const response = await fetch(`http://localhost:3001/api/jobs?${params}`, {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Error al cargar trabajos');
            }

            const data = await response.json();
            setJobs(data.jobs || []);
            setPagination(data.pagination || {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0
            });
        } catch (err) {
            setError(err.message);
            console.error('Error fetching jobs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelJob = async (jobId) => {
        try {
            const response = await fetch(`http://localhost:3001/api/jobs/${jobId}/cancel`, {
                method: 'DELETE',
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Error al cancelar trabajo');
            }

            fetchJobs(pagination.page);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDownload = async (filePath) => {
        try {
            const response = await fetch(
                `http://localhost:3001/api/download?path=${encodeURIComponent(filePath)}`, 
                {
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            const fileName = filePath.split('/').pop() || 'download.json';
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);

        } catch (error) {
            console.error('Error en descar', error);
            alert(`Error al descargar: ${error.message}`);
        }
    };

    const handlePageChange = (event, value) => {
        setPagination(prev => ({ ...prev, page: value }));
        fetchJobs(value);
    };

    useEffect(() => {
        fetchJobs(pagination.page);
    }, [filters, refreshTrigger, pagination.page]);

    const ChildJobItem = ({ job }) => {

        const getSpecificDay = () => {
        try {
            if (job.search_params) {
                const params = typeof job.search_params === 'string' 
                    ? JSON.parse(job.search_params) 
                    : job.search_params;
                
                if (params.fechaDesde) {
                    const date = new Date(params.fechaDesde);
                    return date.toLocaleDateString('es-ES', {
                        
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric'
                    });
                }
            }
            return job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Día específico';
        } catch (error) {
            return 'Día específico';
        }
    };

    const specificDay = getSpecificDay();
        return (
            <Card sx={{ ml: 3, mb: 1, bgcolor: 'grey.50' }}>
                <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                        {getStatusIcon(job.status)}
                        <Typography variant="body2">
                            {specificDay}
                        </Typography>
                        <Chip
                            label={job.status}
                            color={getStatusColor(job.status)}
                            size="small"
                        />
                        {job.result_count !== null && (
                            <Chip
                                label={`${job.result_count || 0} resultados`}
                                variant="outlined"
                                color={getStatusColor(job.status)}
                                size="small"
                            />
                        )}
                         
                    </Box>
                    {job.started_at &&(<Typography variant="body2" color="text.secondary">
                                Inicio: {new Date(job.started_at).toLocaleString()}
                        </Typography>
                    )}
                    {job.completed_at &&( <Typography variant="body2" color="text.secondary">
                                Fin: {new Date(job.completed_at).toLocaleString()}
                        </Typography>
                    )}

                    {job.started_at && job.completed_at && (
                        <Typography variant="body2" color="text.secondary">
                            Duración: {((new Date(job.completed_at) - new Date(job.started_at)) / 1000).toFixed(1)} segundos
                        </Typography>
                    )}
                    {job.file_path && job.status === 'completed' && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Download />}
                            onClick={() => handleDownload(job.file_path)}
                            sx={{ mt: 1 }}
                        >
                            Descargar
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    };

    if (loading) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
                <Typography variant="h6" sx={{ mt: 2 }}>Cargando trabajos...</Typography>
            </Box>
        );
    }

    return (
        <>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {jobs.length === 0 ? (
                <Alert severity="info">
                    No hay trabajos para mostrar. ¡Crea tu primer trabajo de scraping!
                </Alert>
            ) : (
                <>
                    {jobs.map((job) => (
                        <Card key={job.id} sx={{ mb: 2 }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                    <Box display="flex" alignItems="center" gap={1}>
                                        {getStatusIcon(job.status)}
                                        <Typography variant="h6">
                                            Trabajo {job.platform} {job.result_count}
                                        </Typography>
                                        <Chip
                                            label={job.status}
                                            color={getStatusColor(job.status)}
                                            size="small"
                                        />
                                        {job.es_padre==true?<></>:<Chip
                                            label={job.result_count}
                                            color={getStatusColor(job.status)}
                                            variant="outlined"
                                            size="small"
                                        />}
                                        
                                        {/* <Chip
                                            label={`${job.result_count || 0} resultados totales`}
                                            variant="outlined"
                                            size="small"
                                        /> */}
                                    </Box>

                                    <Box display="flex" alignItems="center" gap={1}>
                                        {job.es_padre === true ? (
                                                    <>
                                                       <IconButton
                                                            size="small"
                                                            onClick={() => toggleExpand(job.id)}
                                                        >
                                                            {expandedParents[job.id] ? <ExpandLess /> : <ExpandMore />}
                                                        </IconButton>
                                                    </>
                                                    ) : (
                                                    <>
                                                        
                                                    </>
                                                    )
                                                    
                                                }
                                        
                                    </Box>
                                </Box>

                                {/* <Typography variant="body2" color="text.secondary" gutterBottom>
                                    ID: {job.bullmq_id}
                                </Typography> */}

                                <JobParams params={job.search_params} job={job}/>

                                <Typography variant="body2" color="text.secondary">
                                    Creado: {new Date(job.created_at).toLocaleString()} 
                                </Typography>
                                
                                {job.completed_at &&<Typography variant="body2" color="text.secondary">
                                    Completado: {new Date(job.completed_at).toLocaleString()}
                                </Typography>
                                }
                                
                                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                                     {job.file_path && 
                                        typeof job.file_path === 'string' && 
                                        job.file_path.trim() !== '' && 
                                        job.status === 'completed' && (
                                            <Button
                                                variant="outlined"
                                                startIcon={<Download />}
                                                onClick={() => handleDownload(job.file_path)}
                                                sx={{ mt: 1 }}
                                            >
                                                Descargar
                                            </Button>
                                        )}

                                    {(job.status === 'waiting' || job.status === 'processing'|| job.status === 'programado') && (
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            startIcon={<Cancel />}
                                            onClick={() => handleCancelJob(job.id)}
                                            size="small"
                                        >
                                            Cancelar todo
                                        </Button>
                                    )}
                                </Box>

                                <Collapse in={expandedParents[job.id]}>
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Trabajos por día:
                                        </Typography>

                                        {loadingChildren[job.id] ? (
                                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                                <CircularProgress size={20} />
                                            </Box>
                                        ) : childJobs[job.id]?.length > 0 ? (
                                            childJobs[job.id].map(childJob => (
                                                <ChildJobItem key={childJob.id} job={childJob} />
                                            ))
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                No hay trabajos hijos para mostrar
                                            </Typography>
                                        )}
                                    </Box>
                                </Collapse>
                            </CardContent>
                        </Card>
                    ))}

                    {pagination.totalPages > 1 && (
                        <Box display="flex" justifyContent="center" mt={3}>
                            <Pagination
                                count={pagination.totalPages}
                                page={pagination.page}
                                onChange={handlePageChange}
                                color="primary"
                            />
                        </Box>
                    )}
                </>
            )}
        </>
    );
};

export default JobList;