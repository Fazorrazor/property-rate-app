const fs = require('fs');
const path = require('path');

const directories = [
  'src/app/(main)/dashboard',
  'src/app/(main)/properties',
  'src/app/(main)/receipts',
  'src/app/checkout',
  'src/app'
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const replacements = [
    // Backgrounds
    [/bg-\[#F6ECF2\]/g, 'bg-background'],
    [/bg-\[#F8F9FA\]/g, 'bg-surface-subtle'],
    [/bg-\[#F3F4F4\]/g, 'bg-surface-subtle'],
    [/bg-white/g, 'bg-surface'],
    
    // Borders
    [/border-\[#DADCE0\]/g, 'border-border-light'],
    [/border-\[#E8EAED\]/g, 'border-border-light'],
    [/border-\[#F1F3F4\]/g, 'border-border-light'],
    
    // Text colors
    [/text-\[#2C2C2C\]/g, 'text-foreground'],
    [/text-\[#717171\]/g, 'text-on-surface-muted'],
    [/text-\[#3C4043\]/g, 'text-on-surface-muted'],
    [/text-\[#80868B\]/g, 'text-on-surface-subtle'],
    [/text-\[#612D53\]/g, 'text-foreground'], // Make brand text neutral for dark mode readability
    
    // Other specifics
    [/bg-rough/g, 'bg-surface'],
  ];

  let newContent = content;
  for (const [regex, replacement] of replacements) {
    newContent = newContent.replace(regex, replacement);
  }

  // Ensure Pay Total high-contrast button in dashboard wasn't broken
  // We already replaced bg-white, so we need to restore the dark header logic if it was touched.
  // Wait, I specifically set the new dashboard header to use: `bg-white text-[#111111]`.
  // The regex replaced `bg-white` with `bg-surface`.
  // Let's manually fix the button in checkout and dashboard if it got hit.
  
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
      if (file !== 'login' && file !== 'layout') {
        // we can walk deeper if needed, but the structure is flat
      }
    } else if (fullPath.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

for (const dir of directories) {
  walkDir(dir);
}
