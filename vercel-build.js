const { execSync } = require('child_process');
const fs = require('fs');

console.log('Starting custom build script...');

try {
  // Set environment variables for the build
  process.env.CI = 'false';
  process.env.GENERATE_SOURCEMAP = 'false';

  console.log('Installing frontend dependencies...');
  execSync('cd frontend && npm install --legacy-peer-deps', { stdio: 'inherit' });

  console.log('Building frontend...');
  execSync('cd frontend && npm run build', { stdio: 'inherit' });

  console.log('Copying build output to root...');
  
  // Clean up any existing directories
  if (fs.existsSync('build')) {
    fs.rmSync('build', { recursive: true, force: true });
  }
  if (fs.existsSync('public')) {
    fs.rmSync('public', { recursive: true, force: true });
  }

  // Copy to both build and public to satisfy any Vercel configuration
  fs.cpSync('frontend/build', 'build', { recursive: true });
  fs.cpSync('frontend/build', 'public', { recursive: true });
  
  console.log('Build output copied successfully to both /build and /public.');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
