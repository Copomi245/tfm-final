require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuración
const config = {
    POSTS_LIMIT: 100,
    WAIT_TIME_MIN: 3000,
    WAIT_TIME_MAX: 8000,
    // Configuración de búsqueda (todos los campos son opcionales)
    QUERY: {
        searchTerm: 'tecnología',  // Término general de búsqueda
        exactPhrase: '',           // Frase exacta entre comillas
        hashtag: '',               // Hashtag (sin #)
        userFilter: '',            // 'from:', 'to:', o 'mentions:'
        username: '',              // usuario.bsky.social
        sinceDate: '',             // YYYY-MM-DD
        untilDate: ''              // YYYY-MM-DD
    }
};

// Helper para tiempos de espera
const humanDelay = () => new Promise(resolve => {
    const waitTime = config.WAIT_TIME_MIN + Math.random() * (config.WAIT_TIME_MAX - config.WAIT_TIME_MIN);
    console.log(`${new Date().toLocaleString()} - Esperando ${Math.round(waitTime/1000)} segundos...`);
    setTimeout(resolve, waitTime);
});

// Función para generar nombres de archivo
async function updateJSONFile(posts, queryParams) {
    const dir = './bluesky_posts';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Construir nombre del archivo
    let fileNameParts = [];
    if (queryParams.searchTerm) fileNameParts.push(queryParams.searchTerm.replace(/[^a-z0-9áéíóúüñÁÉÍÓÚÜÑ]/gi, '_'));
    if (queryParams.exactPhrase) fileNameParts.push(`"${queryParams.exactPhrase.replace(/[^a-z0-9áéíóúüñÁÉÍÓÚÜÑ\s]/gi, '').replace(/\s+/g, '-')}"`);
    if (queryParams.hashtag) fileNameParts.push(`#${queryParams.hashtag.replace(/[^a-z0-9áéíóúüñÁÉÍÓÚÜÑ]/gi, '_')}`);
    if (queryParams.userFilter && queryParams.username) {
        fileNameParts.push(`${queryParams.userFilter.replace(/:/g, '')}_${queryParams.username.replace(/\./g, '-')}`);
    }
    
    const dateRange = queryParams.sinceDate || queryParams.untilDate 
        ? `${queryParams.sinceDate || 'any'}_to_${queryParams.untilDate || 'any'}`
        : 'no_date_limit';
    
    const fileName = `posts_${fileNameParts.join('_') || 'all_posts'}_${dateRange}.json`;
    const fullPath = path.join(dir, fileName);
    
    fs.writeFileSync(fullPath, JSON.stringify(posts, null, 2));
    console.log(`Archivo guardado: ${fullPath}`);
}

// Función para construir la query de búsqueda
function buildSearchQuery(params) {
    let queryParts = [];
    
    if (params.searchTerm) queryParts.push(params.searchTerm);
    if (params.exactPhrase) queryParts.push(`"${params.exactPhrase}"`);
    if (params.hashtag) queryParts.push(`#${params.hashtag}`);
    if (params.userFilter && params.username) queryParts.push(`${params.userFilter}${params.username}`);
    if (params.sinceDate) queryParts.push(`since:${params.sinceDate}`);
    if (params.untilDate) queryParts.push(`until:${params.untilDate}`);
    
    return queryParts.join(' ');
}

async function performSearch(page, queryParams) {
    try {
        // 1. Construir la query de búsqueda
        const searchQuery = buildSearchQuery(queryParams);
        console.log(`Preparando búsqueda: "${searchQuery}"`);

        // 2. Localizar y hacer click en el campo de búsqueda
        const searchInput = await locateSearchInput(page);
        if (!searchInput) {
            throw new Error('No se pudo encontrar el campo de búsqueda');
        }

        // 3. Interacción humana con el campo de búsqueda
        await humanType(searchInput, searchQuery);

        // 4. Submit de la búsqueda
        await submitSearch(page, searchInput);

        // 5. Esperar resultados
        await waitForResults(page);
        
        return true;
    } catch (error) {
        console.error('Error en la búsqueda:', error);
        await page.screenshot({ path: `search-error-${Date.now()}.png` });
        return false;
    }
}


async function locateSearchInput(page) {
    const selectors = [
        'input[placeholder="Search for posts, users, or feeds"]', // Selector específico del placeholder
        'input[aria-label="Search"]', // Selector por aria-label
        'input[role="search"]', // Selector por role
        'input[type="search"]' // Selector por tipo
    ];

    for (const selector of selectors) {
        try {
            const input = await page.waitForSelector(selector, {
                state: 'visible',
                timeout: 5000
            });
            console.log(`Campo de búsqueda encontrado con selector: ${selector}`);
            await input.scrollIntoViewIfNeeded();
            await input.hover();
            await page.waitForTimeout(500);
            return input;
        } catch (error) {
            console.log(`Selector ${selector} no encontrado, probando siguiente...`);
        }
    }
    return null;
}

async function humanType(element, text) {
    // Limpiar campo primero
    await element.click({ clickCount: 3 });
    await element.press('Backspace');
    await page.waitForTimeout(300 + Math.random() * 200);

    // Escribir carácter por carácter con delays aleatorios
    for (const char of text) {
        await element.type(char, { delay: 50 + Math.random() * 100 });
        await page.waitForTimeout(50 + Math.random() * 50);
    }
    console.log('Búsqueda introducida');
    await page.waitForTimeout(800);
}

