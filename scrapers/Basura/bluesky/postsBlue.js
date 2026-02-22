const axios = require('axios');

// Configuración inicial
const BLUESKY_API = 'https://bsky.social/xrpc';
const handle = 'nonoworks.bsky.social'; // Reemplaza con un usuario real

async function getBlueskyPosts() {
    try {
        // 1. Obtener el DID (identificador único) del usuario
        const resolveResponse = await axios.get(`${BLUESKY_API}/com.atproto.identity.resolveHandle`, {
            params: { handle }
        });
        
        const did = resolveResponse.data.did;
        
        // 2. Obtener los posts del usuario
        const postsResponse = await axios.get(`${BLUESKY_API}/app.bsky.feed.getAuthorFeed`, {
            params: {
                actor: did,
                limit: 10 // Número de posts a obtener
            }
        });
        
        // 3. Procesar los posts
        const posts = postsResponse.data.feed.map(item => {
            return {
                id: item.post.uri.split('/').pop(),
                text: item.post.record.text,
                createdAt: item.post.record.createdAt,
                likes: item.post.likeCount,
                reposts: item.post.repostCount,
                replies: item.post.replyCount
            };
        });
        
        console.log('Posts obtenidos:', posts);
        return posts;
        
    } catch (error) {
        console.error('Error al obtener posts:', error.message);
    }
}

getBlueskyPosts();