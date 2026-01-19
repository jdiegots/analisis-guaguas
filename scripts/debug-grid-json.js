const fs = require('fs');
const GRID_FILE = 'C:\\dev\\guaguas\\data\\grid_population_dots.json';

const rawData = fs.readFileSync(GRID_FILE, 'utf8');
const geojson = JSON.parse(rawData);

console.log('Feature count:', geojson.features.length);
if (geojson.features.length > 0) {
    console.log('First feature properties:', geojson.features[0].properties);
}
