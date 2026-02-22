require('dotenv').config();
const axios = require('axios');

// Configuración
const BLUESKY_API = 'https://bsky.social/xrpc';
const AUTH = {
    identifier: 'garstraper.bsky.social',
    password: 'Garchomp445'
};

let accessToken = null;

// Función de autenticación (se mantiene igual)
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
        console.error('Error de autenticación:', error.response?.data || error.message);
        throw error;
    }
}

// Nueva función para obtener información completa de los posts
async function getPostsDetails(postUris, headers) {
    try {
        const response = await axios.get(
            `${BLUESKY_API}/app.bsky.feed.getPosts`,
            {
                params: { uris: postUris },
                headers
            }
        );
        return response.data.posts;
    } catch (error) {
        console.error('Error obteniendo detalles de posts:', error.message);
        return [];
    }
}

// Función principal modificada
async function getFilteredBlueskyPosts(options = {}) {
    try {
        if (!accessToken) await authenticate();

        const headers = { Authorization: `Bearer ${accessToken}` };
        const users = Array.isArray(options.users) ? options.users : 
                     (options.users ? [options.users] : []);
        const keywords = Array.isArray(options.keywords) ? options.keywords : 
                       (options.keywords ? [options.keywords] : []);
        
        const startDate = options.startDate ? new Date(options.startDate) : null;
        const endDate = options.endDate ? new Date(options.endDate) : null;
        
        let allPosts = [];
        
        for (const user of users.length ? users : [null]) {
            let posts = [];
            
            if (user) {
                // Obtener DID del usuario
                const resolveResponse = await axios.get(
                    `${BLUESKY_API}/com.atproto.identity.resolveHandle`, 
                    { params: { handle: user }, headers }
                );
                
                const did = resolveResponse.data.did;
                
                // Obtener feed del usuario (incluye posts, reposts y respuestas)
                const feedResponse = await axios.get(
                    `${BLUESKY_API}/app.bsky.feed.getAuthorFeed`, 
                    { params: { actor: did, limit: options.limit || 20 }, headers }
                );
                
                // Primero mapeamos los datos básicos
                const basicPosts = feedResponse.data.feed.map(item => ({
                    uri: item.post.uri,
                    cid: item.post.cid,
                    isReply: !!item.post.record?.reply, // Verifica si es respuesta
                    replyParent: item.post.record?.reply?.parent?.uri || null,
                    replyRoot: item.post.record?.reply?.root?.uri || null
                }));
                
                // Obtenemos detalles completos de los posts
                const postsDetails = await getPostsDetails(
                    basicPosts.map(p => p.uri), 
                    headers
                );
                
                // Combinamos la información
                posts = postsDetails.map((postDetail, index) => {
                    const basic = basicPosts[index];
                    const isRepost = !postDetail.author || 
                                   (postDetail.author.handle !== user && 
                                    postDetail.author.did !== did);
                    
                    return {
                        id: postDetail.uri.split('/').pop(),
                        text: postDetail.record,
                        createdAt: postDetail.record.createdAt,
                        author: postDetail.author?.handle || user,
                        isRepost,
                        isReply: basic.isReply,
                        replyTo: basic.isReply ? {
                            parent: basic.replyParent,
                            root: basic.replyRoot
                        } : null,
                        likes: postDetail.likeCount,
                        reposts: postDetail.repostCount,
                        replies: postDetail.replyCount,
                        url: `https://bsky.app/profile/${postDetail.author?.handle || user}/post/${postDetail.uri.split('/').pop()}`
                    };
                });
            } else {
                // Timeline pública (similar al anterior pero incluyendo respuestas)
                const feedResponse = await axios.get(
                    `${BLUESKY_API}/app.bsky.feed.getTimeline`, 
                    { params: { limit: options.limit || 20 }, headers }
                );
                
                const basicPosts = feedResponse.data.feed.map(item => ({
                    uri: item.post.uri,
                    cid: item.post.cid,
                    isReply: !!item.post.record?.reply,
                    replyParent: item.post.record?.reply?.parent?.uri || null,
                    replyRoot: item.post.record?.reply?.root?.uri || null
                }));
                
                const postsDetails = await getPostsDetails(
                    basicPosts.map(p => p.uri), 
                    headers
                );
                
                posts = postsDetails.map((postDetail, index) => {
                    const basic = basicPosts[index];
                    return {
                        id: postDetail.uri.split('/').pop(),
                        text: postDetail.record.createdAt,
                        createdAt: postDetail.record.createdAt,
                        author: postDetail.author?.handle,
                        isRepost: !!item.reason,
                        isReply: basic.isReply,
                        replyTo: basic.isReply ? {
                            parent: basic.replyParent,
                            root: basic.replyRoot
                        } : null,
                        likes: postDetail.likeCount,
                        reposts: postDetail.repostCount,
                        replies: postDetail.replyCount,
                        url: `https://bsky.app/profile/${postDetail.author?.handle}/post/${postDetail.uri.split('/').pop()}`
                    };
                });
            }
            
            allPosts = [...allPosts, ...posts];
        }
        
        // Resto del código de filtrado se mantiene igual...
        let filteredPosts = allPosts;
        
        if (keywords.length) {
            filteredPosts = filteredPosts.filter(post => 
                keywords.some(keyword => 
                    post.text.toLowerCase().includes(keyword.toLowerCase())
                )
            );
        }
        
        if (startDate || endDate) {
            filteredPosts = filteredPosts.filter(post => {
                const postDate = new Date(post.createdAt);
                const afterStart = !startDate || postDate >= startDate;
                const beforeEnd = !endDate || postDate <= endDate;
                return afterStart && beforeEnd;
            });
        }
        
        filteredPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log(`Encontrados ${filteredPosts.length} posts (${filteredPosts.filter(p => p.isReply).length} respuestas)`);
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

// Ejemplo de uso que muestra respuestas
getFilteredBlueskyPosts({
    users: ['poncheotako.bsky.social'],
    limit: 3
}).then(posts => {
    console.log(posts);
});