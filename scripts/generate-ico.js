const png2icons = require('png2icons');
const fs = require('fs');
const path = require('path');

const input = path.join(__dirname, '../resources/circle-logo-1024.png');
const output = path.join(__dirname, '../build/icon.ico');

const inputBuffer = fs.readFileSync(input);

// Generate ICO with multiple sizes: 16, 32, 48, 64, 128, 256
const icoBuffer = png2icons.createICO(inputBuffer, png2icons.BICUBIC, 0, false, true);

fs.writeFileSync(output, icoBuffer);
console.log('✓ Generated icon.ico successfully');
