require('dotenv').config();

const axios = require('axios');

// Configuración
const BLUESKY_API = 'https://bsky.social/xrpc';
const AUTH = {
    identifier: 'garstraper.bsky.social', // Reemplaza con tu usuario completo
    password: 'Garchomp445' // Crea una App Password en configuración
};

let accessToken = null;

/**
 * Autentica en la API de Bluesky
 */
async function authenticate() {
    try {
        const response = await axios.post(
            `${BLUESKY_API}/com.atproto.server.createSession`,
            {
                identifier: AUTH.identifier,
                password: AUTH.password
            }
        );
        accessToken = response.data.accessJwt;
        return accessToken;
    } catch (error) {
        console.log(process.env.BS_USER);
        console.error('Error de autenticación:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Obtiene posts de Bluesky con filtros avanzados
 * @param {Object} options - Opciones de filtrado
 * @param {string|string[]} [options.users] - Usuario(s) a buscar
 * @param {string|string[]} [options.keywords] - Palabra(s) clave a buscar
 * @param {Date|string} [options.startDate] - Fecha de inicio (YYYY-MM-DD o Date)
 * @param {Date|string} [options.endDate] - Fecha de fin (YYYY-MM-DD o Date)
 * @param {number} [options.limit=20] - Número máximo de posts
 * @returns {Promise<Array>} - Array de posts filtrados
 */
async function getFilteredBlueskyPosts(options = {}) {
    try {
        // Autenticar si no tenemos token
        if (!accessToken) {
            await authenticate();
        }

        // Configuración de headers
        const headers = {
            Authorization: `Bearer ${accessToken}`
        };

        // Procesar parámetros
        const users = Array.isArray(options.users) ? options.users : 
                     (options.users ? [options.users] : []);
        const keywords = Array.isArray(options.keywords) ? options.keywords : 
                       (options.keywords ? [options.keywords] : []);
        
        // Convertir fechas a formato ISO si son strings
        const startDate = options.startDate ? 
            new Date(options.startDate).toISOString() : null;
        const endDate = options.endDate ? 
            new Date(options.endDate).toISOString() : null;
        
        // Obtener posts para cada usuario
        let allPosts = [];
        
        for (const user of users.length ? users : [null]) {
            let posts = [];
            
            if (user) {
                // Obtener DID del usuario
                const resolveResponse = await axios.get(
                    `${BLUESKY_API}/com.atproto.identity.resolveHandle`, 
                    {
                        params: { handle: user },
                        headers: headers
                    }
                );
                
                const did = resolveResponse.data.did;
                
                // Obtener posts del usuario
                const feedResponse = await axios.get(
                    `${BLUESKY_API}/app.bsky.feed.getAuthorFeed`, 
                    {
                        params: { actor: did, limit: options.limit || 20 },
                        headers: headers
                    }
                );
                
                posts = feedResponse.data.feed.map(item => ({
                    id: item.post.uri.split('/').pop(),
                    text: item.post.record.text,
                    createdAt: item.post.record.createdAt,
                    author: item.post.author.handle,
                    isRepost: user==item.post.author.handle?false:true,
                    likes: item.post.likeCount,
                    reposts: item.post.repostCount,
                    replies: item.post.replyCount,
                    url: `https://bsky.app/profile/${user==item.post.author.handle?user:item.post.author.handle}/post/${item.post.uri.split('/').pop()}`
                }));
            } else {
                // Obtener posts globales (timeline pública)
                const feedResponse = await axios.get(
                    `${BLUESKY_API}/app.bsky.feed.searchPosts`, 
                    {
                        params: { 
                            limit: options.limit,
                            q:keywords
                        },
                        headers: headers
                    }
                );
                
                posts = feedResponse.data.feed.map(item => ({
                    id: item.post.uri.split('/').pop(),
                    text: item.post.record.text,
                    createdAt: item.post.record.createdAt,
                    author: item.post.author.handle,
                    likes: item.post.likeCount,
                    reposts: item.post.repostCount,
                    replies: item.post.replyCount,
                    url: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`
                }));
            }
            
            allPosts = [...allPosts, ...posts];
        }
        
        // Aplicar filtros
        let filteredPosts = allPosts;
        
        // Filtrar por palabras clave
        if (keywords.length) {
            filteredPosts = filteredPosts.filter(post => 
                keywords.some(keyword => 
                    post.text.toLowerCase().includes(keyword.toLowerCase())
                )
            );
        }
        
        // Filtrar por rango de fechas
        if (startDate || endDate) {
            filteredPosts = filteredPosts.filter(post => {
                const postDate = new Date(post.createdAt);
                const afterStart = !startDate || postDate >= new Date(startDate);
                const beforeEnd = !endDate || postDate <= new Date(endDate);
                return afterStart && beforeEnd;
            });
        }
        
        // Ordenar por fecha (más reciente primero)
        filteredPosts.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log(`Encontrados ${filteredPosts.length} posts que coinciden con los filtros:`);
        return filteredPosts;
        
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('Token expirado, reintentando autenticación...');
            accessToken = null;
            return getFilteredBlueskyPosts(options);
        }
        console.error('Error:', error.response?.data || error.message);
        return [];
    }
}

// Ejemplos de uso:

// 1. Buscar posts de usuarios específicos con palabras clave
 getFilteredBlueskyPosts({
    users: ['poncheotako.bsky.social'],
    keywords: ['disponible'],
    startDate: '2025-05-10',
    endDate: '2025-05-19',
    limit: 100
}).then(posts => console.log(posts)); 



/* getFilteredBlueskyPosts({
    
    keywords: ['barça'],
    limit: 10
}).then(posts => console.log(posts));  */


