require('dotenv').config();

const { chromium } = require('playwright');
const { MongoClient } = require('mongodb');
const { log } = require('console');
const authFile = 'playwright/.auth/user.json';

// Configuración - RELLENA CON TUS DATOS
const config = {
  twitterCredentials: {
    username: process.env.EMAILSCRAPER, 
    username2:process.env.USERSCRAPER,
    password: process.env.PASSWORDSCRAPER
  },
  
};


async function loginInX() {
    // Iniciar un navegador y crea una pestaña
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
  
    // Dirigirse a la página de login de X
    await page.goto('https://x.com/i/flow/login');
  
    // Busca el input username y rellena tu username
    await page.locator('input[autocomplete="username"]').fill(config.twitterCredentials.username);
    // Busca el input username y rellena tu username
    await page.locator('input[autocomplete="username"]').fill(config.twitterCredentials.username2);
    // Busca el boton "Siguiente" y dale click
    await page.getByRole('button', { name: 'Siguiente' }).click();
    
    // Buscar el input de tipo password y rellena tu contraseña
    await page.locator('input[name="password"]').fill(config.twitterCredentials.password);
    // Busca el botón de login y le da click
    await page.getByTestId('LoginForm_Login_Button').click();
  
    // Espera que cargue la página principal de X o Twitter
    await page.waitForURL('https://x.com/home');

    // Guardar el contexto del navegador
  await page.context().storageState({path: authFile});
    // Espera 5s en la página principal
    await page.waitForTimeout(5000);
  
    await browser.close();
  }
  
  //loginInX();


  async function getTweetsFromASearch(busqueda) {
    // Procesar la búsqueda para ser admitida en la url
    const termURI = encodeURIComponent(busqueda);
  
    const browser = await chromium.launch({ headless: false });
    // Crear un contexto para el navegador con los datos de authFile
    const context = await browser.newContext({ storageState: authFile });
  
    const page = await context.newPage();
    await page.goto(`https://x.com/search?q=${termURI}`);
  
    // De aquí en adelante es lo mismo
    let min15tweets = [];
    let tweets = [];
  
    const tweetsLocator = page.locator('[data-testid="tweet"]');
    await tweetsLocator.first().waitFor();
  
    while (min15tweets.length < 15) {
      tweets = await page.evaluate(() => {
        const tweetList = document.querySelectorAll('[data-testid="tweet"]');
  
        const tweetTextList = [...tweetList].map(tweet => {
          try {
            const tweetText = tweet.querySelector('[data-testid="tweetText"]').innerText;
            return tweetText;
          } catch(e) {
            return "<multimedia>";
          }
        });
  
        return tweetTextList;
      });
  
      min15tweets = [...new Set([...min15tweets, ...tweets])];
  
      await page.mouse.wheel(0, 4000);
    }
  
    browser.close();
    console.log("Resultados: ", min15tweets);
    console.log("Número de Tweets: ", min15tweets.length);
  }

  async function getFullTweets(busqueda1,busqueda2,busqueda3,busqueda4, fechaDesde, fechaHasta) {

    
    let terminoBusqueda='';
    if (!!busqueda1) {
      terminoBusqueda = busqueda1; // qué pasa · contiene tanto “qué” como “pasa”
    }
    if (!!busqueda2) {
      terminoBusqueda = terminoBusqueda+` "${busqueda2}"`; // hora feliz · contiene la frase exacta “hora feliz”
    }
    if (!!busqueda3) {
      terminoBusqueda = terminoBusqueda+` (${busqueda3.replace(/ /g, " OR ")})`; // gatos perros · contiene “gatos” o “perros” (o ambos)
      console.log(terminoBusqueda)
    }
    if (!!busqueda4) {
      terminoBusqueda = terminoBusqueda+` ${'-'+busqueda4.replace(/ /g," -")}`; // gatos perros · no contiene “gatos” y no contiene “perros”
      console.log(terminoBusqueda)
    }
    
    

    const termURI = encodeURIComponent(
      `${terminoBusqueda} since:${fechaDesde} until:${fechaHasta}`
    );
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    
    // Configurar User-Agent y viewport más realista
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log(`Navegando a: https://x.com/search?q=${termURI}`);
    await page.goto(`https://x.com/search?q=${termURI}&src=typed_query`, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
    });

    // Esperar a que los tweets se carguen
    try {
        await page.waitForSelector('[data-testid="tweet"]', { timeout: 30000 });
    } catch (e) {
        console.error('No se encontraron tweets:', e);
        await browser.close();
        return [];
    }

    let tweets = [];
    let attempts = 0;
    const maxAttempts = 10;
    const targetTweets = 10;

    while (tweets.length < targetTweets && attempts < maxAttempts) {
        attempts++;
        console.log(`Intento ${attempts} - Tweets actuales: ${tweets.length}`);

        const newTweets = await page.$$eval('[data-testid="tweet"]', (tweetElements, hasta) => {
            const currentDate = new Date(hasta);
            currentDate.setDate(currentDate.getDate() + 1);

            return tweetElements.map(tweet => {
                try {
                    const tweetDate = new Date(tweet.querySelector('time')?.getAttribute('datetime'));
                    if (tweetDate > currentDate) return null;

                    return {
                        id: tweet.getAttribute('data-tweet-id') || Math.random().toString(36).substring(2),
                        text: tweet.querySelector('[data-testid="tweetText"]')?.textContent || '<multimedia>',
                        author: {
                          name: tweet.querySelector('[data-testid="User-Name"] div:first-child span span')?.textContent || 'Desconocido',
                          handle: tweet.querySelector('[data-testid="User-Name"] a[href^="/"]')?.getAttribute('href').slice(1) || '@desconocido'
                      },
                        timestamp: tweet.querySelector('time')?.getAttribute('datetime'),
                        date: tweetDate.toISOString().split('T')[0],
                        metrics: {
                            replies: tweet.querySelector('[data-testid="reply"]')?.textContent || '0',
                            retweets: tweet.querySelector('[data-testid="retweet"]')?.textContent || '0',
                            likes: tweet.querySelector('[data-testid="like"]')?.textContent || '0',
                            views: tweet.querySelector('[data-testid="view"]')?.textContent || '0'
                        },
                        url: tweet.querySelector('a[href*="/status/"]')?.href || '',
                        isVerified: !!tweet.querySelector('[data-testid="icon-verified"]'),
                        hasMedia: !!tweet.querySelector('[data-testid="tweetPhoto"]') || 
                                 !!tweet.querySelector('[data-testid="videoPlayer"]'),
                        tweet:tweet.getAttribute('author')
                    };
                } catch (e) {
                    console.error('Error procesando tweet:', e);
                    return null;
                }
            }).filter(Boolean);
        }, fechaHasta);

        const uniqueNewTweets = newTweets.filter(newTweet => 
            !tweets.some(t => t.id === newTweet.id)
        );

        tweets = [...tweets, ...uniqueNewTweets];
        console.log(`Tweets nuevos encontrados: ${uniqueNewTweets.length}`);

        await scrollPage(page);
        
        try {
            await page.waitForFunction(
                (prevCount) => document.querySelectorAll('[data-testid="tweet"]').length > prevCount,
                { timeout: 10000 },
                newTweets.length
            );
        } catch (e) {
            console.log('No aparecieron nuevos tweets después del scroll');
        }

        // Pequeña pausa aleatoria
        await page.waitForTimeout(2000 + Math.random() * 3000);
    }

    await browser.close();
    
    // Ordenar por fecha (más recientes primero)
    tweets.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    console.log(`Tweets recolectados (${fechaDesde} a ${fechaHasta}):`, tweets.length);
    console.log('Ejemplo de tweet:', tweets[0]);
    
    return tweets;
}



async function scrollPage(page) {
    // Scroll con variación aleatoria
    const scrollAmount = 1500 + Math.random() * 1000;
    await page.mouse.wheel(0, scrollAmount);
    
    // Pequeña pausa durante el scroll
    await page.waitForTimeout(500 + Math.random() * 500);
    
    // Scroll adicional para asegurar carga
    await page.mouse.wheel(0, 500 + Math.random() * 300);
}
  




//    loginInX()
/* getFullTweets('','barça','','', '2025-05-01', '2025-05-26')
    .then(tweets => {
        console.log('Total tweets:', tweets.length);
    })
    .catch(console.error);  */

    function getFecha(){
      console.log(new Date().toLocaleString());
    }

    getFecha();