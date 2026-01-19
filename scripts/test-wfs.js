const fetch = require('node-fetch');

async function checkWFS() {
    // URLs potenciales para WFS de Grafcan
    const potentialUrls = [
        // WFS Estandar probable
        'https://idecan2.grafcan.es/ServicioWFS/EstablecimientosTuristicos?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities',
        // Otra variante comun
        'https://idecan2.grafcan.es/ServicioWFS/EstablecimientosTuristicos?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetCapabilities',
        // Intento de descarga directa de 1 feature para verificar acceso a datos
        'https://idecan2.grafcan.es/ServicioWFS/EstablecimientosTuristicos?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=ALOJATIVOS_HOTELERO&COUNT=1&OUTPUTFORMAT=json',
    ];

    console.log('🔍 Probando acceso a WFS de Establecimientos Turísticos de GRAFCAN...\n');

    for (const url of potentialUrls) {
        try {
            console.log(`Petición: ${url}`);
            const response = await fetch(url);

            console.log(`Status: ${response.status} ${response.statusText}`);

            if (response.ok) {
                const text = await response.text();
                const preview = text.substring(0, 200).replace(/\s+/g, ' ');
                console.log(`✅ Respuesta recibida (Preview): ${preview}`);

                if (text.includes('FeatureCollection') || text.includes('WFS_Capabilities')) {
                    console.log('🚀 ÉXITO: El servicio parece responder datos estructurados.');
                } else {
                    console.log('⚠️ AVISO: La respuesta no parece ser un GeoJSON o XML de capacidades estándar.');
                }
            } else {
                console.log('❌ Error en la petición.');
            }
            console.log('---');
        } catch (error) {
            console.error(`❌ Error de red: ${error.message}`);
            console.log('---');
        }
    }
}

checkWFS();
