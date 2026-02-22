require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuración
const config = {
    POSTS_LIMIT: 100,
    WAIT_TIME_MIN: 5000,
    WAIT_TIME_MAX: 10000,
    QUERY: {
        busqueda1: 'madrid',
        busqueda2: '',
        busqueda3: '',
        busqueda4: '',
        fechaDesde: '2025-07-09',
        fechaHasta: '2025-07-10'
    },
    BLUESKY_CREDS: {
        handle: 'garstraper.bsky.social',
        password: 'Garchomp445'
    }
};

// Helper para tiempos de espera humanos
const humanDelay = () => new Promise(resolve => {
    const waitTime = config.WAIT_TIME_MIN + Math.random() * (config.WAIT_TIME_MAX - config.WAIT_TIME_MIN);
    console.log(`${new Date().toLocaleString()} - Esperando ${Math.round(waitTime/1000)} segundos...`);
    setTimeout(resolve, waitTime);
});

// Función para guardar/actualizar el JSON progresivamente
async function updateJSONFile(posts, searchTerm, fechaDesde, fechaHasta) {
    const dir = './posts_raw';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const filename = path.join(
        dir,
        `posts_${searchTerm.replace(/[^a-z0-9]/gi, '_')}_${fechaDesde}_to_${fechaHasta}.json`
    );

    fs.writeFileSync(filename, JSON.stringify(posts, null, 2));
    console.log(`Archivo actualizado: ${filename} (${posts.length} posts)`);
}

