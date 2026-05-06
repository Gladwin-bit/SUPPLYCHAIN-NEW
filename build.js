const { execSync } = require('child_process');
const fs = require('fs');

console.log('Starting custom build script...');
execSync('cd frontend && npm install --legacy-peer-deps', { stdio: 'inherit' });
execSync('cd frontend && set CI=false&& set GENERATE_SOURCEMAP=false&& npm run build', { stdio: 'inherit' });

console.log('Copying build output to root...');
if (fs.existsSync('build')) {
  fs.rmSync('build', { recursive: true, force: true });
}
if (fs.existsSync('public')) {
  fs.rmSync('public', { recursive: true, force: true });
}

fs.cpSync('frontend/build', 'build', { recursive: true });
fs.cpSync('frontend/build', 'public', { recursive: true });
console.log('Build output copied successfully.');
