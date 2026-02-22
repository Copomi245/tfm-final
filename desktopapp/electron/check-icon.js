// check-icon.js
const path = require('path');
const fs = require('fs');

console.log('🔍 Diagnóstico de iconos...');
console.log('Plataforma:', process.platform);

const publicPath = path.join(__dirname, '..', 'public');
console.log('Ruta public:', publicPath);

// Verificar si existe la carpeta public
if (!fs.existsSync(publicPath)) {
  console.log('❌ Carpeta public no existe');
  process.exit(1);
}

// Listar archivos de icono
const files = fs.readdirSync(publicPath);
const iconFiles = files.filter(f => 
  f.includes('icon') || 
  f.endsWith('.ico') || 
  f.endsWith('.icns') || 
  f.endsWith('.png')
);

console.log('📁 Archivos icono encontrados:', iconFiles);

// Verificar rutas específicas
const testPaths = {
  win32: path.join(publicPath, 'iconoApp.ico'),
  darwin: path.join(publicPath, 'iconoApp.icns'),
  linux: path.join(publicPath, 'iconoApp.png')
};

Object.entries(testPaths).forEach(([platform, filePath]) => {
  console.log(`${platform}: ${filePath} - ${fs.existsSync(filePath) ? '✅' : '❌'}`);
});

// Ejecuta con: node check-icon.js