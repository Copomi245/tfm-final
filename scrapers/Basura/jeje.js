require('dotenv').config();

const { chromium } = require('playwright');
const { MongoClient } = require('mongodb');

// Configuración - RELLENA CON TUS DATOS
const config = {
  twitterCredentials: {
    username: process.env.USERSCRAPER, 
    username2:process.env.USERSCRAPER,
    password: process.env.PASSWORDSCRAPER
  },
  searchParams: {
    term: 'Garchomp',
    since: '2024-05-01',
    until: '2024-05-31'
  },
  mongoConfig: {
    uri: 'mongodb://localhost:27017',
    dbName: 'twitter_data',
    collectionName: 'tweets'
  }
};

async function loginToTwitter(page) {
  try {
      console.log('Navegando a twitter.com/login...');
      await page.goto('https://twitter.com/login', { 
          waitUntil: 'networkidle',
          timeout: 60000 
      });

      // 1. Ingresar usuario/email
      console.log('Ingresando usuario...');
      await page.waitForSelector('input[autocomplete="username"]', { 
          state: 'visible',
          timeout: 15000 
      });
      await page.fill('input[autocomplete="username"]', config.twitterCredentials.username);
      await page.keyboard.press('Enter');

      // 2. Manejar posible pantalla de verificación intermedia
      try {
          await page.waitForSelector('input[name="text"]', { 
              state: 'visible',
              timeout: 5000 
          });
          console.log('Pantalla de verificación detectada...');
          await page.fill('input[name="text"]', config.twitterCredentials.username2 || config.twitterCredentials.username);
          await page.keyboard.press('Enter');
      } catch (error) {
          console.log('No apareció pantalla de verificación intermedia');
      }

      // 3. Ingresar contraseña - con espera más robusta
      console.log('Ingresando contraseña...');
      try {
          await page.waitForSelector('input[autocomplete="current-password"]', {
              state: 'visible',
              timeout: 10000
          });
          await page.fill('input[autocomplete="current-password"]', config.twitterCredentials.password);
          
          // Espera adicional después de llenar la contraseña
          await page.waitForTimeout(1000);
      } catch (error) {
          console.error('No se pudo encontrar el campo de contraseña');
          throw error;
      }

      // 4. Solución mejorada para el botón de login
      console.log('Manejando el botón de login...');
      await handleLoginButton(page);

      // 5. Verificar login exitoso
      await verifySuccessfulLogin(page);
      console.log('✔ Login exitoso');
      return true;

  } catch (error) {
      console.error('❌ Error durante el login:', error);
      await page.screenshot({ path: `login-error-${Date.now()}.png` });
      console.log('Se ha guardado una captura de pantalla del error');
      throw new Error(`Falló el proceso de login: ${error.message}`);
  }
}

async function handleLoginButton(page) {
  const maxAttempts = 3;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
      attempts++;
      console.log(`Intento ${attempts} de hacer clic en el botón...`);
      
      try {
          // Esperar a que el botón esté presente
          await page.waitForSelector('div[data-testid="LoginForm_Login_Button"]', {
              state: 'visible',
              timeout: 10000
          });

          // Verificar si el botón está habilitado
          const isEnabled = await page.evaluate(() => {
              const button = document.querySelector('div[data-testid="LoginForm_Login_Button"]');
              if (!button) return false;
              
              // Verificar si el botón está visible y no está deshabilitado
              const style = window.getComputedStyle(button);
              return style.display !== 'none' && 
                     style.visibility !== 'hidden' &&
                     !button.hasAttribute('disabled') &&
                     button.getAttribute('aria-disabled') !== 'true';
          });

          if (isEnabled) {
              // Intentar hacer clic normalmente
              try {
                  await page.click('div[data-testid="LoginForm_Login_Button"]');
                  await page.waitForTimeout(2000);
                  
                  // Verificar si el click funcionó
                  try {
                      await page.waitForSelector('div[data-testid="SideNav_NewTweet_Button"]', { 
                          timeout: 3000 
                      });
                      return; // Login exitoso
                  } catch (e) {
                      console.log('El clic normal no funcionó, probando método alternativo...');
                  }
              } catch (clickError) {
                  console.log('Error al hacer clic normal:', clickError.message);
              }

              // Método alternativo: clic mediante JavaScript
              await page.evaluate(() => {
                  const button = document.querySelector('div[data-testid="LoginForm_Login_Button"]');
                  if (button) {
                      button.style.pointerEvents = 'auto';
                      button.click();
                  }
              });
              await page.waitForTimeout(2000);
              
              // Verificar nuevamente si el login fue exitoso
              try {
                  await page.waitForSelector('div[data-testid="SideNav_NewTweet_Button"]', { 
                      timeout: 3000 
                  });
                  return; // Login exitoso
              } catch (e) {
                  console.log('El clic mediante JS no funcionó');
              }
          } else {
              console.log('El botón no está habilitado, intentando presionar Enter...');
              await page.keyboard.press('Enter');
              await page.waitForTimeout(2000);
              
              // Verificar si el Enter funcionó
              try {
                  await page.waitForSelector('div[data-testid="SideNav_NewTweet_Button"]', { 
                      timeout: 3000 
                  });
                  return; // Login exitoso
              } catch (e) {
                  console.log('Presionar Enter no funcionó');
              }
          }
          
          // Si llegamos aquí, ninguno de los métodos funcionó
          console.log('Ningún método funcionó en este intento, esperando y reintentando...');
          await page.waitForTimeout(3000);
          
      } catch (error) {
          console.error(`Error en el intento ${attempts}:`, error.message);
          if (attempts >= maxAttempts) throw error;
      }
  }
  
  throw new Error('No se pudo hacer clic en el botón de login después de varios intentos');
}
  
  // Función auxiliar para esperar botón habilitado
  async function waitForButtonToBeEnabled(page, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const isEnabled = await page.evaluate(() => {
        const button = document.querySelector('div[data-testid="LoginForm_Login_Button"]');
        if (!button) return false;
        
        // Verificar todos los indicadores de estado deshabilitado
        const isDisabled = button.disabled || 
                          button.getAttribute('aria-disabled') === 'true' ||
                          button.getAttribute('tabindex') === '-1' ||
                          button.classList.contains('r-icoktb'); // Clase para botón deshabilitado
        
        return !isDisabled;
      });
  
      if (isEnabled) return true;
      await page.waitForTimeout(500);
    }
    throw new Error('El botón de login no se habilitó en el tiempo esperado');
  }
  
  // Función auxiliar para hacer clic en el botón
  async function clickLoginButton(page) {
    try {
      // Intento 1: Click normal
      await page.click('div[data-testid="LoginForm_Login_Button"]');
      await page.waitForTimeout(2000);
      
      // Verificar si el click tuvo efecto
      try {
        await page.waitForSelector('div[data-testid="SideNav_NewTweet_Button"]', { timeout: 3000 });
        return;
      } catch (e) {
        console.log('Primer intento de click no funcionó, probando método alternativo...');
      }
  
      // Intento 2: Click mediante JavaScript
      await page.evaluate(() => {
        const button = document.querySelector('div[data-testid="LoginForm_Login_Button"]');
        if (button) {
          button.style.pointerEvents = 'auto';
          button.click();
        }
      });
      await page.waitForTimeout(2000);
      
      // Intento 3: Presionar Enter como último recurso
      await page.keyboard.press('Enter');
      
    } catch (error) {
      console.error('Error al hacer clic en el botón:', error);
      throw error;
    }
  }
  
  // Función auxiliar para verificar login exitoso
  async function verifySuccessfulLogin(page) {
    try {
      await page.waitForSelector('div[data-testid="SideNav_NewTweet_Button"]', { 
        timeout: 15000 
      });
    } catch (error) {
      // Verificar si aparece algún mensaje de error
      const errorMsg = await page.$('div[role="alert"]');
      if (errorMsg) {
        const errorText = await errorMsg.textContent();
        throw new Error(`Error de login: ${errorText}`);
      }
      throw error;
    }
  }

