// Check if PostGIS is installed
require('dotenv').config();
const { db } = require('./db-config');

async function checkPostGIS() {
  try {
    const result = await db.oneOrNone(`
      SELECT installed_version
      FROM pg_available_extensions
      WHERE name = 'postgis'
    `);

    if (!result) {
      console.log('❌ PostGIS no está disponible en este PostgreSQL');
      console.log('\n📥 INSTRUCCIONES PARA INSTALAR POSTGIS:');
      console.log('1. Ejecuta el instalador descargado: C:\\dev\\postgis-installer.exe');
      console.log('2. Sigue el asistente de instalación');
      console.log('3. Selecciona tu instalación de PostgreSQL 18');
      console.log('4. Una vez instalado, vuelve a ejecutar este script\n');
      process.exit(1);
    }

    console.log(`✅ PostGIS está disponible (versión: ${result.installed_version || 'disponible'})`);

    // Try to enable it
    try {
      await db.none('CREATE EXTENSION IF NOT EXISTS postgis');
      const version = await db.one('SELECT PostGIS_Full_Version() as version');
      console.log(`✅ PostGIS habilitado correctamente`);
      console.log(`   ${version.version.split(';')[0]}`);
      return true;
    } catch (err) {
      console.log('⚠️  PostGIS está disponible pero no se pudo habilitar');
      console.log('   Error:', err.message);
      return false;
    }

  } catch (error) {
    console.error('❌ Error verificando PostGIS:', error.message);
    process.exit(1);
  } finally {
    await db.$pool.end();
  }
}

checkPostGIS();
