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
        busqueda2: 'Real Madrid',
        busqueda3: '',
        busqueda4: '',
        fechaDesde: '',
        fechaHasta: ''
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
    if(fechaDesde) parts.push(`${fechaDesde}`)
    if(fechaHasta) parts.push(`${fechaHasta}`)
    // Construir nombre completo
    let fileName = 'tweets';
    if (parts.length > 0) {
        fileName += '_' + parts.join('_');
    }

    // Limitar longitud y limpiar caracteres problemáticos
    fileName = fileName.substring(0, 150).replace(/[^a-z0-9_\-!()"áéíóúüñÁÉÍÓÚÜÑ]/gi, '')+'.json';

    const fullPath = path.join(dir, fileName);
    fs.writeFileSync(fullPath, JSON.stringify(tweets, null, 2));
    console.log(`Archivo guardado: ${fullPath}`);
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
    console.log(termURI)
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
        await page.waitForSelector('[role="tablist"] a[href*="f=live"]', { timeout: 30000 });
        await page.click('[role="tablist"] a[href*="f=live"]');
        console.log('Pestaña "Más recientes" seleccionada');
        await humanDelay();
        
        // Verificar que quedó seleccionada
        const isSelected = await page.getAttribute('[role="tablist"] a[href*="f=live"]', 'aria-selected');
        if (isSelected !== 'true') {
            console.warn('La pestaña no se marcó como seleccionada, intentando nuevamente');
            await page.click('[role="tablist"] a[href*="f=live"]');
        }
    } catch (e) {
        console.error('Error al seleccionar pestaña "Más recientes":', e);
        // Fallback: intentar con navegación directa
        
        await page.goto(`https://x.com/search?q=${termURI}&src=typed_query&f=live`, {
            waitUntil: 'domcontentloaded'
        });
    }

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
    const MAX_ATTEMPTS_WITHOUT_NEW_TWEETS = 5;
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
            await updateJSONFile(tweets, busqueda1, busqueda2, busqueda3, busqueda4, fechaDesde, fechaHasta);
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