require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuración
const config = {
    TWEETS_LIMIT: 15,
    WAIT_TIME_MIN: 5000,
    WAIT_TIME_MAX: 10000,
    QUERY: {
        busqueda1: 'levante madrid',
        busqueda2: '',
        busqueda3: '',
        busqueda4: '',
        fechaDesde: '2025-08-22',
        fechaHasta: '2025-08-23'
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
    if(fechaDesde) parts.push(`${fechaDesde}`)
    if(fechaHasta) parts.push(`${fechaHasta}`)
    // Construir nombre completo
    let fileName = 'bluesky';
    if (parts.length > 0) {
        fileName += '_' + parts.join('_');
    }
    

    // Limitar longitud y limpiar caracteres problemáticos
    fileName = fileName.substring(0, 150).replace(/[^a-z0-9_.\-!()"áéíóúüñÁÉÍÓÚÜÑ]/gi, '')+'.json';

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
    if(!!fechaDesde) terminoBusqueda += ` since:${fechaDesde}`;
    if(!!fechaHasta) terminoBusqueda += ` until:${fechaHasta}`;
    const termURI = encodeURIComponent(`${terminoBusqueda}`);
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

    // Función para iniciar sesión en Bluesky
    await loginToBluesky(page);

     try {
        await page.waitForSelector('[role="tab"]', { timeout: 30000 });
        const tabs = await page.$$('[role="tab"]');
        if (tabs.length >= 2) {
            console.log("Encontradas pestañas, seleccionando la segunda...");
            await tabs[1].click();
            console.log('Pestaña "Más recientes" seleccionada');
            await humanDelay();
            
            const isSelected = await tabs[1].getAttribute('aria-selected');
            if (isSelected !== 'true') {
                console.warn('La pestaña no se marcó como seleccionada, intentando nuevamente');
                await tabs[1].click();
            }
        } else {
            throw new Error('No se encontraron suficientes pestañas');
        }
    } catch (e) {
        console.error('Error al seleccionar pestaña "Más recientes":', e);
        
    } 

    

    let posts = [];
    let postCount = 0;
    let attemptsWithoutNewPosts = 0;
    const MAX_ATTEMPTS_WITHOUT_NEW_POSTS = 5;
    let rateLimitHit = false;



    // Modifica la función getFullTweets (parte del bucle while):

while (postCount < config.TWEETS_LIMIT && 
       attemptsWithoutNewPosts < MAX_ATTEMPTS_WITHOUT_NEW_POSTS && 
       !rateLimitHit) {
    console.log(`${new Date().toLocaleString()} - Recolectando posts (${postCount}/${config.TWEETS_LIMIT})`);

    // Verificar rate limit (código existente)
    
    // Seleccionar solo posts no procesados
    const newPosts = await page.$$eval('div[class="css-g5y9jx"][style="flex: 1 1 0%;"] div[role="link"][tabindex="0"]:not([data-processed])', (postElements) => {
        return postElements.map(post => {
            try {
                const authorLink = post.querySelector('a[aria-label*="Ver perfil"]');
                const textElement = post.querySelector('[data-testid="postText"]');
                const dateLink = post.querySelector('a[href*="/post/"]');
                const metrics = (testid) => {
                    const el = post.querySelector(`[data-testid="${testid}"]`);
                    return el ? (el.textContent.match(/\d+/) || ['0'])[0] : '0';
                };

                return {
                    id: dateLink?.href.split('/').pop() || Math.random().toString(36).substring(2, 10),
                    text: textElement?.textContent || '',
                    author: {
                        name: authorLink?.textContent.replace(/[\u202A-\u202E]/g, '').trim() || '',
                        handle: authorLink?.href ? 
                `@${authorLink.href.match(/\/profile\/([^\/]+)/)?.[1] || authorLink.href.replace(/^https?:\/\/bsky\.app\/?/, '').replace('/profile/', '')}` : 
                '@desconocido',
                        verified: !!post.querySelector('[aria-label*="Verified"]')
                    },
                    timestamp: new Date().toISOString(), // Bluesky no muestra fechas directamente
                    url: dateLink?.href ? `${dateLink.href}` : '',
                    metrics: {
                        replies: metrics('replyBtn'),
                        reposts: metrics('repostBtn'),
                        likes: metrics('likeBtn')
                    },
                    hasMedia: !!post.querySelector('img, video')
                };
            } catch (e) {
                console.error('Error procesando post:', e);
                return null;
            }
        }).filter(Boolean);
    });

    // Marcar posts como procesados
    await page.$$eval('div[class="css-g5y9jx"][style="flex: 1 1 0%;"] div[role="link"][tabindex="0"]', posts => {
        posts.forEach(p => p.setAttribute('data-processed', 'true'));
    });

    // Eliminar el filtro de duplicados (ya que marcamos los procesados)
    if (newPosts.length > 0) {
        posts = [...posts, ...newPosts];
        postCount = posts.length;
        await updateJSONFile(posts, busqueda1, busqueda2, busqueda3, busqueda4, fechaDesde, fechaHasta);
        attemptsWithoutNewPosts = 0;
        console.log(`➕ ${newPosts.length} nuevos posts | Total: ${postCount}/${config.TWEETS_LIMIT}`);
    } else {
        attemptsWithoutNewPosts++;
        console.log(`⏳ No hay nuevos posts (intento ${attemptsWithoutNewPosts}/${MAX_ATTEMPTS_WITHOUT_NEW_POSTS})`);
    }

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
        await page.mouse.wheel(0, 300 + Math.random() * 3000);
        await page.waitForTimeout(3000 + Math.random() * 4000);
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