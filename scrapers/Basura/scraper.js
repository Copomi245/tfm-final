const { chromium } = require('playwright');
const { MongoClient } = require('mongodb');

// Configuración básica
const config = {
  searchTerm: 'inteligencia artificial',
  sinceDate: '2024-05-01',
  untilDate: '2024-05-31',
  maxTweets: 100,
  mongoUri: 'mongodb://localhost:27017',
  dbName: 'twitter_data',
  collectionName: 'tweets'
};

async function runScraper() {
  // Iniciar navegador
  const browser = await chromium.launch({ 
    headless: false, // Cambiar a true para ejecución en producción
    slowMo: 100 // Ralentizar acciones para parecer humano
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();

  try {
    // 1. Navegar a la página de búsqueda de Twitter
    const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(config.searchTerm)}%20since%3A${config.sinceDate}%20until%3A${config.untilDate}&src=typed_query`;
    console.log(`Navegando a: ${searchUrl}`);
    
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    // 2. Esperar a que carguen los tweets
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });

    // 3. Función para extraer datos de un tweet
    const extractTweetData = async (tweetElement) => {
      return await tweetElement.evaluate((node) => {
        const getText = (selector) => node.querySelector(selector)?.innerText.trim() || '';
        const getNumber = (selector) => {
          const text = getText(selector);
          return text.includes('K') ? parseFloat(text) * 1000 : 
                 text.includes('M') ? parseFloat(text) * 1000000 : 
                 parseInt(text.replace(/\D/g, '') || 0);
        };

        return {
          tweetId: node.getAttribute('data-tweet-id') || Date.now().toString(),
          text: getText('div[data-testid="tweetText"]'),
          author: {
            name: getText('div[data-testid="User-Name"] div:nth-of-type(1)'),
            handle: getText('div[data-testid="User-Name"] div:nth-of-type(2)'),
            verified: !!node.querySelector('svg[aria-label="Verified"]')
          },
          timestamp: node.querySelector('time')?.getAttribute('datetime') || new Date().toISOString(),
          engagement: {
            replies: getNumber('div[data-testid="reply"]'),
            retweets: getNumber('div[data-testid="retweet"]'),
            likes: getNumber('div[data-testid="like"]'),
            views: getNumber('div[data-testid="app-text-transition-container"]')
          },
          extractedAt: new Date().toISOString()
        };
      });
    };

    // 4. Recopilar tweets con scroll
    let tweets = [];
    let scrollAttempts = 0;
    const maxScrollAttempts = 5;

    while (tweets.length < config.maxTweets && scrollAttempts < maxScrollAttempts) {
      const currentTweets = await page.$$('article[data-testid="tweet"]');
      
      for (const tweetElement of currentTweets) {
        try {
          const tweetData = await extractTweetData(tweetElement);
          if (!tweets.some(t => t.tweetId === tweetData.tweetId)) {
            tweets.push(tweetData);
            console.log(`Tweet ${tweets.length}: ${tweetData.text.substring(0, 50)}...`);
          }
        } catch (error) {
          console.error('Error procesando tweet:', error);
        }
      }

      // Hacer scroll
      const previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2000 + Math.random() * 3000);
      
      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === previousHeight) scrollAttempts++;
    }

    // 5. Almacenar en MongoDB
    if (tweets.length > 0) {
      const client = new MongoClient(config.mongoUri);
      await client.connect();
      
      try {
        const db = client.db(config.dbName);
        const collection = db.collection(config.collectionName);
        
        // Insertar solo tweets nuevos
        const operations = tweets.map(tweet => ({
          updateOne: {
            filter: { tweetId: tweet.tweetId },
            update: { $setOnInsert: tweet },
            upsert: true
          }
        }));
        
        const result = await collection.bulkWrite(operations);
        console.log(`\nTweets almacenados: ${result.upsertedCount} nuevos, ${tweets.length} procesados`);
      } finally {
        await client.close();
      }
    }

    return tweets;

  } catch (error) {
    console.error('Error durante el scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Ejecutar el scraper
runScraper()
  .then(tweets => console.log(`Scraping completado. Total tweets: ${tweets.length}`))
  .catch(err => console.error('Error:', err));
