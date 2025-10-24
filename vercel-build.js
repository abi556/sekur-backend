const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building NestJS application...');

try {
  // Run the build command
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
