const fs = require('fs');
const path = require('path');

const srcStatic = path.join(__dirname, '..', '.next', 'static');
const destStatic = path.join(__dirname, '..', '.next', 'server', 'app', '_next', 'static');

if (!fs.existsSync(destStatic)) {
  fs.mkdirSync(destStatic, { recursive: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(srcStatic, destStatic);
console.log('Static files copied successfully!');