async function loginToBluesky(page) {
    console.log(`${new Date().toLocaleString()} - Iniciando sesión en Bluesky...`);
    
    try {
        // Ir a la página principal
        await page.goto('https://bsky.app', { 
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
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
        await usernameField.type(config.BLUESKY_CREDS.handle, { delay: 100 });
        await page.waitForTimeout(1000);
        
        // Ingresar contraseña
        console.log(`${new Date().toLocaleString()} - Rellenando contraseña...`);
        const passwordField = await page.$('input[data-testid="loginPasswordInput"]');
        await passwordField.click({ clickCount: 3 });
        await passwordField.type(config.BLUESKY_CREDS.password, { delay: 100 });
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
        console.error(`${new Date().toLocaleString()} - Error durante el login:`, error.message);
        await page.screenshot({ path: 'login-error.png' });
        console.log('Captura de pantalla guardada como login-error.png');
        return false;
    }
}

// Modificación en getFullPosts para asegurar el login
async function getFullPosts(busqueda1, busqueda2, busqueda3, busqueda4, fechaDesde, fechaHasta) {
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 200 // Aumentamos el slowMo para mejor visibilidad
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Configuración importante para evitar detección
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'es-ES,es;q=0.9',
        'Referer': 'https://bsky.app/'
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    try {
        // Paso 1: Login garantizado
        let loggedIn = false;
        let loginAttempts = 0;
        
        while (!loggedIn && loginAttempts < 3) {
            loggedIn = await loginToBluesky(page);
            if (!loggedIn) {
                loginAttempts++;
                console.log(`Reintento de login #${loginAttempts}`);
                await page.waitForTimeout(5000);
            }
        }
        
        if (!loggedIn) {
            throw new Error('No se pudo iniciar sesión después de 3 intentos');
        }

        // Paso 2: Esperar después del login
        await page.waitForTimeout(3000);
        
        // Resto de la lógica de búsqueda...
        // ... (mantener el resto del código igual)
        
    } finally {
        await browser.close();
    }
}

async function searchBluesky(page, term) {
    console.log(`${new Date().toLocaleString()} - Realizando búsqueda: "${term}"`);
    
    try {
        // Navegar a la página de búsqueda con parámetros aleatorios
        const randomParam = Math.random().toString(36).substring(7);
        await page.goto(`https://bsky.app/search?q=${encodeURIComponent(term)}&rand=${randomParam}`, {
            waitUntil: 'networkidle',
            timeout: 60000,
            referer: 'https://bsky.app/'
        });

        // Esperar aleatoriamente entre 3-8 segundos
        await page.waitForTimeout(3000 + Math.random() * 5000);

        // Verificar si aparece el mensaje de error
        const errorMsg = await page.$('text="Lo sentimos, pero no se ha podido completar tu búsqueda"');
        if (errorMsg) {
            console.log(`${new Date().toLocaleString()} - Error de búsqueda detectado, reintentando...`);
            await page.waitForTimeout(10000); // Esperar 10 segundos antes de reintentar
            return await searchBluesky(page, term); // Reintentar recursivamente
        }

        // Esperar a resultados o timeout
        try {
            await page.waitForSelector('article[data-testid="post"]', { 
                timeout: 15000,
                state: 'attached'
            });
            return true;
        } catch (e) {
            // Verificar si estamos en la página de búsqueda o nos redirigieron
            if (!page.url().includes('/search')) {
                console.log(`${new Date().toLocaleString()} - Redirección detectada, navegando directamente...`);
                await page.goto(`https://bsky.app/search?q=${encodeURIComponent(term)}`, {
                    waitUntil: 'networkidle',
                    timeout: 60000
                });
                return await searchBluesky(page, term); // Reintentar
            }
            
            console.log(`${new Date().toLocaleString()} - No se encontraron resultados visibles`);
            return false;
        }
    } catch (error) {
        console.error(`${new Date().toLocaleString()} - Error en la búsqueda:`, error.message);
        await page.screenshot({ path: 'search-error.png' });
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
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
    const page = await context.newPage();

    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log(`${new Date().toLocaleString()} - Navegando a Twitter...`);
    await page.goto(`https://x.com/search?q=${termURI}&src=typed_query`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    try {
        await page.waitForSelector('[data-testid="tweet"]', { timeout: 30000 });
        await humanDelay();
    } catch (e) {
        console.error('No se encontraron tweets:', e);
        await browser.close();
        return [];
    }

    let tweets = [];
    let tweetCount = 0;
    let attemptsWithoutNewTweets = 0;
    const MAX_ATTEMPTS_WITHOUT_NEW_TWEETS = 20;
    let rateLimitHit = false;

    while (tweetCount < config.TWEETS_LIMIT && 
           attemptsWithoutNewTweets < MAX_ATTEMPTS_WITHOUT_NEW_TWEETS && 
           !rateLimitHit) {
        console.log(`${new Date().toLocaleString()} - Recolectando tweets (${tweetCount}/${config.TWEETS_LIMIT})`);

        const response = await page.waitForResponse(response => {
            return response.url().includes('SearchTimeline') && 
                   response.status() === 429;
        }, { timeout: 5000 }).catch(() => null);

        if (response) {
            console.warn('⚠️ Se ha alcanzado el límite de tasa (Rate Limit)');
            rateLimitHit = true;
            break;
        }

        const newTweets = await page.$$eval('[data-testid="tweet"]:not([data-processed])', (tweetElements, hasta) => {
            const currentDate = new Date(hasta);
            currentDate.setDate(currentDate.getDate() + 1);

            return tweetElements.map(tweet => {
                try {
                    const tweetDate = new Date(tweet.querySelector('time')?.getAttribute('datetime'));
                    if (tweetDate > currentDate) return null;

                    return {
                        id: tweet.getAttribute('data-tweet-id') || Math.random().toString(36).substring(2),
                        text: tweet.querySelector('[data-testid="tweetText"]')?.textContent
                            .replace(/\n/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim() || '<multimedia>',
                        author: {
                            name: tweet.querySelector('[data-testid="User-Name"] div:first-child span span')?.textContent || 'Desconocido',
                            handle: tweet.querySelector('[data-testid="User-Name"] a[href^="/"]')?.getAttribute('href').slice(1) || '@desconocido',
                            verified: !!tweet.querySelector('[data-testid="icon-verified"]')
                        },
                        timestamp: tweet.querySelector('time')?.getAttribute('datetime'),
                        date: tweetDate.toISOString().split('T')[0],
                        metrics: {
                            replies: tweet.querySelector('[data-testid="reply"]')?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0',
                            retweets: tweet.querySelector('[data-testid="retweet"]')?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0',
                            likes: tweet.querySelector('[data-testid="like"]')?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0',
                            views: tweet.querySelector('a[href*="/analytics"]')?.getAttribute('aria-label')?.match(/\d+/)?.[0] || '0'
                        },
                        url: tweet.querySelector('a[href*="/status/"]')?.href || '',
                        isVerified: !!tweet.querySelector('[data-testid="icon-verified"]'),
                        hasMedia: !!tweet.querySelector('[data-testid="tweetPhoto"]') || 
                                 !!tweet.querySelector('[data-testid="videoPlayer"]')
                    };
                } catch (e) {
                    console.error('Error procesando tweet:', e);
                    return null;
                }
            }).filter(Boolean);
        }, fechaHasta);

        await page.$$eval('[data-testid="tweet"]', tweets => {
            tweets.forEach(t => t.setAttribute('data-processed', 'true'));
        });

        const existingUrls = new Set(tweets.map(t => t.url));
        const uniqueNewTweets = newTweets.filter(newTweet => 
            !existingUrls.has(newTweet.url) && newTweet.url !== ''
        );

        if (uniqueNewTweets.length > 0) {
            tweets = [...tweets, ...uniqueNewTweets];
            tweetCount += uniqueNewTweets.length;
            
            // Actualiza el archivo JSON con los nuevos tweets
            await updateJSONFile(tweets, busqueda2, fechaDesde, fechaHasta);
        } else {
            attemptsWithoutNewTweets++;
            console.log(`No se encontraron nuevos tweets (intento ${attemptsWithoutNewTweets}/${MAX_ATTEMPTS_WITHOUT_NEW_TWEETS})`);
        }

        await scrollPage(page);
        await humanDelay();
    }

    await browser.close();
    console.log(`${new Date().toLocaleString()} - Finalizado. Total tweets recolectados: ${tweetCount}`);
    return tweets;
}

async function getFullPosts(busqueda1, busqueda2, busqueda3, busqueda4, fechaDesde, fechaHasta) {
    let terminoBusqueda = '';
    if (!!busqueda1) terminoBusqueda = busqueda1;
    if (!!busqueda2) terminoBusqueda += ` "${busqueda2}"`;
    if (!!busqueda3) terminoBusqueda += ` (${busqueda3.replace(/ /g, " OR ")})`;
    if (!!busqueda4) terminoBusqueda += ` ${'-'+busqueda4.replace(/ /g," -")}`;

    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 100
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    let postCount = 0;
    let posts = [];

    try {
        // Intentar login (con reintentos)
        let loginAttempts = 0;
        let loggedIn = false;
        
        while (loginAttempts < 3 && !loggedIn) {
            loggedIn = await loginToBluesky(page);
            if (!loggedIn) {
                loginAttempts++;
                console.log(`${new Date().toLocaleString()} - Reintentando login (${loginAttempts}/3)`);
                await humanDelay();
            }
        }

        if (!loggedIn) {
            throw new Error('No se pudo iniciar sesión después de 3 intentos');
        }

        const searchSuccess = await searchBluesky(page, terminoBusqueda);
        if (!searchSuccess) {
            return posts;
        }

        let attemptsWithoutNewPosts = 0;
        const MAX_ATTEMPTS_WITHOUT_NEW_POSTS = 10;

        while (postCount < config.POSTS_LIMIT && 
               attemptsWithoutNewPosts < MAX_ATTEMPTS_WITHOUT_NEW_POSTS) {
            console.log(`${new Date().toLocaleString()} - Recolectando posts (${postCount}/${config.POSTS_LIMIT})`);

            const newPosts = await extractPostsFromPage(page, fechaHasta);
            const existingUrls = new Set(posts.map(p => p.url));
            const uniqueNewPosts = newPosts.filter(newPost => !existingUrls.has(newPost.url));

            if (uniqueNewPosts.length > 0) {
                posts = [...posts, ...uniqueNewPosts];
                postCount = posts.length;
                attemptsWithoutNewPosts = 0;
                
                await updateJSONFile(posts, busqueda1, fechaDesde, fechaHasta);
            } else {
                attemptsWithoutNewPosts++;
                console.log(`No se encontraron nuevos posts (intento ${attemptsWithoutNewPosts}/${MAX_ATTEMPTS_WITHOUT_NEW_POSTS})`);
            }

            // Desplazamiento inteligente
            await scrollIntelligently(page);
            await humanDelay();
            
            // Verificar si hay más posts cargados
            const hasMorePosts = await checkForNewPosts(page);
            if (!hasMorePosts) {
                console.log('No hay más posts disponibles');
                break;
            }
        }

        return posts;
    } catch (error) {
        console.error(`${new Date().toLocaleString()} - Error durante la ejecución:`, error);
        return posts;
    } finally {
        await browser.close();
        console.log(`${new Date().toLocaleString()} - Finalizado. Total posts recolectados: ${postCount}`);
    }
}

async function scrollIntelligently(page) {
    const scrollDistance = 500 + Math.floor(Math.random() * 1000);
    await page.evaluate((distance) => {
        window.scrollBy(0, distance);
    }, scrollDistance);
    await page.waitForTimeout(1000 + Math.random() * 2000);
}

async function checkForNewPosts(page) {
    return await page.evaluate(() => {
        const initialCount = document.querySelectorAll('article[data-testid="post"]').length;
        
        return new Promise(resolve => {
            setTimeout(() => {
                const newCount = document.querySelectorAll('article[data-testid="post"]').length;
                resolve(newCount > initialCount);
            }, 3000);
        });
    });
}

(async () => {
    try {
        const posts = await getFullPosts(
            config.QUERY.busqueda1,
            config.QUERY.busqueda2,
            config.QUERY.busqueda3,
            config.QUERY.busqueda4,
            config.QUERY.fechaDesde,
            config.QUERY.fechaHasta
        );
        console.log(`${new Date().toLocaleString()} - Proceso completado. Posts obtenidos: ${posts.length}`);
    } catch (error) {
        console.error(`${new Date().toLocaleString()} - Error en la ejecución principal:`, error);
    }
})();