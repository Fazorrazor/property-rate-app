const fs = require('fs');
const path = require('path');

const files = [
  'src/app/actions.ts',
  'property-rate-admin/src/app/actions.ts'
];

for (const file of files) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace ${variable.toFixed(2)} with ${variable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    content = content.replace(/\$\{([^}]+)\.toFixed\(2\)\}/g, (match, p1) => {
      return `\${${p1}.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
