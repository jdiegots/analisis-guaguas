require('dotenv').config();
const { db } = require('./db-config');

async function main() {
  console.log('📊 Importing fare data...\n');

  try {
    // Create fares table
    console.log('Creating fares table...');
    await db.none(`
      CREATE TABLE IF NOT EXISTS fares (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        price_euros DOUBLE PRECISION,
        trips_included INTEGER,
        validity_days INTEGER,
        cost_per_trip DOUBLE PRECISION,
        requirements TEXT,
        target_group VARCHAR(100),
        is_social_fare BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Table created\n');

    // Clear existing data
    await db.none('DELETE FROM fares');

    // Insert fare data
    console.log('Inserting fare data...');
    const fares = [
      // Regular fares
      {
        name: 'Pago directo',
        type: 'single',
        price: 1.40,
        trips: 1,
        validity: 0,
        requirements: 'Ninguno',
        target: 'general',
        social: false
      },
      {
        name: 'Bono-2 sin contacto',
        type: 'multi',
        price: 2.40,
        trips: 2,
        validity: 30,
        requirements: 'Ninguno',
        target: 'general',
        social: false
      },
      {
        name: 'Bono Guagua sin contacto',
        type: 'rechargeable',
        price: 0.42,
        trips: 1,
        validity: 365,
        requirements: 'Recarga mínima 8.50€',
        target: 'general',
        social: false
      },
      {
        name: 'Bono Compartido',
        type: 'rechargeable',
        price: 8.50,
        trips: 20,
        validity: 90,
        requirements: 'Recarga mínima 8.50€',
        target: 'general',
        social: false
      },

      // Student fares
      {
        name: 'Bono Estudiante',
        type: 'student',
        price: 14.00,
        trips: 80,
        validity: 30,
        requirements: 'Menor de 26 años (al 1 enero curso), matriculado en centro oficial',
        target: 'students',
        social: true
      },
      {
        name: 'Bono Estudiante Compartido',
        type: 'student',
        price: 14.00,
        trips: 80,
        validity: 30,
        requirements: 'Menor de 26 años (al 1 enero curso), matriculado en centro oficial',
        target: 'students',
        social: true
      },

      // Elderly fares
      {
        name: 'Bono Jubilado',
        type: 'elderly',
        price: 0.00,
        trips: 100,
        validity: 30,
        requirements: 'Jubilado o 65+ años, renta familiar max 1,256.60€/mes (17,592.40€/año)',
        target: 'elderly',
        social: true
      },
      {
        name: 'Bono Jubilado Compartido',
        type: 'elderly',
        price: 0.00,
        trips: 100,
        validity: 30,
        requirements: 'Jubilado o 65+ años, renta familiar max 1,256.60€/mes (17,592.40€/año)',
        target: 'elderly',
        social: true
      },

      // Large family fares
      {
        name: 'Bono Familia Numerosa General',
        type: 'family',
        price: 10.00,
        trips: 72,
        validity: 90,
        requirements: 'Miembro de familia numerosa',
        target: 'families',
        social: true
      },
      {
        name: 'Bono Familia Numerosa General Compartido',
        type: 'family',
        price: 10.00,
        trips: 72,
        validity: 90,
        requirements: 'Miembro de familia numerosa',
        target: 'families',
        social: true
      },
      {
        name: 'Bono Familia Numerosa Especial',
        type: 'family',
        price: 10.00,
        trips: 94,
        validity: 90,
        requirements: 'Miembro de familia numerosa especial',
        target: 'families',
        social: true
      },
      {
        name: 'Bono Familia Numerosa Especial Compartido',
        type: 'family',
        price: 10.00,
        trips: 94,
        validity: 90,
        requirements: 'Miembro de familia numerosa especial',
        target: 'families',
        social: true
      },

      // Unemployment fare
      {
        name: 'Bono Solidario',
        type: 'unemployment',
        price: 5.00,
        trips: 40,
        validity: 30,
        requirements: 'Desempleado inscrito SCE 6+ meses ininterrumpidos',
        target: 'unemployed',
        social: true
      },
      {
        name: 'Bono Solidario Compartido',
        type: 'unemployment',
        price: 5.00,
        trips: 40,
        validity: 30,
        requirements: 'Desempleado inscrito SCE 6+ meses ininterrumpidos',
        target: 'unemployed',
        social: true
      },

      // Tourist fares
      {
        name: 'Tarjeta Turística 1 Día',
        type: 'tourist',
        price: 5.00,
        trips: 999,
        validity: 1,
        requirements: 'Ninguno',
        target: 'tourists',
        social: false
      },
      {
        name: 'Tarjeta Turística 3 Días',
        type: 'tourist',
        price: 12.00,
        trips: 999,
        validity: 3,
        requirements: 'Ninguno',
        target: 'tourists',
        social: false
      },

      // Unlimited fares
      {
        name: 'Tarjeta Wawa Joven',
        type: 'unlimited',
        price: 10.00,
        trips: 999,
        validity: 90,
        requirements: 'Menor de 28 años. Gratis si se hacen 30+ viajes en 90 días',
        target: 'youth',
        social: true
      },
      {
        name: 'Bono Residente Canario',
        type: 'unlimited',
        price: 14.00,
        trips: 999,
        validity: 90,
        requirements: 'Residente Canarias. Gratis si se hacen 30+ viajes en 90 días',
        target: 'residents',
        social: true
      },
      {
        name: 'Bono Oro',
        type: 'unlimited',
        price: 10.00,
        trips: 999,
        validity: 90,
        requirements: '65+ años o pensionista o renta familiar <14,000€/año. Gratis si se hacen 30+ viajes en 90 días',
        target: 'elderly_low_income',
        social: true
      },
    ];

    for (const fare of fares) {
      const costPerTrip = fare.trips > 100 ? null : (fare.price / fare.trips);

      await db.none(`
        INSERT INTO fares (name, type, price_euros, trips_included, validity_days, cost_per_trip, requirements, target_group, is_social_fare)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        fare.name,
        fare.type,
        fare.price,
        fare.trips,
        fare.validity,
        costPerTrip,
        fare.requirements,
        fare.target,
        fare.social
      ]);
    }

    const count = await db.one('SELECT COUNT(*) as count FROM fares');
    console.log(`✓ Imported ${count.count} fares\n`);

    // Show summary
    console.log('📋 Fare summary by target group:');
    const summary = await db.any(`
      SELECT
        target_group,
        COUNT(*) as fare_count,
        AVG(cost_per_trip) as avg_cost_per_trip,
        MIN(price_euros) as min_price,
        MAX(price_euros) as max_price
      FROM fares
      WHERE cost_per_trip IS NOT NULL
      GROUP BY target_group
      ORDER BY avg_cost_per_trip
    `);

    summary.forEach(s => {
      console.log(`  ${s.target_group}: ${s.fare_count} options, €${(s.avg_cost_per_trip || 0).toFixed(3)}/trip avg`);
    });

    console.log('\n✅ Fare data imported successfully!');

  } catch (error) {
    console.error('Error importing fares:', error);
    throw error;
  } finally {
    await db.$pool.end();
  }
}

main().catch(console.error);
