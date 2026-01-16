import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'population'; // population, ppar, pact

        let filename = 'grid_population_dots.json';
        if (type === 'ppar') filename = 'grid_labor_ppar_dots.json';
        if (type === 'pact') filename = 'grid_labor_pact_dots.json';

        // Path to the GeoJSON file
        const jsonPath = path.join(process.cwd(), 'data', filename);

        // Read the file from disk
        const fileContents = await fs.readFile(jsonPath, 'utf8');
        const geojson = JSON.parse(fileContents);

        // Return the JSON directly
        return NextResponse.json(geojson);
    } catch (error) {
        console.error('Error serving grid data:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
