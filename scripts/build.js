const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const sourceDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(sourceDir)) {
  throw new Error('Missing public directory.');
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
fs.cpSync(sourceDir, distDir, { recursive: true });

const headersSource = path.join(rootDir, '_headers');
if (fs.existsSync(headersSource)) {
  fs.copyFileSync(headersSource, path.join(distDir, '_headers'));
}

const requiredFiles = [
  'index.html',
  'app.js',
  'catalog-analyzer.js',
  'styles.css',
  'icon.svg'
];

for (const fileName of requiredFiles) {
  const targetPath = path.join(distDir, fileName);
  if (!fs.existsSync(targetPath)) {
    throw new Error('Build output is missing ' + fileName + '.');
  }
}

console.log('Build complete: dist/');