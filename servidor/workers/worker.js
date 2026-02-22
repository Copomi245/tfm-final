const { Worker } = require('bullmq');
const redis = require('../shared/redis');
const { query } = require('../config/database');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const formatearFecha = require('../scripts/fecha');


class JobCancelledError extends Error {
    constructor(message) {
        super(message);
        this.name = 'JobCancelledError';
    }
}


// Cambiar el nombre del worker a algo más genérico o mantenerlo y adaptarlo
class SocialMediaWorker {
    constructor() {
        this.JobCancelledError = JobCancelledError; 
        this.apiBaseUrl = 'http://localhost:3001'
        
        // Cambiar el nombre de la cola a algo más genérico
        this.worker = new Worker('bluesky-queue', async job => {
            return await this.processJob(job);
        }, {
            connection: redis,
            concurrency: 1,
            limiter: {
                max: 2,
                duration: 60000
            }
        });

        this.setupEvents();
    }


    setupEvents() {
        this.worker.on('completed', async (job, result) => {
            if (result && result.cancelled) {
                console.log(`Job ${job.id} cancelado exitosamente`);
            } else {
                console.log(`Job ${job.id} completado`);
                await this.updateJobStatus(job.id, 'completed', result);
            }
        });
    
        this.worker.on('failed', async (job, err) => {
        const isCancellation = err instanceof this.JobCancelledError || 
                              err.name === 'JobCancelledError' ||
                              (err.message && err.message.includes('Trabajo cancelado'));
        
        if (isCancellation) {
            console.log(`⏹Job ${job.id} cancelado (manejado silenciosamente)`);
            return;
        }
        
        console.log(`Job ${job.id} falló:`, err.message);
        await this.updateJobStatus(job.id, 'failed', { error: err.message });
    });
    
        this.worker.on('active', async (job) => {
            console.log(`Job ${job.id} empezó a procesarse`);
            await this.updateJobStatus(job.id, 'processing');
        });
    
        this.worker.on('error', (err) => {
            if (err instanceof this.JobCancelledError || err.message.includes('Trabajo cancelado')) {
                console.log('⏹Error de cancelación manejado');
                return;
            }
            console.log('Error en worker Bluesky:', err.message);
        });
    }
    
