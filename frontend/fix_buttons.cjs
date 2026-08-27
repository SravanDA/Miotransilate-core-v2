const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    let lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.includes('<button') || line.includes('bg-primary') || line.includes('bg-surface hover:bg-surface-hover') || line.includes('border-border-main')) {
            
            // Except don't modify if it's a card or main layout container
            if (line.includes('flex flex-col') || line.includes('min-h-screen')) continue;
            
            let originalLine = line;
            
            // Standardize font weight to font-bold
            line = line.replace(/font-medium/g, 'font-bold');
            line = line.replace(/font-semibold/g, 'font-bold');
            
            // Standardize border radius to rounded
            line = line.replace(/rounded-lg/g, 'rounded');
            line = line.replace(/rounded-md/g, 'rounded');
            line = line.replace(/rounded-xl/g, 'rounded');
            line = line.replace(/rounded-2xl/g, 'rounded');
            
            if (line !== originalLine) {
                lines[i] = line;
                modified = true;
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(file, lines.join('\n'));
        console.log('Modified', file);
    }
});
