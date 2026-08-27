const fs = require('fs');
const path = require('path');

const mappings = {
  '\\[#F5F6F7\\]': 'app',
  '\\[#FAFBFC\\]': 'surface-hover',
  '\\[#EBECF0\\]': 'surface-active',
  '\\[#172b4d\\]': 'main',
  '\\[#42526E\\]': 'muted',
  '\\[#5E6C84\\]': 'muted',
  '\\[#6B778C\\]': 'subtle',
  '\\[#DFE1E6\\]': 'main',
  '\\[#0052CC\\]': 'primary',
  '\\[#0065FF\\]': 'primary-hover',
  '\\[#4C9AFF\\]': 'primary-light',
  '\\[#DE350B\\]': 'danger',
  '\\[#006644\\]': 'success',
  '\\[#FF8B00\\]': 'warning',
  'bg-white': 'bg-surface'
};

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
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
  let changed = false;
  
  for (const [hex, semantic] of Object.entries(mappings)) {
    // Regex to match prefix-[HEX] or bg-white
    const regex = new RegExp(`([a-z-]+)-${hex}`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `$1-${semantic}`);
      changed = true;
    }
    if (hex === 'bg-white' && content.includes('bg-white')) {
      content = content.replace(/bg-white/g, 'bg-surface');
      changed = true;
    }
  }
  
  // also fix cases like border-[#DFE1E6] which becomes border-main, but wait: text-[#172b4d] -> text-main.
  // The mapping is [a-z-]+-${hex} -> $1-${semantic}. So text-[#172b4d] -> text-main. bg-[#0052CC] -> bg-primary. 
  // Let's do it carefully.
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
