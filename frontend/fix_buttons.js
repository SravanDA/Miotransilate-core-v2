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
    
    // We will do a line-by-line replacement to be safe, only touching lines that have 'button' or 'bg-primary' etc
    // Actually, it's safer to just replace specific button utility classes if they are in a string that looks like a button class.
    
    // Let's replace 'rounded-lg' with 'rounded', 'font-medium' with 'font-bold', 'font-semibold' with 'font-bold'
    // ONLY on lines containing '<button' or lines containing 'bg-primary' (since some are split across lines or are links styled as buttons)
    
    let lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.includes('<button') || line.includes('bg-primary') || line.includes('bg-surface hover:bg-surface-hover') || line.includes('border-border-main')) {
            // It's likely a button line
            
            // Except don't modify if it's a card or main layout container
            if (line.includes('flex flex-col') || line.includes('min-h-screen')) continue;
            
            let originalLine = line;
            
            // Standardize font weight to font-bold
            line = line.replace(/font-medium/g, 'font-bold');
            line = line.replace(/font-semibold/g, 'font-bold');
            
            // Standardize border radius to rounded (which is 4px)
            line = line.replace(/rounded-lg/g, 'rounded');
            line = line.replace(/rounded-md/g, 'rounded');
            line = line.replace(/rounded-xl/g, 'rounded');
            line = line.replace(/rounded-2xl/g, 'rounded');
            line = line.replace(/rounded-full/g, 'rounded');
            
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
