require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuración
const config = {
    TWEETS_LIMIT: 150,
    WAIT_TIME_MIN: 5000,
    WAIT_TIME_MAX: 10000,
    QUERY: {
        busqueda1: 'vinicius',
        busqueda2: '',
        busqueda3: '',
        busqueda4: '',
        fechaDesde: '2025-07-09',
        fechaHasta: '2025-07-29'
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
    const dir = './bs_raw';
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
    let fileName = 'bluesky';
    if (parts.length > 0) {
        fileName += '_' + parts.join('_');
    }
    fileName += `_${fechaDesde}_to_${fechaHasta}.json`;

    // Limitar longitud y limpiar caracteres problemáticos
    fileName = fileName.substring(0, 150).replace(/[^a-z0-9_.\-!()"áéíóúüñÁÉÍÓÚÜÑ]/gi, '');

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

        const firstPost = await page.$('div[class="css-g5y9jx"][style="flex: 1 1 0%;"] div[role="link"][tabindex="0"]');  // Capturamos el primer post

            if (firstPost) {
                console.log('Estructura del primer post:');
                const postHTML = await firstPost.innerHTML();  // Obtenemos el HTML del primer post
                //console.log(postHTML);

                // Extraemos datos específicos
                const authorName = await firstPost.$eval('a[aria-label*="Ver perfil"]', el => el.innerText.trim());
                const authorHandle = await firstPost.$eval('a[aria-label*="Ver perfil"]', el => el.getAttribute('href').replace('/profile/', ''));
                const postText = await firstPost.$eval('[data-testid="postText"]', el => el.innerText.trim());
                const postDate = await firstPost.$eval('a[aria-label*="Ver perfil"]:nth-of-type(2)', el => el.innerText.trim());
                const postUrl = await firstPost.$eval('a[href*="/post/"]', el => el.href);
                
                // Extraer la cantidad de respuestas (replies)
                const repliesCount = await firstPost.$eval('[data-testid="replyBtn"]', el => el.innerText.trim());
                const repostsCount = await firstPost.$eval('[data-testid="repostBtn"]', el => el.innerText.trim());
                const likesCount = await firstPost.$eval('[data-testid="likeBtn"]', el => el.innerText.trim());
                // Extraer la cantidad de me gusta (likes)
                //const likesCount = await firstPost.$eval('[aria-label*="Me gusta"]', el => el.innerText.trim());

                // Mostrar los datos extraídos
                console.log("holaaaaaaa")
                console.log(`Autor: ${authorName} (@${authorHandle})`);
                console.log(`Texto del post: ${postText}`);
                console.log(`Fecha: ${postDate}`);
                console.log(`URL del post: ${postUrl}`);
                console.log(`Respuestas: ${repliesCount}`);
                console.log(`Resposts: ${likesCount}`);
                console.log(`Me gusta: ${likesCount}`);
                
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


    console.log("1")

     try {
        // Esperar a que cargue el contenido de búsqueda
        await page.waitForSelector('div[class="css-g5y9jx"][style="flex: 1 1 0%;"] div[role="link"][tabindex="0"]', { timeout: 30000, state: 'attached' });
        console.log('Resultados de búsqueda cargados');
        await humanDelay();
        
    } catch (e) {
        console.error('Error al cargar resultados de búsqueda:', e);
        await browser.close();
        return [];
    } 
// Reemplaza la sección después de console.log("2") con este código:

    console.log("2");
    let posts = [];
    let postCount = 0;
    let attemptsWithoutNewPosts = 0;
    const MAX_ATTEMPTS_WITHOUT_NEW_POSTS = 5;
    let rateLimitHit = false;

// Selector mejorado para posts
const POST_SELECTOR = 'div[class="css-g5y9jx"][style="flex: 1 1 0%;"] div[role="link"][tabindex="0"]';

// Función mejorada para extraer datos
const extractPostData = async (postElement) => {
    try {
        // Extraer información del autor
        const authorElement = await postElement.$('a[href^="/profile/"]');
        if (!authorElement) return null;

        const authorHandle = await authorElement.getAttribute('href').then(h => h.replace('/profile/', ''));
        const authorName = await authorElement.innerText().catch(() => '');

        // Extraer texto del post
        const textElement = await postElement.$('[data-testid="postText"]');
        const postText = textElement ? await textElement.innerText().catch(() => '') : '';

        // Extraer fecha
        const dateElement = await postElement.$('a[href*="/post/"]');
        let postDate = new Date();
        if (dateElement) {
            const dateText = await dateElement.getAttribute('aria-label') || await dateElement.innerText();
            const match = dateText.match(/(\d+)([dhm])/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2];
                if (unit === 'd') postDate.setDate(postDate.getDate() - value);
                else if (unit === 'h') postDate.setHours(postDate.getHours() - value);
                else if (unit === 'm') postDate.setMinutes(postDate.getMinutes() - value);
            }
        }

        // Extraer URL del post
        const postUrl = await postElement.$eval('a[href*="/post/"]', el => `https://bsky.app${el.getAttribute('href')}`).catch(() => '');

        // Extraer métricas
        const getMetric = async (testid) => {
            const element = await postElement.$(`[data-testid="${testid}"]`);
            if (!element) return '0';
            const text = await element.innerText().catch(() => '');
            return text.match(/\d+/)?.[0] || '0';
        };

        return {
            id: postUrl.split('/').pop() || Math.random().toString(36).substring(2, 10),
            text: postText,
            author: {
                name: authorName,
                handle: `@${authorHandle}`,
                verified: await postElement.$('[aria-label*="Verified"]').then(() => true).catch(() => false)
            },
            timestamp: postDate.toISOString(),
            date: postDate.toISOString().split('T')[0],
            metrics: {
                replies: await getMetric('replyBtn'),
                reposts: await getMetric('repostBtn'),
                likes: await getMetric('likeBtn')
            },
            url: postUrl,
            hasMedia: await postElement.$('img, video').then(() => true).catch(() => false)
        };
    } catch (error) {
        console.error('Error extrayendo datos del post:', error);
        return null;
    }
};

// Modifica la sección del bucle while con este código:

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

    // Verificar que estamos en la pestaña correcta ("Más recientes")
    const activeTab = await page.$('[role="tab"][aria-selected="true"]');
    if (activeTab) {
        const tabText = await activeTab.innerText();
        if (!tabText.includes('Más recientes') && !tabText.includes('Recent')) {
            console.log('No estamos en la pestaña "Más recientes", seleccionándola...');
            await selectRecentTab(page); // Reutilizamos la función que ya tienes
            await humanDelay();
        }
    }

    // Esperar y obtener posts
    try {
        await page.waitForSelector(POST_SELECTOR, { timeout: 10000, state: 'attached' });
        const postElements = await page.$$(POST_SELECTOR);
        console.log(`Posts encontrados en la página: ${postElements.length}`);

        // Procesar solo los necesarios para alcanzar el límite
        const remainingPosts = config.TWEETS_LIMIT - postCount;
        const postsToProcess = postElements.slice(0, remainingPosts);

        const newPosts = [];
        for (const postElement of postsToProcess) {
            const postData = await extractPostData(postElement);
            if (postData) newPosts.push(postData);
        }

        // Filtrar posts únicos
        const existingUrls = new Set(posts.map(p => p.url));
        const uniqueNewPosts = newPosts.filter(post => post && post.url && !existingUrls.has(post.url));

        if (uniqueNewPosts.length > 0) {
            posts = [...posts, ...uniqueNewPosts];
            postCount += uniqueNewPosts.length;
            await updateJSONFile(posts, busqueda1, busqueda2, busqueda3, busqueda4, fechaDesde, fechaHasta);
            attemptsWithoutNewPosts = 0;
            console.log(`Posts nuevos agregados: ${uniqueNewPosts.length}`);
        } else {
            attemptsWithoutNewPosts++;
            console.log(`No se encontraron nuevos posts (intento ${attemptsWithoutNewPosts}/${MAX_ATTEMPTS_WITHOUT_NEW_POSTS})`);
        }

        // Si ya alcanzamos el límite, salir
        if (postCount >= config.TWEETS_LIMIT) {
            console.log('Límite de posts alcanzado');
            break;
        }
    } catch (e) {
        console.log('No se encontraron posts nuevos:', e);
        attemptsWithoutNewPosts++;
    }

    // Scroll para cargar más contenido
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
        await page.mouse.wheel(0, 300 + Math.random() * 70000);
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