const { app, BrowserWindow } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Importante para desarrollo local
    },
    show: false, // Evita parpadeo inicial
    icon: path.join(__dirname, '..', 'public', getIconFilename()), // ← Subir un nivel

  })

  // URL para desarrollo y producción
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`

  // Intenta cargar con reintentos
  const tryLoad = (attempts = 0) => {
    mainWindow.loadURL(startUrl).catch(e => {
      if (attempts < 5) {
        console.log(`Reintento ${attempts + 1}...`)
        setTimeout(() => tryLoad(attempts + 1), 2000)
      } else {
        console.error('Error al cargar:', e)
        mainWindow.loadFile(path.join(__dirname, 'fallback.html'))
      }
    })
  }

  tryLoad()

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools()
    }
  })
}

function getIconFilename() {
  switch (process.platform) {
    case 'win32':
      return 'iconoApp.ico';
    case 'darwin':
      return 'iconoApp.icns';
    case 'linux':
      return 'iconoApp.png';
    default:
      return 'iconoApp.png';
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})