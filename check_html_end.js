const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const pagesContainerStart = html.indexOf('<div class="pages-container">');
const pagesContainerEnd = html.indexOf('</main>'); // main closes right after pages-container closes
const containerHtml = html.substring(pagesContainerStart, pagesContainerEnd);

const lastSectionEnd = containerHtml.lastIndexOf('</section>');
const afterLastSection = containerHtml.substring(lastSectionEnd + '</section>'.length);

console.log("After last section:", afterLastSection.trim());