async function submitSearch(page, searchInput) {
    try {
        // Intentar con Enter
        await searchInput.press('Enter');
        console.log('Búsqueda enviada con Enter');
    } catch (error) {
        console.log('Falló Enter, intentando con botón de búsqueda...');
        // Alternativa: Buscar botón de búsqueda
        const searchButton = await page.$('button[aria-label="Search"], button[type="submit"]');
        if (searchButton) {
            await searchButton.click();
            console.log('Búsqueda enviada con botón');
        } else {
            throw new Error('No se pudo enviar la búsqueda');
        }
    }
    await page.waitForTimeout(2000);
}

async function waitForResults(page) {
    // Esperar a que aparezcan resultados o el mensaje "No results"
    try {
        await Promise.race([
            page.waitForSelector('[data-testid="post"]', { timeout: 15000 }),
            page.waitForSelector('text="No results"', { timeout: 15000 })
        ]);
        console.log('Resultados de búsqueda cargados');
    } catch (error) {
        throw new Error('No se cargaron resultados visibles');
    }
}

// Función de autenticación actualizada
async function loginToBluesky(page) {
    try {
        console.log('Intentando iniciar sesión...');
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

async function clickSearch(page){
    try {
                const button = await page.waitForSelector('input[placeholder="Search"]', {
                    state: 'visible',
                    timeout: 5000
                });
                await button.scrollIntoViewIfNeeded();
                await button.hover();
                await page.waitForTimeout(500 + Math.random() * 300);
                await button.click({ delay: 100 });
                console.log("✅ Click exitoso usando selector por aria-label");

                console.log(`${new Date().toLocaleString()} - Rellenando contraseña...`);
        const passwordField = await page.$('input[placeholder="Search"]');
        console.log("JAJAJAJAJAJ")
        await passwordField.click({ clickCount: 3 });
        await passwordField.type(process.env.BS_PASSWORD, { delay: 100 });
        await page.waitForTimeout(1000);

                return true;
            } catch (error) {
                console.log(error);
            }
}

async function getBlueskyPosts(queryParams) {
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 100 // Añade delay entre acciones para mayor fiabilidad
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Configuración de la página
    await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    await page.setViewportSize({ width: 1280, height: 800 });

    // Autenticación si hay credenciales
    if (process.env.BLUESKY_USERNAME && process.env.BLUESKY_PASSWORD) {
        const loginSuccess = await loginToBluesky(page);
        if (!loginSuccess) {
            await browser.close();
            return [];
        }
    }

    // Navegar directamente a la página de búsqueda (más fiable)
    await page.goto('https://bsky.app/search', { 
        waitUntil: 'networkidle',
        timeout: 30000
    });

    // Realizar la búsqueda
    const searchSuccess = await performSearch(page, queryParams);
    if (!searchSuccess) {
        await browser.close();
        return [];
    }

    let posts = [];
    let postCount = 0;
    let attemptsWithoutNewPosts = 0;
    const MAX_ATTEMPTS_WITHOUT_NEW_POSTS = 10;

    while (postCount < config.POSTS_LIMIT && 
           attemptsWithoutNewPosts < MAX_ATTEMPTS_WITHOUT_NEW_POSTS) {
        console.log(`${new Date().toLocaleString()} - Recolectando posts (${postCount}/${config.POSTS_LIMIT})`);

        const newPosts = await page.$$eval('[data-testid="post"]:not([data-processed])', (postElements) => {
            return postElements.map(post => {
                try {
                    return {
                        id: post.getAttribute('data-post-id') || Math.random().toString(36).substring(2),
                        text: post.querySelector('[data-testid="postText"]')?.textContent
                            .replace(/\n/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim() || '',
                        author: {
                            name: post.querySelector('[data-testid="authorName"]')?.textContent || 'Desconocido',
                            handle: post.querySelector('[data-testid="authorHandle"]')?.textContent || '@desconocido'
                        },
                        timestamp: post.querySelector('time')?.getAttribute('datetime'),
                        likes: post.querySelector('[data-testid="likeCount"]')?.textContent || '0',
                        reposts: post.querySelector('[data-testid="repostCount"]')?.textContent || '0',
                        replies: post.querySelector('[data-testid="replyCount"]')?.textContent || '0',
                        url: post.querySelector('a[href*="/post/"]')?.href || '',
                        hasMedia: !!post.querySelector('[data-testid="postMedia"]')
                    };
                } catch (e) {
                    console.error('Error procesando post:', e);
                    return null;
                }
            }).filter(Boolean);
        });

        await page.$$eval('[data-testid="post"]', posts => {
            posts.forEach(p => p.setAttribute('data-processed', 'true'));
        });

        const existingUrls = new Set(posts.map(p => p.url));
        const uniqueNewPosts = newPosts.filter(newPost => 
            !existingUrls.has(newPost.url) && newPost.url !== ''
        );

        if (uniqueNewPosts.length > 0) {
            posts = [...posts, ...uniqueNewPosts];
            postCount += uniqueNewPosts.length;
            
            await updateJSONFile(posts, queryParams);
        } else {
            attemptsWithoutNewPosts++;
            console.log(`No se encontraron nuevos posts (intento ${attemptsWithoutNewPosts}/${MAX_ATTEMPTS_WITHOUT_NEW_POSTS})`);
        }

        await scrollPage(page);
        await humanDelay();
    }

    await browser.close();
    console.log(`${new Date().toLocaleString()} - Finalizado. Total posts recolectados: ${postCount}`);
    return posts;
}

async function scrollPage(page) {
    const scrollSteps = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scrollSteps; i++) {
        await page.mouse.wheel(0, 300 + Math.random() * 700);
        await page.waitForTimeout(500 + Math.random() * 1500);
    }
}

(async () => {
    try {
        await getBlueskyPosts(config.QUERY);
    } catch (error) {
        console.error('Error durante la ejecución:', error);
    }
})();