async function scrapeTweets(page) {
  const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(config.searchParams.term)}%20since%3A${config.searchParams.since}%20until%3A${config.searchParams.until}&src=typed_query`;
  await page.goto(searchUrl, { waitUntil: 'networkidle' });
  
  // Esperar resultados
  await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
  
  // Función mejorada para extraer tweets
  const extractTweets = async () => {
    return await page.$$eval('article[data-testid="tweet"]', (tweets) => {
      return tweets.map(tweet => {
        const textElement = tweet.querySelector('div[data-testid="tweetText"]');
        return {
          id: tweet.getAttribute('data-tweet-id') || Math.random().toString(36).substring(2),
          text: textElement ? textElement.innerText : '',
          author: tweet.querySelector('div[data-testid="User-Name"]')?.innerText || '',
          time: tweet.querySelector('time')?.getAttribute('datetime') || new Date().toISOString(),
          likes: tweet.querySelector('div[data-testid="like"]')?.innerText || '0',
          retweets: tweet.querySelector('div[data-testid="retweet"]')?.innerText || '0',
          replies: tweet.querySelector('div[data-testid="reply"]')?.innerText || '0'
        };
      });
    });
  };
  
  // Scroll y recolección
  let tweets = [];
  let previousHeight = 0;
  let attempts = 0;
  
  while (attempts < 5) {
    const newTweets = await extractTweets();
    tweets = [...new Set([...tweets, ...newTweets])];
    
    previousHeight = await page.evaluate('document.body.scrollHeight');
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(3000 + Math.random() * 2000);
    
    const newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === previousHeight) attempts++;
  }
  
  return tweets;
}

async function saveToMongoDB(tweets) {
  const client = new MongoClient(config.mongoConfig.uri);
  try {
    await client.connect();
    const collection = client.db(config.mongoConfig.dbName).collection(config.mongoConfig.collectionName);
    
    const operations = tweets.map(tweet => ({
      updateOne: {
        filter: { id: tweet.id },
        update: { $set: tweet },
        upsert: true
      }
    }));
    
    await collection.bulkWrite(operations);
    console.log(`Guardados ${tweets.length} tweets en MongoDB`);
  } finally {
    await client.close();
  }
}

(async () => {
  const browser = await chromium.launch({ 
    headless: false, // Cambia a true después de probar
    slowMo: 200 // Hacer acciones más lentas para parecer humano
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    // 1. Iniciar sesión
    console.log('Iniciando sesión en Twitter...');
    await loginToTwitter(page);
    
    // 2. Scraping
    console.log('Comenzando scraping...');
    const tweets = await scrapeTweets(page);
    
    // 3. Almacenamiento
    /* if (tweets.length > 0) {
      await saveToMongoDB(tweets);
    } else {
      console.log('No se encontraron tweets');
    } */
    
    console.log('Proceso completado con éxito');
  } catch (error) {
    console.error('Error durante el proceso:', error);
    //await page.screenshot({ path: 'error.png' });
    //console.log('Captura de pantalla guardada como error.png');
  } finally {
    await browser.close();
  }
})();