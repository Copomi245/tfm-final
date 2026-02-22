require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const csv = require('csv-writer').createObjectCsvWriter;

// Configuración
const config = {
    TWEETS_LIMIT: 1000, // Límite de tweets a recolectar
    WAIT_TIME_MIN: 5000, // 5 segundos mínimo entre acciones
    WAIT_TIME_MAX: 10000, // 10 segundos máximo entre acciones
    QUERY: {
        busqueda1: '',
        busqueda2: 'real madrid',
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

// Configuración CSV
const csvWriter = csv({
    path: 'madrid.csv',
    header: [
        {id: 'count', title: 'Tweet_count'},
        {id: 'author', title: 'Username'},
        {id: 'handle', title: 'Handle'},
        {id: 'text', title: 'Text'},
        {id: 'timestamp', title: 'Timestamp'},
        {id: 'date', title: 'Created At'},
        {id: 'replies', title: 'Replies'},
        {id: 'retweets', title: 'Retweets'},
        {id: 'likes', title: 'Likes'},
        {id: 'views', title: 'Views'},
        {id: 'url', title: 'Url'},
        {id: 'isVerified', title: 'isVerified'},
        {id: 'hasMedia', title: 'hasMedia'},
    ]
});

async function getFullTweets(busqueda1, busqueda2, busqueda3, busqueda4, fechaDesde, fechaHasta) {
    // Construcción de la query 
    let terminoBusqueda = '';
    if (!!busqueda1) terminoBusqueda = busqueda1;
    if (!!busqueda2) terminoBusqueda += ` "${busqueda2}"`;
    if (!!busqueda3) terminoBusqueda += ` (${busqueda3.replace(/ /g, " OR ")})`;
    if (!!busqueda4) terminoBusqueda += ` ${'-'+busqueda4.replace(/ /g," -")}`;

    const termURI = encodeURIComponent(`${terminoBusqueda} since:${fechaDesde} until:${fechaHasta}`);
    
    // Iniciar navegador
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
    const page = await context.newPage();

    // Configurar navegador
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log(`${new Date().toLocaleString()} - Navegando a Twitter...`);
    await page.goto(`https://x.com/search?q=${termURI}&src=typed_query`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // Esperar tweets iniciales
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

        // Verificar si hay respuesta de rate limit
            const response = await page.waitForResponse(response => {
                return response.url().includes('SearchTimeline') && 
                       response.status() === 429;
            }, { timeout: 5000 }).catch(() => null);

            if (response) {
                console.warn('⚠️ Se ha alcanzado el límite de tasa (Rate Limit)');
                rateLimitHit = true;
                break;
            }


        // Extraer tweets
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
                            handle: tweet.querySelector('[data-testid="User-Name"] a[href^="/"]')?.getAttribute('href').slice(1) || '@desconocido'
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

         // Marcar tweets como procesados
        await page.$$eval('[data-testid="tweet"]', tweets => {
            tweets.forEach(t => t.setAttribute('data-processed', 'true'));
        });

        // Filtrar por URLs únicas
        const existingUrls = new Set(tweets.map(t => t.url));
        const uniqueNewTweets = newTweets.filter(newTweet => 
            !existingUrls.has(newTweet.url) && newTweet.url !== ''
        );

        // Guardar en CSV si hay nuevos tweets
        if (uniqueNewTweets.length > 0) {
            const records = uniqueNewTweets.map((tweet, i) => ({
                count: tweetCount + i + 1,
                author: tweet.author.name,
                handle: tweet.author.handle,
                text: tweet.text,
                timestamp: tweet.timestamp,
                date: tweet.date,
                replies: tweet.metrics.replies,
                retweets: tweet.metrics.retweets,
                likes: tweet.metrics.likes,
                views: tweet.metrics.views,
                url: tweet.url,
                isVerified: tweet.isVerified,
                hasMedia: tweet.hasMedia
            }));

            await csvWriter.writeRecords(records);
            tweetCount += uniqueNewTweets.length;
            tweets = [...tweets, ...uniqueNewTweets];
        } else {
            attemptsWithoutNewTweets++;
            console.log(`No se encontraron nuevos tweets (intento ${attemptsWithoutNewTweets}/${MAX_ATTEMPTS_WITHOUT_NEW_TWEETS})`);
        }

        // Scroll y espera
        await scrollPage(page);
        await humanDelay();

        // Verificar si hemos alcanzado el límite
        if (tweetCount >= config.TWEETS_LIMIT) break;
    }

    await browser.close();
    console.log(`${new Date().toLocaleString()} - Finalizado. Total tweets recolectados: ${tweetCount}`);
    return tweets;
}

// Función de scroll mejorada
async function scrollPage(page) {
    const scrollSteps = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scrollSteps; i++) {
        await page.mouse.wheel(0, 300 + Math.random() * 700);
        await page.waitForTimeout(500 + Math.random() * 1500);
    }
}

// Ejecución
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
        console.log('Proceso completado exitosamente');
    } catch (error) {
        console.error('Error durante la ejecución:', error);
    }
})();