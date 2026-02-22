// scripts/run-cleanup.js
const cleanupService = require('./limpiezaArchivos');

async function main() {
    console.log('Iniciando limpieza manual...');
    await cleanupService.runFullCleanup();
    console.log('Limpieza manual completada');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = main;