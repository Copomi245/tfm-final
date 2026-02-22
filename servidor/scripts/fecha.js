 function formatearFecha(fechaString) {
    
    const meses = {
        'enero': 'January',
        'febrero': 'February',
        'marzo': 'March',
        'abril': 'April',
        'mayo': 'May',
        'junio': 'June',
        'julio': 'July',
        'agosto': 'August',
        'septiembre': 'September',
        'octubre': 'October',
        'noviembre': 'November',
        'diciembre': 'December'
    };

    // Dividir la fecha en partes
    const partes = fechaString.split(' ');
    const dia = partes[0];
    const mesEspanol = partes[2].toLowerCase(); 
    const anio = partes[4].replace(',', '');
    const horaCompleta = partes[5];
    
    
    // Convertir mes español a inglés
    const mesIngles = meses[mesEspanol];
    
    // Formatear día con ceros a la izquierda
    const diaFormateado = dia.padStart(2, '0');
    
    // Formatear hora 
    const [hora, minutos] = horaCompleta.split(':');
    const horaFormateada = hora.padStart(2, '0');
    
    const fecha = new Date(`${diaFormateado} ${mesIngles} ${anio} ${horaFormateada}:${minutos} UTC`).toISOString()
    
    return fecha;
}

module.exports = formatearFecha;
