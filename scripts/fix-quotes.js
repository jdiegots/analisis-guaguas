const fs = require('fs');

const filePath = 'C:\\dev\\guaguas\\src\\app\\analisis-tarifas\\page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace curly quotes with straight quotes
content = content.replace(/[""]/g, '"');
content = content.replace(/['']/g, "'");

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Fixed quotes in page.tsx');
