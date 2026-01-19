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

        const dataDirectories = [
            path.join(process.cwd(), 'data'),
            path.join(process.cwd(), 'public', 'data'),
        ];

        let jsonPath: string | null = null;
        for (const directory of dataDirectories) {
            const candidatePath = path.join(directory, filename);
            try {
                await fs.access(candidatePath);
                jsonPath = candidatePath;
                break;
            } catch {
                continue;
            }
        }

        if (!jsonPath) {
            return NextResponse.json(
                { error: 'Grid data file not found', filename },
                { status: 404 }
            );
        }

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
