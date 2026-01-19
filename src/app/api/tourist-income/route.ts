import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'tourist-analysis.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading tourist analysis data:', error);
    return NextResponse.json(
      { error: 'Failed to load tourist income data' },
      { status: 500 }
    );
  }
}
