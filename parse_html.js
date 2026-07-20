const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Find sections with id starting with jhome
const sectionRegex = /<section\s+id="([^"]+)"\s+class="section-content"[^>]*>/g;
let match;
console.log("Jhome Sections in index.html:");
while ((match = sectionRegex.exec(html)) !== null) {
  if (match[1].startsWith('jhome')) {
    console.log("- " + match[1]);
  }
}
