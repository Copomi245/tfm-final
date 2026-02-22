require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuración
const config = {
    TWEETS_LIMIT: 10,
    WAIT_TIME_MIN: 5000,
    WAIT_TIME_MAX: 10000,
    QUERY: {
        busqueda1: '',
        busqueda2: 'flamengo esteve',
        busqueda3: '',
        busqueda4: '',
        fechaDesde: '2025-07-09',
        fechaHasta: '2025-07-10'
    }
};

// Helper para tiempos de espera humanos
const humanDelay = () => new Promise(resolve => {
    const waitTime = config.WAIT_TIME_MIN + Math.random() * (config.WAIT_TIME_MAX - config.WAIT_TIME_MIN);
    console.log(`${new Date().toLocaleString()} - Esperando ${Math.round(waitTime/1000)} segundos...`);
    setTimeout(resolve, waitTime);
});

// Función para guardar/actualizar el JSON progresivamente
// Función para guardar/actualizar el JSON progresivamente
// Función para guardar/actualizar el JSON progresivamente
async function updateJSONFile(tweets, busqueda1, busqueda2, busqueda3, busqueda4, fechaDesde, fechaHasta) {
    const dir = './tweets_raw';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Procesar cada campo de búsqueda
    const processTerm = (term, isExclusion = false) => {
        if (!term) return null;
        const cleaned = term.replace(/[^a-z0-9áéíóúüñÁÉÍÓÚÜÑ\s]/gi, '').trim();
        return isExclusion ? `!${cleaned.replace(/\s+/g, '-')}` : cleaned.replace(/\s+/g, '-');
    };

    // Construir partes del nombre
    const parts = [];
    if (busqueda1) parts.push(processTerm(busqueda1));  // Términos AND
    if (busqueda2) parts.push(`"${processTerm(busqueda2)}"`);  // Frase exacta
    if (busqueda3) parts.push(`(${processTerm(busqueda3).replace(/\s+/g, '-OR-')})`);  // Términos OR
    if (busqueda4) parts.push(processTerm(busqueda4, true));  // Exclusiones

    // Construir nombre completo
    let fileName = 'tweets';
    if (parts.length > 0) {
        fileName += '_' + parts.join('_');
    }
    fileName += `_${fechaDesde}_to_${fechaHasta}.json`;

    // Limitar longitud y limpiar caracteres problemáticos
    fileName = fileName.substring(0, 150).replace(/[^a-z0-9_\-!()"áéíóúüñÁÉÍÓÚÜÑ]/gi, '');

    const fullPath = path.join(dir, fileName);
    fs.writeFileSync(fullPath, JSON.stringify(tweets, null, 2));
    console.log(`Archivo guardado: ${fullPath}`);
}

async function loginToBluesky(page) {
    try {
        console.log('Intentando iniciar sesión...');
        

// Verificar si ya estamos logueados (por las cookies)
        const alreadyLoggedIn = await page.$('a[href^="/profile/"]');
        if (alreadyLoggedIn) {
            console.log(`${new Date().toLocaleString()} - Sesión activa detectada`);
            return true;
        }

        // Esperar y hacer clic en el botón de inicio de sesión
        console.log(`${new Date().toLocaleString()} - Localizando botón de inicio de sesión...`);
        const loginButton = await page.waitForSelector('button:has-text("Iniciar sesión"), button:has-text("Sign in")', {
            timeout: 15000,
            state: 'visible'
        });

        console.log(`${new Date().toLocaleString()} - Haciendo clic en botón de login...`);
        await loginButton.click();
        await page.waitForTimeout(2000); // Espera adicional crítica

       // Verificar que apareció el formulario de login
        console.log(`${new Date().toLocaleString()} - Esperando formulario de login...`);
        await page.waitForSelector('input[data-testid="loginUsernameInput"]', {
            timeout: 10000,
            state: 'visible'
        });
        
        // Ingresar nombre de usuario
        console.log(`${new Date().toLocaleString()} - Rellenando usuario...`);
        const usernameField = await page.$('input[data-testid="loginUsernameInput"]');
        await usernameField.click({ clickCount: 3 });
        await usernameField.type(process.env.BS_USER, { delay: 100 });
        await page.waitForTimeout(1000);
        
        // Ingresar contraseña
        console.log(`${new Date().toLocaleString()} - Rellenando contraseña...`);
        const passwordField = await page.$('input[data-testid="loginPasswordInput"]');
        await passwordField.click({ clickCount: 3 });
        await passwordField.type(process.env.BS_PASSWORD, { delay: 100 });
        await page.waitForTimeout(1000);
        
        // Enviar formulario
        console.log(`${new Date().toLocaleString()} - Enviando formulario...`);
        const submitButton = await page.$('button[data-testid="loginNextButton"]');
        await submitButton.click();
        
        // Esperar confirmación de login
        console.log(`${new Date().toLocaleString()} - Esperando confirmación de login...`);
        await page.waitForSelector('a[href^="/profile/"]', { timeout: 20000 });
        
        console.log(`${new Date().toLocaleString()} - Sesión iniciada correctamente`);
        return true;
    } catch (error) {
        console.error('Error en el inicio de sesión:', error);
        return false;
    }
}

async function getFullTweets(busqueda1, busqueda2, busqueda3, busqueda4, fechaDesde, fechaHasta) {
    let terminoBusqueda = '';
    if (!!busqueda1) terminoBusqueda = busqueda1;
    if (!!busqueda2) terminoBusqueda += ` "${busqueda2}"`;
    if (!!busqueda3) terminoBusqueda += ` (${busqueda3.replace(/ /g, " OR ")})`;
    if (!!busqueda4) terminoBusqueda += ` ${'-'+busqueda4.replace(/ /g," -")}`;

    const termURI = encodeURIComponent(`${terminoBusqueda} since:${fechaDesde} until:${fechaHasta}`);
    console.log('Búsqueda:', termURI);
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
    const page = await context.newPage();

    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log(`${new Date().toLocaleString()} - Navegando a Bluesky...`);

    await page.goto(`https://bsky.app/search?q=${termURI}&src=typed_query`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // Función para iniciar sesión en Bluesky (debes implementarla según tus necesidades)
    await loginToBluesky(page);

    try {
    // Esperar a que carguen las pestañas
    await page.waitForSelector('[role="tab"]', { timeout: 30000 });
    
    // Seleccionar la segunda pestaña (índice 1) basada en la estructura mostrada
    const tabs = await page.$$('[role="tab"]');
    if (tabs.length >= 2) {
        console.log("Encontradas pestañas, seleccionando la segunda...");
        await tabs[1].click(); // Hacer click en la segunda pestaña
        console.log('Pestaña "Más recientes" seleccionada');
        await humanDelay();
        
        // Verificar que quedó seleccionada
        const isSelected = await tabs[1].getAttribute('aria-selected');
        if (isSelected !== 'true') {
            console.warn('La pestaña no se marcó como seleccionada, intentando nuevamente');
            await tabs[1].click();
        }

        const firstPost = await page.$('div[role="link"].css-g5y9jx');
if (firstPost) {
    console.log('Estructura del primer post:');
    console.log(await firstPost.innerHTML());
} else {
    console.log('No se encontraron posts - verificando estructura completa...');
    console.log(await page.content());
}
    } else {
        throw new Error('No se encontraron suficientes pestañas');
    }
} catch (e) {
    console.error('Error al seleccionar pestaña "Más recientes":', e);
    // Fallback: intentar con navegación directa
    await page.goto(`https://bsky.app/search?q=${termURI}&src=typed_query&f=live`, {
        waitUntil: 'domcontentloaded'
    });
}



    /* try {
        // Esperar a que cargue el contenido de búsqueda
        await page.waitForSelector('[data-testid="searchFeed"]', { timeout: 30000 });
        console.log('Resultados de búsqueda cargados');
        await humanDelay();
        
    } catch (e) {
        console.error('Error al cargar resultados de búsqueda:', e);
        await browser.close();
        return [];
    } */

    // Reemplaza la sección de obtención de posts con este código:

let posts = [];
let postCount = 0;
let attemptsWithoutNewPosts = 0;
const MAX_ATTEMPTS_WITHOUT_NEW_POSTS = 5;
let rateLimitHit = false;

// Función mejorada para detectar posts
const isPost = (element) => {
    return element && 
           element.getAttribute('role') === 'link' && 
           element.classList.contains('css-g5y9jx') && 
           element.querySelector('a[href^="/profile/"]');
};  

while (postCount < config.TWEETS_LIMIT && 
       attemptsWithoutNewPosts < MAX_ATTEMPTS_WITHOUT_NEW_POSTS && 
       !rateLimitHit) {
    console.log(`${new Date().toLocaleString()} - Recolectando posts (${postCount}/${config.TWEETS_LIMIT})`);

    // Verificar rate limit
    const rateLimitError = await page.$('text="Rate limit exceeded"');
    if (rateLimitError) {
        console.warn('⚠️ Se ha alcanzado el límite de tasa (Rate Limit)');
        rateLimitHit = true;
        break;
    }

    // Esperar a que carguen los posts
    await page.waitForSelector('div[class*="css-"]', { timeout: 10000 });

    // Obtener nuevos posts
    const newPosts = await page.$$eval('div[role="link"].css-g5y9jx:not([data-bluesky-processed])', (elements, hasta) => {
    const currentDate = new Date(hasta);
    currentDate.setDate(currentDate.getDate() + 1);
    
    return elements.map(el => {
        try {
            // Extraer información básica
            const authorLink = el.querySelector('a[href^="/profile/"]');
            if (!authorLink) return null;
            
            const authorName = authorLink.textContent.trim();
            const authorHandle = authorLink.getAttribute('href').replace('/profile/', '');
            
            // Extraer fecha (ajusta según la estructura real)
            const dateElement = el.querySelector('time') || el.closest('div').querySelector('time');
            const postDateText = dateElement?.getAttribute('datetime') || 
                               dateElement?.getAttribute('aria-label')?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
            const postDate = postDateText ? new Date(postDateText) : new Date();
            
            if (postDate > currentDate) return null;

            // Extraer texto del post
            let postText = '';
            const textContainer = [...el.querySelectorAll('div[dir="auto"]')]
                .find(e => !e.querySelector('a[href^="/profile/"]'));
            
            if (textContainer) {
                postText = textContainer.textContent.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            } else if (el.querySelector('img, video, [aria-label*="Embed"]')) {
                postText = '<multimedia>';
            }

            // Extraer métricas
            const buttons = [...el.querySelectorAll('button')];
            const getMetric = (label) => {
                const btn = buttons.find(b => b.getAttribute('aria-label')?.includes(label));
                return btn?.textContent?.trim() || '0';
            };

            const metrics = {
                replies: getMetric('Reply') || getMetric('Responder') || '0',
                reposts: getMetric('Repost') || getMetric('Republicar') || '0',
                likes: getMetric('Like') || getMetric('Me gusta') || '0'
            };

            // Obtener URL del post
            const postLink = [...el.querySelectorAll('a')].find(a => 
                a.href.includes('/profile/') && a.href.includes('/post/')
            );
            const postUrl = postLink?.href || '';

            return {
                id: postUrl.match(/\/post\/([^\/]+)/)?.[1] || Math.random().toString(36).substring(2),
                text: postText,
                author: {
                    name: authorName,
                    handle: `@${authorHandle}`,
                    did: authorHandle,
                    verified: !!el.querySelector('[aria-label*="Verified"]')
                },
                timestamp: postDate.toISOString(),
                date: postDate.toISOString().split('T')[0],
                metrics: metrics,
                url: postUrl,
                isVerified: !!el.querySelector('[aria-label*="Verified"]'),
                hasMedia: !!el.querySelector('img, video, [aria-label*="Embed"]'),
                lang: 'es'
            };
        } catch (e) {
            console.error('Error procesando post:', e);
            return null;
        }
    }).filter(Boolean);
}, fechaHasta);

// Marcar como procesados
await page.$$eval('div[role="link"].css-g5y9jx', posts => {
    posts.forEach(p => p.setAttribute('data-bluesky-processed', 'true'));
});

    // Filtrar posts únicos
    const existingUrls = new Set(posts.map(p => p.url));
    const uniqueNewPosts = newPosts.filter(post => post.url && !existingUrls.has(post.url));

    if (uniqueNewPosts.length > 0) {
        posts = [...posts, ...uniqueNewPosts];
        postCount += uniqueNewPosts.length;
        await updateJSONFile(posts, busqueda1, busqueda2, busqueda3, busqueda4, fechaDesde, fechaHasta);
    } else {
        attemptsWithoutNewPosts++;
        console.log(`No se encontraron nuevos posts (intento ${attemptsWithoutNewPosts}/${MAX_ATTEMPTS_WITHOUT_NEW_POSTS})`);
    }

    // Scroll mejorado para Bluesky
    await scrollPage(page);
    await humanDelay();
}

    await browser.close();
    console.log(`${new Date().toLocaleString()} - Finalizado. Total posts recolectados: ${postCount}`);
    return posts;
}

async function scrollPage(page) {
    const scrollSteps = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scrollSteps; i++) {
        await page.mouse.wheel(0, 300 + Math.random() * 700);
        await page.waitForTimeout(500 + Math.random() * 1500);
    }
}

(async () => {
    try {
        await getFullTweets(
            config.QUERY.busqueda1,
            config.QUERY.busqueda2,
            config.QUERY.busqueda3,
            config.QUERY.busqueda4,
            config.QUERY.fechaDesde,
            config.QUERY.fechaHasta
        );
    } catch (error) {
        console.error('Error durante la ejecución:', error);
    }
})();