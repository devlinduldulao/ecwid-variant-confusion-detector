const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = [
  'public/catalog-analyzer.js',
  'public/app.js',
  'tests/catalog-analyzer.test.js',
  'tests/app.test.js',
  'scripts/lint.js',
  'scripts/smoke-test.js'
];

for (const relativePath of files) {
  const absolutePath = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  new vm.Script(source, { filename: relativePath });
}

const html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');

if (!html.includes('./catalog-analyzer.js') || !html.includes('./app.js') || !html.includes('./styles.css')) {
  throw new Error('public/index.html is missing one or more required local assets.');
}

if (!html.includes('./icon.svg')) {
  throw new Error('public/index.html is missing the local icon asset.');
}

console.log('Lint checks passed.');