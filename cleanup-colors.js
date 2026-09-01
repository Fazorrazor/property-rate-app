const fs = require('fs');
const path = require('path');

const directories = [
  'src/app'
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const replacements = [
    [/CC3A63/gi, '4B1426'], // Old primary to Deep Burgundy
    [/A82C4D/gi, '558467'], // Old primary-hover to Muted Green
    [/FFF7EB/gi, 'EFEABB'], // Old main bg to Pale Cream
    [/F9F0E0/gi, 'E3DDAA'], // Old subtle bg to Darker Pale Cream
    [/2C2C2C/gi, '17433F']  // Old foreground text to Deep Teal
  ];

  let newContent = content;
  for (const [regex, replacement] of replacements) {
    newContent = newContent.replace(regex, replacement);
  }
  
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const absoluteDir = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(absoluteDir)) return;
  const files = fs.readdirSync(absoluteDir);
  for (const file of files) {
    const fullPath = path.join(absoluteDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.css')) {
      processFile(fullPath);
    }
  }
}

for (const dir of directories) {
  walkDir(dir);
}