        async updateJobStatus(bullmqId, status, result = null) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/jobs/${bullmqId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status, result })
                });
                
                if (!response.ok) throw new Error('Error updating job status');
            } catch (error) {
                console.error('Error actualizando estado del trabajo:', error);
            }
        }
    
        async getBlueskyCredentials() {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/credentials/bluesky`);
                if (!response.ok) throw new Error('Error fetching credentials');
                
                const credentials = await response.json();
                if (!credentials.username) throw new Error('No hay cuentas disponibles');
                
                return credentials;
            } catch (error) {
                throw new Error(`Error obteniendo credenciales: ${error.message}`);
            }
        }
    
        async getTwitterCredentials() {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/credentials/twitter`);
                if (!response.ok) throw new Error('Error fetching credentials');
                
                const credentials = await response.json();
                if (!credentials.username) throw new Error('No hay cuentas disponibles');
                
                return credentials;
            } catch (error) {
                throw new Error(`Error obteniendo credenciales: ${error.message}`);
            }
        }
    
        async recordAccountUsage(cuentaId, trabajoId, success, itemsScraped, errorMessage, duration) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/account-usage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cuentaId, trabajoId, success, itemsScraped, errorMessage, duration })
                });
                
                if (!response.ok) throw new Error('Error recording account usage');
            } catch (error) {
                console.error('Error registrando uso de cuenta:', error);
            }
        }
    
        async getJobByBullmqId(bullmqId) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/jobs/bullmq/${bullmqId}`);
                if (!response.ok) {
                    if (response.status === 404) return null;
                    throw new Error(`HTTP ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error obteniendo trabajo por bullmq_id:', error);
                return null;
            }
        }
    
        async updateJobStatusDirect(jobId, updates) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/jobs/${jobId}/status-direct`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('Error actualizando estado directo del trabajo:', error);
                throw error;
            }
        }
    
        async getJobParent(jobId) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/jobs/${jobId}/parent`);
                if (!response.ok) {
                    if (response.status === 404) return { trabajo_padre_id: null };
                    throw new Error(`HTTP ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error obteniendo trabajo padre:', error);
                return { trabajo_padre_id: null };
            }
        }
    
        async getJobInfo(jobId) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/jobs/${jobId}/info`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error obteniendo información del trabajo:', error);
                return { es_recurrente: false, recurrente_hasta: null };
            }
        }
    
        async getChildrenStatus(parentId) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/jobs/${parentId}/children-status`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error obteniendo estado de hijos:', error);
                return [];
            }
        }
    
        async executeUpdateQuery(sql, params) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/worker/execute-query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql, params })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('Error ejecutando query:', error);
                throw error;
            }
        }
    
        async loginToBluesky(page, username, password) {
            try {
                console.log('Iniciando sesión en Bluesky...');
    
                // Verificar si ya estamos logueados
                await page.waitForTimeout(3000);
    
                // Intentar encontrar el botón de login (selectores actualizados)
                const loginButton = await page.waitForSelector('button:has-text("Iniciar sesión"), button:has-text("Sign in"), button:has-text("Log in"), button[aria-label="Sign in"], button[aria-label="Iniciar Sesión"]', {
                    timeout: 10000,
                    state: 'visible'
                }).catch(() => null);
    
                if (!loginButton) {
                    console.log('No se encontró botón de login, posiblemente ya está logueado');
                    return true;
                }
    
                await loginButton.click();
                await page.waitForTimeout(2000);
    
                // Esperar formulario de login
                await page.waitForSelector('input[data-testid="loginUsernameInput"], input[name="identifier"], input[type="text"]', {
                    timeout: 10000,
                    state: 'visible'
                });
                
                // Ingresar credenciales
                const usernameField = await page.$('input[data-testid="loginUsernameInput"], input[name="identifier"], input[type="text"]');
                await usernameField.click({ clickCount: 3 });
                await usernameField.type(username, { delay: 100 });
                await page.waitForTimeout(1000);
                
                const passwordField = await page.$('input[data-testid="loginPasswordInput"], input[name="password"], input[type="password"]');
                await passwordField.click({ clickCount: 3 });
                await passwordField.type(password, { delay: 100 });
                await page.waitForTimeout(1000);
                
                // Enviar formulario
                const submitButton = await page.$('button[data-testid="loginNextButton"], button[type="submit"]');
                await submitButton.click();
                
                // Esperar confirmación
                await page.waitForSelector('a[href^="/profile/"], [data-testid="profileButton"]', { 
                    timeout: 30000 
                });
                
                console.log('Sesión iniciada correctamente');
                return true;
            } catch (error) {
                console.error('Error en el inicio de sesión:', error);
                return false;
            }
        }
    
        async loginToTwitter(page, username, password) {
        try {
            console.log('Iniciando sesión en Twitter...');
    
            // Esperar formulario de login
            await page.waitForSelector('input[autocomplete="username"]', {
                timeout: 10000,
                state: 'visible'
            });
            
            // Ingresar username
            const usernameField = await page.$('input[autocomplete="username"]');
            await usernameField.click({ clickCount: 3 });
            await usernameField.type(username, { delay: 100 });
            await page.waitForTimeout(2000);
    
            const nextButton = await page.waitForSelector(
                'button:has-text("Next"), button:has-text("Siguiente"), [data-testid="ocfSettingsListNextButton"]', 
                { 
                    timeout: 5000,
                    state: 'visible' 
                }
            ).catch(() => null);
    
            if (nextButton) {
                await nextButton.click();
                console.log('Botón Next encontrado y clicado');
            } else {
                console.log('Botón Next no encontrado, intentando con Enter...');
                await page.keyboard.press('Enter');
            }
            
            await page.waitForTimeout(3000);
    
            // Esperar campo de password
            await page.waitForSelector('input[name="password"], input[type="password"]', {
                timeout: 10000,
                state: 'visible'
            });
    
            const passwordField = await page.$('input[name="password"], input[type="password"]');
            await passwordField.click({ clickCount: 3 });
            await passwordField.type(password, { delay: 100 });
            await page.waitForTimeout(2000);
            
            // Hacer clic en el botón de login
            const submitButton = await page.waitForSelector(
                'button[data-testid="LoginForm_Login_Button"], button[type="submit"]', 
                { 
                    timeout: 5000,
                    state: 'visible' 
                }
            );
    
            if (submitButton) {
                await submitButton.click();
                console.log('Formulario de login enviado');
            } else {
                await page.keyboard.press('Enter');
            }
            
            // Esperar confirmación de login
            await page.waitForSelector('a[href^="/profile/"], [data-testid="profileButton"], [data-testid="AppTabBar_Profile_Link"]', { 
                timeout: 30000 
            });
            
            console.log('Sesión iniciada correctamente');
            return true;
        } catch (error) {
            console.error('Error en el inicio de sesión:', error);
            
            const alreadyLoggedIn = await page.$('a[href^="/profile/"], [data-testid="profileButton"]').catch(() => null);
            if (alreadyLoggedIn) {
                console.log('Sesión activa detectada (fallback)');
                return true;
            }
            
            return false;
        }
    }
    
        humanDelay(min = 5000, max = 12000) {
            return new Promise(resolve => {
                const waitTime = min + Math.random() * (max - min);
                console.log(`Esperando ${Math.round(waitTime/1000)} segundos...`);
                setTimeout(resolve, waitTime);
            });
        }
    
        async scrollPage(page) {
            const scrollSteps = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < scrollSteps; i++) {
                await page.mouse.wheel(0, 500 + Math.random() * 2000);
                await page.waitForTimeout(2000 + Math.random() * 3000);
            }
        }
    
        
    
        
        async selectLatestTab(page) {
            try {
                console.log("Buscando pestañas de resultados...");
                await page.waitForSelector('[role="tab"]', { timeout: 30000 });
                
                const tabs = await page.$$('[role="tab"]');
                if (tabs.length >= 2) {
                    console.log("Encontradas pestañas, seleccionando la segunda (Más recientes)...");
                    await tabs[1].click();
                    console.log('Pestaña "Más recientes" seleccionada');
                    await this.humanDelay(2000, 4000);
                    
                    // Verificar que se seleccionó correctamente
                    const isSelected = await tabs[1].getAttribute('aria-selected');
                    if (isSelected !== 'true') {
                        console.warn('La pestaña no se marcó como seleccionada, intentando nuevamente');
                        await tabs[1].click();
                        await this.humanDelay(1000, 2000);
                    }
                    
                    return true;
                } else {
                    console.log('No se encontraron suficientes pestañas, continuando sin seleccionar');
                    return false;
                }
            } catch (e) {
                console.error('Error al seleccionar pestaña "Más recientes":', e.message);
                console.log('Continuando sin seleccionar pestaña específica');
                return false;
            }
        }
    
        
        async scrapeBlueskyPosts(page, tweetsLimit, checkCancel, JobCancelledError) {
        let posts = [];
        let attemptsWithoutNewPosts = 0;
        const MAX_ATTEMPTS_WITHOUT_NEW_POSTS = 5;
        
        while (posts.length < tweetsLimit && attemptsWithoutNewPosts < MAX_ATTEMPTS_WITHOUT_NEW_POSTS) {
            console.log(`Recolectando posts (${posts.length}/${tweetsLimit})`);
    
            if (await checkCancel()) {
                console.log('Trabajo cancelado durante scraping de posts');
                throw new JobCancelledError('Trabajo cancelado por el usuario');
            }
            
            const rawPosts = await page.$$eval(
                'div[class="css-g5y9jx"][style="flex: 1 1 0%;"] div[role="link"][tabindex="0"]:not([data-processed])', 
                (postElements) => {
                    return postElements.map(post => {
                        try {
                            // Selector para el autor
                            const authorLink = post.querySelector('a[aria-label*="Ver perfil"]');
                            
                            // Selector para el texto 
                            const textElement = post.querySelector('[data-testid="postText"]');
                            
                            // Selector para el enlace de fecha
                            const dateLink = post.querySelector('a[href*="/post/"]');
                            const fecha = dateLink ? dateLink.getAttribute('aria-label') : '';
                            
                            // Función para métricas
                            const metrics = (testid) => {
                                const el = post.querySelector(`[data-testid="${testid}"]`);
                                return el ? (el.textContent.match(/\d+/) || ['0'])[0] : '0';
                            };
    
                            // DETECCIÓN ESPECÍFICA PARA CONTENIDO MULTI
                            let hasMediaContent = false;
                            
                            // Buscar imágenes específicas de contenido (feed_thumbnail)
                            const contentImages = post.querySelectorAll('img[src*="feed_thumbnail"][style*="transition-duration: 0ms"]');
    
                            // Buscar contenedores de media específicos
                            const mediaContainers = post.querySelectorAll('[style*="padding-top"][style*="overflow: hidden"]');
    
                            // Buscar videos
                            const contentVideos = post.querySelectorAll('video');
    
                            // Verificar que sean imágenes de contenido (no avatares)
                            for (const img of contentImages) {
                                const src = img.src || '';
                                if (src.includes('feed_thumbnail')) {
                                    hasMediaContent = true;
                                    break;
                                }
                            }
    
                            if (!hasMediaContent) {
                                hasMediaContent = mediaContainers.length > 0 || contentVideos.length > 0;
                            }
    
    
                            // Extraer handle del perfil
                            let handle = '@desconocido';
                            if (authorLink?.href) {
                                const match = authorLink.href.match(/\/profile\/([^\/]+)/);
                                handle = match ? `@${match[1]}` : `@${authorLink.href.split('/profile/')[1]}`;
                            }
    
                            return {
                                id: dateLink?.href.split('/').pop() || Math.random().toString(36).substring(2, 10),
                                text: textElement?.textContent || '',
                                author: {
                                    name: authorLink?.textContent?.replace(/[\u202A-\u202E]/g, '').trim() || '',
                                    handle: handle,
                                    verified: !!post.querySelector('[aria-label*="Verified"]')
                                },
                                timestamp: fecha, 
                                url: dateLink?.href ? `${dateLink.href}` : '',
                                metrics: {
                                    replies: metrics('replyBtn'),
                                    reposts: metrics('repostBtn'),
                                    likes: metrics('likeBtn')
                                },
                                hasMedia: hasMediaContent
                                
                            };
                        } catch (e) {
                            console.error('Error procesando post:', e);
                            return null;
                        }
                    }).filter(Boolean);
                }
            ).catch(error => {
                console.log('Error al evaluar posts:', error.message);
                return [];
            });
    
            // Formatear las fechas 
            const newPosts = rawPosts.map(post => ({
                ...post,
                timestamp: post.timestamp ? formatearFecha(post.timestamp) : ''
            }));
    
            // Marcar posts como procesados
            await page.$$eval(
                'div[class="css-g5y9jx"][style="flex: 1 1 0%;"] div[role="link"][tabindex="0"]', 
                posts => {
                    posts.forEach(p => p.setAttribute('data-processed', 'true'));
                }
            ).catch(() => {});
    
            if (newPosts.length > 0) {
                posts = [...posts, ...newPosts];
                attemptsWithoutNewPosts = 0;
                console.log(`${newPosts.length} nuevos posts | Total: ${posts.length}/${tweetsLimit}`);
                
    
            } else {
                attemptsWithoutNewPosts++;
                console.log(`No hay nuevos posts (intento ${attemptsWithoutNewPosts}/${MAX_ATTEMPTS_WITHOUT_NEW_POSTS})`);
            }
    
            if (await checkCancel()) {
                console.log('Trabajo cancelado antes de scroll');
                throw new JobCancelledError('Trabajo cancelado por el usuario');
            }
            await this.scrollPage(page);
            await this.humanDelay();
        }
    
        return posts;
    }
    
        async scrapeBluesky(jobData, credentials, checkCancel, JobCancelledError) {
            const { palabras, fraseExacta, hashtags, usuarioBusqueda, fechaDesde, fechaHasta, tweetsLimit = 100 } = jobData;
            const startTime = Date.now();
    
            const checkForCancellation = async () => {
            if (await checkCancel()) {
                console.log('Trabajo cancelado, deteniendo scraping...');
                throw new JobCancelledError('Trabajo cancelado por el usuario');
            }
        };
            
            let browser;
            let posts = [];
            
            try {
                // Corregir fechas si están invertidas
                let correctedFechaDesde = fechaDesde;
                let correctedFechaHasta = fechaHasta;
                
                if (fechaDesde && fechaHasta && new Date(fechaDesde) > new Date(fechaHasta)) {
                    console.log('Fechas invertidas, corrigiendo...');
                    [correctedFechaDesde, correctedFechaHasta] = [fechaHasta, fechaDesde];
                }
    
                // Construir término de búsqueda
                let terminoBusqueda = '';
                if (palabras) terminoBusqueda = palabras;
                if (fraseExacta) terminoBusqueda += ` "${fraseExacta}"`;
                if (hashtags) terminoBusqueda += ` ${hashtags.replace(/ /g, " OR ")}`;
                if (usuarioBusqueda) terminoBusqueda += ` from:${usuarioBusqueda}`;
                if (correctedFechaDesde) terminoBusqueda += ` since:${correctedFechaDesde}`;
                if (correctedFechaHasta) terminoBusqueda += ` until:${correctedFechaHasta}`;
                
                const termURI = encodeURIComponent(terminoBusqueda.trim());
                console.log('Búsqueda:', terminoBusqueda);
    
                // Configurar browser
                browser = await chromium.launch({ 
                    headless: false,
                    timeout: 60000
                });
                
                const context = await browser.newContext();
                const page = await context.newPage();
    
                await page.setExtraHTTPHeaders({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                });
                await page.setViewportSize({ width: 1280, height: 800 });
    
                console.log('Navegando a Bluesky...');
                await page.goto(`https://bsky.app/search?q=${termURI}&src=typed_query`, {
                    waitUntil: 'networkidle',
                    timeout: 60000
                });
    
                await checkForCancellation();
                
    
                // Iniciar sesión
                const loginSuccess = await this.loginToBluesky(page, credentials.username, credentials.password);
                if (!loginSuccess) {
                    throw new Error('Error al iniciar sesión en Bluesky');
                }
    
                await checkForCancellation();
    
                // SELECCIÓN DE PESTAÑA "ÚLTIMO" CON SELECTORES EXACTOS
                console.log("Seleccionando pestaña 'Último'...");
                
                try {
                    // Esperar a que las pestañas estén disponibles
                    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
                    
                    // Método 1: Selector exacto por data-testid
                    const ultimoTabSelector = '[role="tab"][data-testid="undefined-selector-1"]';
                    const ultimoTab = await page.$(ultimoTabSelector);
                    
                    if (ultimoTab) {
                        console.log('Pestaña "Último" encontrada por data-testid');
                        
                        // Verificar si ya está seleccionada (color azul en la línea inferior)
                        const isAlreadySelected = await page.$eval(ultimoTabSelector, tab => {
                            const line = tab.querySelector('.r-xoduu5');
                            return line && line.style.backgroundColor === 'rgb(16, 131, 254)';
                        });
                        
                        if (!isAlreadySelected) {
                            // Hacer clic con force: true para evitar problemas de superposición
                            await ultimoTab.click({ force: true, delay: 100 });
                            console.log('Clic en pestaña "Último" realizado');
                            
                            // Esperar a que se actualice
                            await page.waitForTimeout(3000);
                            
                            // Verificar que se seleccionó (debería tener la línea azul)
                            const isSelected = await page.$eval(ultimoTabSelector, tab => {
                                const line = tab.querySelector('.r-xoduu5');
                                return line && line.style.backgroundColor === 'rgb(16, 131, 254)';
                            });
                            
                            if (isSelected) {
                                console.log('Pestaña "Último" seleccionada correctamente');
                            } else {
                                console.log('La pestaña no se seleccionó visualmente');
                            }
                        } else {
                            console.log('Pestaña "Último" ya estaba seleccionada');
                        }
                    } else {
                        throw new Error('No se encontró pestaña por data-testid');
                    }
                    
                } catch (error) {
                    console.log('Error con método data-testid:', error.message);
                    
                    // Método 2: Buscar por texto "Último"
                    console.log('Intentando por texto "Último"...');
                    try {
                        const ultimoTabByText = await page.$('div[role="tab"]:has-text("Último"), [role="tab"]:has-text("Último")');
                        
                        if (ultimoTabByText) {
                            await ultimoTabByText.click({ force: true, delay: 100 });
                            console.log('Clic en pestaña "Último" por texto realizado');
                            await page.waitForTimeout(3000);
                        } else {
                            console.log('No se encontró pestaña con texto "Último"');
                        }
                    } catch (textError) {
                        console.log('Error con método texto:', textError.message);
                    }
                }
    
               await checkForCancellation();
    
                
                // Usar el método actualizado con selectores correctos
                posts = await this.scrapeBlueskyPosts(page, tweetsLimit,checkCancel, JobCancelledError);
    
                const duration = Math.floor((Date.now() - startTime) / 1000);
                const filePath = await this.saveResults(posts, jobData);
                
                console.log(`Scraping completado. ${posts.length} posts recolectados en ${duration} segundos`);
    
    
                await checkForCancellation();
    
                return {
                    success: true,
                    posts: posts,
                    count: posts.length,
                    duration: duration,
                    filePath: filePath
                };
    
            } catch (error) {
            // NO LOGUEAR ERRORES DE CANCELACIÓN
            const isCancellation = error instanceof JobCancelledError || 
                                  error.name === 'JobCancelledError' ||
                                  error.message.includes('Trabajo cancelado');
            
            if (!isCancellation) {
                console.error('Error en scraping:', error);
            }
            
            const duration = Math.floor((Date.now() - startTime) / 1000);
            
            // Si hay algún resultado, guardarlo igualmente
            if (posts.length > 0) {
                const filePath = await this.saveResults(posts, jobData);
                return {
                    success: false,
                    posts: posts,
                    count: posts.length,
                    duration: duration,
                    filePath: filePath,
                    error: error.message
                };
            }
            
            // Relanzar el error para que processJob lo maneje
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
        }

        async scrapeTwitterPosts(page, tweetsLimit, checkCancel, JobCancelledError) {
        let posts = [];
        let attemptsWithoutNewPosts = 0;
        const MAX_ATTEMPTS_WITHOUT_NEW_POSTS = 5;
        
        while (posts.length < tweetsLimit && attemptsWithoutNewPosts < MAX_ATTEMPTS_WITHOUT_NEW_POSTS) {
            console.log(`Recolectando posts (${posts.length}/${tweetsLimit})`);
    
            if (await checkCancel()) {
                console.log('Trabajo cancelado durante scraping de posts');
                throw new JobCancelledError('Trabajo cancelado por el usuario');
            }
            
            const rawPosts = await page.$$eval(
                'div[class="css-g5y9jx"][style="flex: 1 1 0%;"] div[role="link"][tabindex="0"]:not([data-processed])', 
                (postElements) => {
                    return postElements.map(post => {
                        try {
                            // Selector para el autor
                            const authorLink = post.querySelector('a[aria-label*="Ver perfil"]');
                            
                            // Selector para el texto 
                            const textElement = post.querySelector('[data-testid="postText"]');
                            
                            // Selector para el enlace de fecha
                            const dateLink = post.querySelector('a[href*="/post/"]');
                            const fecha = dateLink ? dateLink.getAttribute('aria-label') : '';
                            
                            // Función para métricas
                            const metrics = (testid) => {
                                const el = post.querySelector(`[data-testid="${testid}"]`);
                                return el ? (el.textContent.match(/\d+/) || ['0'])[0] : '0';
                            };
    
                            
                            let hasMediaContent = false;
                            
                            //Buscar imágenes específicas de contenido (feed_thumbnail)
                            const contentImages = post.querySelectorAll('img[src*="feed_thumbnail"][style*="transition-duration: 0ms"]');
    
                            //Buscar contenedores de media específicos
                            const mediaContainers = post.querySelectorAll('[style*="padding-top"][style*="overflow: hidden"]');
    
                            //Buscar videos
                            const contentVideos = post.querySelectorAll('video');
    
                            //Verificar que sean imágenes de contenido (no avatares)
                            for (const img of contentImages) {
                                const src = img.src || '';
                                if (src.includes('feed_thumbnail')) {
                                    hasMediaContent = true;
                                    break;
                                }
                            }
    
                            if (!hasMediaContent) {
                                hasMediaContent = mediaContainers.length > 0 || contentVideos.length > 0;
                            }
    
    
                            // Extraer handle del perfil correctamente
                            let handle = '@desconocido';
                            if (authorLink?.href) {
                                const match = authorLink.href.match(/\/profile\/([^\/]+)/);
                                handle = match ? `@${match[1]}` : `@${authorLink.href.split('/profile/')[1]}`;
                            }
    
                            return {
                                id: dateLink?.href.split('/').pop() || Math.random().toString(36).substring(2, 10),
                                text: textElement?.textContent || '',
                                author: {
                                    name: authorLink?.textContent?.replace(/[\u202A-\u202E]/g, '').trim() || '',
                                    handle: handle,
                                    verified: !!post.querySelector('[aria-label*="Verified"]')
                                },
                                timestamp: fecha, 
                                url: dateLink?.href ? `${dateLink.href}` : '',
                                metrics: {
                                    replies: metrics('replyBtn'),
                                    reposts: metrics('repostBtn'),
                                    likes: metrics('likeBtn')
                                },
                                hasMedia: hasMediaContent
                                
                            };
                        } catch (e) {
                            console.error('Error procesando post:', e);
                            return null;
                        }
                    }).filter(Boolean);
                }
            ).catch(error => {
                console.log('Error al evaluar posts:', error.message);
                return [];
            });
    
            // Formatear las fechas 
            const newPosts = rawPosts.map(post => ({
                ...post,
                timestamp: post.timestamp ? formatearFecha(post.timestamp) : ''
            }));
    
            // Marcar posts como procesados
            await page.$$eval(
                'div[class="css-g5y9jx"][style="flex: 1 1 0%;"] div[role="link"][tabindex="0"]', 
                posts => {
                    posts.forEach(p => p.setAttribute('data-processed', 'true'));
                }
            ).catch(() => {});
    
            if (newPosts.length > 0) {
                posts = [...posts, ...newPosts];
                attemptsWithoutNewPosts = 0;
                console.log(`➕ ${newPosts.length} nuevos posts | Total: ${posts.length}/${tweetsLimit}`);
                
                // Mostrar información de los primeros posts para debugging
                /* if (posts.length <= 3) {
                    posts.forEach((post, index) => {
                        console.log(`Post ${index + 1}: ${post.author.name} (${post.author.handle})`);
                        console.log(`Fecha formateada: ${post.timestamp}`);
                    });
                } */
            } else {
                attemptsWithoutNewPosts++;
                console.log(`No hay nuevos posts (intento ${attemptsWithoutNewPosts}/${MAX_ATTEMPTS_WITHOUT_NEW_POSTS})`);
            }
    
            if (await checkCancel()) {
                console.log('Trabajo cancelado antes de scroll');
                throw new JobCancelledError('Trabajo cancelado por el usuario');
            }
            await this.scrollPage(page);
            await this.humanDelay();
        }
    
        return posts;
    }
    
        async scrapeTwitter(jobData, credentials, checkCancel, JobCancelledError) {
            const { palabras, fraseExacta, hashtags, usuarioBusqueda, fechaDesde, fechaHasta, tweetsLimit = 100 } = jobData;
            const startTime = Date.now();
    
            const checkForCancellation = async () => {
            if (await checkCancel()) {
                console.log('Trabajo cancelado, deteniendo scraping...');
                throw new JobCancelledError('Trabajo cancelado por el usuario');
            }
        };
            
            let browser;
            let posts = [];
            
            try {
                // Corregir fechas si están invertidas
                let correctedFechaDesde = fechaDesde;
                let correctedFechaHasta = fechaHasta;
                
                if (fechaDesde && fechaHasta && new Date(fechaDesde) > new Date(fechaHasta)) {
                    console.log('Fechas invertidas, corrigiendo...');
                    [correctedFechaDesde, correctedFechaHasta] = [fechaHasta, fechaDesde];
                }
    
                // Construir término de búsqueda
                let terminoBusqueda = '';
                if (palabras) terminoBusqueda = palabras;
                if (fraseExacta) terminoBusqueda += ` "${fraseExacta}"`;
                if (hashtags) terminoBusqueda += ` ${hashtags.replace(/ /g, " OR ")}`;
                if (usuarioBusqueda) terminoBusqueda += ` from:${usuarioBusqueda}`;
                if (correctedFechaDesde) terminoBusqueda += ` since:${correctedFechaDesde}`;
                if (correctedFechaHasta) terminoBusqueda += ` until:${correctedFechaHasta}`;
                
                const termURI = encodeURIComponent(terminoBusqueda.trim());
                console.log('Búsqueda:', terminoBusqueda);
    
                // Configurar browser
                browser = await chromium.launch({ 
                    headless: false,
                    timeout: 60000
                });
                
                const context = await browser.newContext();
                const page = await context.newPage();
    
                await page.setExtraHTTPHeaders({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                });
                await page.setViewportSize({ width: 1280, height: 800 });
    
                console.log('Navegando a Bluesky...');
                await page.goto(`https://x.com/search?q=${termURI}&src=typed_query`, {
                    waitUntil: 'networkidle',
                    timeout: 60000
                });
    
                await checkForCancellation();
                
    
                // Iniciar sesión
                const loginSuccess = await this.loginToTwitter(page, credentials.username, credentials.password);
                if (!loginSuccess) {
                    throw new Error('Error al iniciar sesión en Bluesky');
                }
    
                await checkForCancellation();
    
                // SELECCIÓN DE PESTAÑA "ÚLTIMO" CON SELECTORES EXACTOS
                console.log("Seleccionando pestaña 'Último'...");
                
                try {
                    // Esperar a que las pestañas estén disponibles
                    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
                    
                    // Método 1: Selector exacto por data-testid
                    const ultimoTabSelector = '[role="tab"][data-testid="undefined-selector-1"]';
                    const ultimoTab = await page.$(ultimoTabSelector);
                    
                    if (ultimoTab) {
                        console.log('Pestaña "Último" encontrada por data-testid');
                        
                        // Verificar si ya está seleccionada (color azul en la línea inferior)
                        const isAlreadySelected = await page.$eval(ultimoTabSelector, tab => {
                            const line = tab.querySelector('.r-xoduu5');
                            return line && line.style.backgroundColor === 'rgb(16, 131, 254)';
                        });
                        
                        if (!isAlreadySelected) {
                            // Hacer clic con force: true para evitar problemas de superposición
                            await ultimoTab.click({ force: true, delay: 100 });
                            console.log('Clic en pestaña "Último" realizado');
                            
                            // Esperar a que se actualice
                            await page.waitForTimeout(3000);
                            
                            // Verificar que se seleccionó (debería tener la línea azul)
                            const isSelected = await page.$eval(ultimoTabSelector, tab => {
                                const line = tab.querySelector('.r-xoduu5');
                                return line && line.style.backgroundColor === 'rgb(16, 131, 254)';
                            });
                            
                            if (isSelected) {
                                console.log('Pestaña "Último" seleccionada correctamente');
                            } else {
                                console.log('⚠️ La pestaña no se seleccionó visualmente');
                            }
                        } else {
                            console.log('Pestaña "Último" ya estaba seleccionada');
                        }
                    } else {
                        throw new Error('No se encontró pestaña por data-testid');
                    }
                    
                } catch (error) {
                    console.log('Error con método data-testid:', error.message);
                    
                    // Método 2: Buscar por texto "Último"
                    console.log('Intentando por texto "Último"...');
                    try {
                        const ultimoTabByText = await page.$('div[role="tab"]:has-text("Último"), [role="tab"]:has-text("Último")');
                        
                        if (ultimoTabByText) {
                            await ultimoTabByText.click({ force: true, delay: 100 });
                            console.log('Clic en pestaña "Último" por texto realizado');
                            await page.waitForTimeout(3000);
                        } else {
                            console.log('No se encontró pestaña con texto "Último"');
                        }
                    } catch (textError) {
                        console.log('Error con método texto:', textError.message);
                    }
                }
    
               await checkForCancellation();
    
                
                // Usar el método actualizado con selectores correctos
                posts = await this.scrapeBlueskyPosts(page, tweetsLimit,checkCancel, JobCancelledError);
    
                const duration = Math.floor((Date.now() - startTime) / 1000);
                const filePath = await this.saveResults(posts, jobData);
                
                console.log(`Scraping completado. ${posts.length} posts recolectados en ${duration} segundos`);
    
    
                await checkForCancellation();
    
                return {
                    success: true,
                    posts: posts,
                    count: posts.length,
                    duration: duration,
                    filePath: filePath
                };
    
            } catch (error) {
            // NO LOGUEAR ERRORES DE CANCELACIÓN
            const isCancellation = error instanceof JobCancelledError || 
                                  error.name === 'JobCancelledError' ||
                                  error.message.includes('Trabajo cancelado');
            
            if (!isCancellation) {
                console.error('Error en scraping:', error);
            }
            
            const duration = Math.floor((Date.now() - startTime) / 1000);
            
            // Si hay algún resultado, guardarlo igualmente
            if (posts.length > 0) {
                const filePath = await this.saveResults(posts, jobData);
                return {
                    success: false,
                    posts: posts,
                    count: posts.length,
                    duration: duration,
                    filePath: filePath,
                    error: error.message
                };
            }
            
            // Relanzar el error para que processJob lo maneje
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
        }
    
        async saveResults(posts, jobData) {
        try {
            console.log('Enviando archivo al servidor...');
            const { palabras, fraseExacta, hashtags, usuarioBusqueda, fechaDesde, fechaHasta } = jobData;
            
            const parts = [];
            if (palabras) parts.push(this.processTerm(palabras));
            if (fraseExacta) parts.push(`"${this.processTerm(fraseExacta)}"`);
            if (hashtags) parts.push(`(${this.processTerm(hashtags).replace(/\s+/g, '-OR-')})`);
            if (usuarioBusqueda) parts.push(this.processTerm(usuarioBusqueda, true));
            if (fechaDesde) parts.push(fechaDesde);
            if (fechaHasta) parts.push(fechaHasta);
            
            let fileName = 'bluesky';
            if (parts.length > 0) {
                fileName += '_' + parts.join('_');
            }
            
            fileName = fileName.substring(0, 150).replace(/[^a-z0-9_.\-!()"áéíóúüñÁÉÍÓÚÜÑ]/gi, '') + '.json';
    
            // Enviar archivo al servidor
            console.log('Nombre archivo:', fileName);
            console.log('Cantidad de posts:', posts.length);
            
            const response = await fetch(`${this.apiBaseUrl}/api/worker/save-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName,
                    content: JSON.stringify(posts, null, 2),
                    platform: 'bluesky'
                })
            });
    
            console.log('Status respuesta:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error respuesta:', errorText);
                throw new Error(`Error guardando archivo en servidor: ${response.status} - ${errorText}`);
            }
    
            const result = await response.json();
            console.log('Archivo guardado en servidor:', result.filePath);
            
            return fileName;
    
        } catch (error) {
            console.error('Error al guardar archivo en servidor:', error.message);
            throw error;
        }
    }
    
        processTerm(term, isExclusion = false) {
            if (!term) return null;
            const cleaned = term.replace(/[^a-z0-9áéíóúüñÁÉÍÓÚÜÑ\s]/gi, '').trim();
            return isExclusion ? `!${cleaned.replace(/\s+/g, '-')}` : cleaned.replace(/\s+/g, '-');
        }
    
    async updateParentJobStatus(parentId) {
        try {
            // Primero verificar si es un trabajo recurrente
            const parentInfo = await this.getJobInfo(parentId);
    
    
            const isRecurrent = parentInfo?.es_recurrente || false;
            const recurrenteHasta = parentInfo?.recurrente_hasta || null;
    
            // Obtener estado de todos los hijos
            const childrenStatus = await this.getChildrenStatus(parentId);
    
    
            const statusCounts = {
                completed: 0,
                failed: 0,
                cancelled: 0,
                waiting: 0,
                processing: 0
            };
    
            childrenStatus.forEach(row => {
                statusCounts[row.status] = parseInt(row.count);
            });
    
            const totalChildren = Object.values(statusCounts).reduce((a, b) => a + b, 0);
            
            // VERIFICAR SI HAY HIJOS - si no hay, mantener el estado actual
            if (totalChildren === 0) {
                console.log(`Trabajo padre ${parentId} no tiene hijos, manteniendo estado actual`);
                return;
            }
    
            const completedChildren = statusCounts.completed;
            const failedChildren = statusCounts.failed;
            const cancelledChildren = statusCounts.cancelled;
            const activeChildren = statusCounts.waiting + statusCounts.processing;
    
            let parentStatus = 'processing';
            
            // LÓGICA DIFERENTE PARA TRABAJOS RECURRENTES
            if (isRecurrent) {
                // Para trabajos recurrentes, NUNCA marcar como completed hasta la fecha límite
                const hoy = new Date().toISOString().split('T')[0];
                
                if (hoy > recurrenteHasta) {
                    // Fecha límite pasada - marcar como completed
                    parentStatus = 'completed';
                    console.log(`Trabajo recurrente ${parentId} completado (límite: ${recurrenteHasta})`);
                } else if (activeChildren > 0) {
                    // Todavía hay hijos activos
                    parentStatus = 'programado';
                } else if (failedChildren > 0 || cancelledChildren > 0) {
                    // Algunos hijos fallaron/cancelaron pero todavía no es la fecha límite
                    parentStatus = 'partial_failure';
                } else {
                    // Todos los hijos existentes completados pero todavía no es la fecha límite
                    parentStatus = 'programado'; // Mantener como processing para crear más hijos mañana
                }
            } else {
                // LÓGICA ORIGINAL para trabajos NO recurrentes
                if (activeChildren > 0) {
                    parentStatus = 'processing';
                } else if (completedChildren === totalChildren) {
                    parentStatus = 'completed';
                } else if (cancelledChildren === totalChildren) {
                    parentStatus = 'cancelled';
                } else if (failedChildren === totalChildren) {
                    parentStatus = 'failed';
                } else if (completedChildren > 0 && (failedChildren > 0 || cancelledChildren > 0)) {
                    parentStatus = 'partial_failure';
                } else if (failedChildren > 0 || cancelledChildren > 0) {
                    parentStatus = 'failed';
                }
            }
    
            console.log(`Actualizando estado padre ${parentId}: ${parentStatus} ` +
                    `(recurrente: ${isRecurrent}, completados: ${completedChildren}, fallidos: ${failedChildren}, ` +
                    `cancelados: ${cancelledChildren}, activos: ${activeChildren}, total: ${totalChildren})`);
    
            // SOLUCIÓN AL ERROR: Separar la lógica del completed_at
            let updateQuery;
            let queryParams;
    
            if (['completed', 'cancelled', 'failed', 'partial_failure'].includes(parentStatus)) {
                updateQuery = `
                    UPDATE trabajo 
                    SET status = $1, 
                        completed_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING status
                `;
                queryParams = [parentStatus, parentId];
            } else {
                updateQuery = `
                    UPDATE trabajo 
                    SET status = $1
                    WHERE id = $2
                    RETURNING status
                `;
                queryParams = [parentStatus, parentId];
            }
    
            await this.executeUpdateQuery(updateQuery, queryParams);
    
            console.log(`Estado padre ${parentId} actualizado a: ${parentStatus}`);
    
    
        } catch (error) {
            console.error('Error actualizando estado del trabajo padre:', error);
        }
    }
    
    
    
    
    
    // Nueva función para verificar cancelación
    async checkCancellation(jobId) {
        try {
            const redisClient = redis.getClient();
            const cancelled = await redisClient.get(`cancel:${jobId}`);
            return cancelled === 'true';
        } catch (error) {
            console.error('Error verificando cancelación:', error);
            return false;
        }
    }

    async processJob(job) {
        const jobData = job.data;
        const platform = jobData.platform; // 'bluesky' o 'twitter'
        
        let credentials;
        let trabajoId;
        let isCancelled = false;

        try {
            console.log(`Procesando job ${job.id} para ${platform}:`, jobData);

            // Verificar cancelación al inicio
            isCancelled = await this.checkCancellation(job.id);
            if (isCancelled) {
                throw new this.JobCancelledError('Trabajo cancelado por el usuario');
            }

            // Obtener credenciales según la plataforma
            if (platform === 'bluesky') {
                credentials = await this.getBlueskyCredentials();
            } else if (platform === 'twitter') {
                credentials = await this.getTwitterCredentials();
            } else {
                throw new Error(`Plataforma no soportada: ${platform}`);
            }
            
            console.log(`Usando cuenta ${platform}: ${credentials.username}`);
            
            // Guardar el trabajo con el id de la cuenta
            const trabajoExistente = await this.getJobByBullmqId(job.id);
            if (!trabajoExistente) {
                throw new Error(`No se encontró trabajo en DB para bullmq_id: ${job.id}`);
            }
            
            trabajoId = trabajoExistente.id;

            // ACTUALIZAR el trabajo existente
            await this.updateJobStatusDirect(trabajoId, {
                status: 'processing',
                cuenta_id: credentials.id,
                started_at: new Date().toISOString()
            });

            const checkCancel = async () => await this.checkCancellation(job.id);
            
            // Ejecutar el scraping según la plataforma
            let result;
            if (platform === 'bluesky') {
                result = await this.scrapeBluesky(
                    jobData, 
                    credentials, 
                    checkCancel, 
                    this.JobCancelledError
                );
            } else if (platform === 'twitter') {
                result = await this.scrapeTwitter(
                    jobData, 
                    credentials, 
                    checkCancel, 
                    this.JobCancelledError
                );
            }
            
            if (await checkCancel()) {
                throw new this.JobCancelledError('Trabajo cancelado durante la ejecución');
            }

            await this.recordAccountUsage(
                credentials.id, 
                trabajoId, 
                true, 
                result.posts.length, 
                null, 
                result.duration
            );

            // ACTUALIZAR resultado del trabajo
            await this.updateJobStatusDirect(trabajoId, {
                status: 'completed',
                result_count: result.posts.length,
                file_path: result.filePath
            });

            // Actualizar estado del trabajo padre si existe
            const parentCheck = await this.getJobParent(trabajoId);
            if (parentCheck?.trabajo_padre_id) {
                await this.updateParentJobStatus(parentCheck.trabajo_padre_id);
                
                setTimeout(async () => {
                    try {
                        await this.updateParentJobStatus(parentCheck.trabajo_padre_id);
                    } catch (e) {
                        console.error('Error en verificación secundaria:', e);
                    }
                }, 2000);
            }

            return result;

        } catch (error) {
            // Manejo de errores...
            if (trabajoId) {
                await this.updateJobStatusDirect(trabajoId, {
                    status: 'failed'
                });
            }

            if (credentials && trabajoId) {
                await this.recordAccountUsage(
                    credentials.id, 
                    trabajoId, 
                    false, 
                    0, 
                    error.message, 
                    Math.floor((Date.now() - job.timestamp) / 1000)
                );
            }

            // Actualizar estado del padre incluso en error
            if (trabajoId) {
                const parentCheck = await this.getJobParent(trabajoId);
                if (parentCheck?.trabajo_padre_id) {
                    await this.updateParentJobStatus(parentCheck.trabajo_padre_id);
                }
            }

            throw error;
        }
    }
}



// Inicializar worker
console.log('Iniciando worker...');
try {
    const worker = new SocialMediaWorker();
    console.log('Worker listo. Esperando jobs...');
    console.log('-------------------------------------------');
} catch (error) {
    console.error('Error al iniciar worker de Bluesky:', error);
    process.exit(1);
}

module.exports = SocialMediaWorker;