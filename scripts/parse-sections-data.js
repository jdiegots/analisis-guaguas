const fs = require('fs');
const path = require('path');

// Read the truncated JSON file and manually parse valid entries
const rawData = fs.readFileSync('C:/Users/jdieg/.claude/projects/C--dev-guaguas/deb6970a-c384-436b-aa6d-1825647ca6a7/tool-results/toolu_018VmUE4kR3hTn7d2N7fXrCb.txt', 'utf-8');

// Find all complete JSON objects using regex
const objectPattern = /\{"section_code".*?\}/g;
const matches = rawData.match(objectPattern);

if (matches) {
  const sections = matches.map(match => JSON.parse(match));
  console.log(`Parsed ${sections.length} sections`);

  // Filter to only include sections with service_value_index > 0
  const validSections = sections.filter(s => s.service_value_index > 0);
  console.log(`${validSections.length} sections with service_value_index > 0`);

  fs.writeFileSync('scripts/sections_data.json', JSON.stringify(validSections, null, 2));
  console.log('Wrote to scripts/sections_data.json');
} else {
  console.log('No matches found');
}
