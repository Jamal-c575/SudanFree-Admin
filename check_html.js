const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const pagesContainerStart = html.indexOf('<div class="pages-container">');
const pagesContainerEnd = html.indexOf('</main>'); // rough approximation
const containerHtml = html.substring(pagesContainerStart, pagesContainerEnd);

console.log("Characters inside pages-container:", containerHtml.length);

const sections = containerHtml.split('<section');
console.log("Number of sections:", sections.length - 1);

let nonSectionContent = sections[0].trim();
if (nonSectionContent.length > '<div class="pages-container">'.length) {
    console.log("Stuff before first section:", nonSectionContent);
}

