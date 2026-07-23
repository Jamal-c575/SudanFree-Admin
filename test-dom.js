import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve('./index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "dangerously",
  resources: "usable"
});

dom.window.console.log = (...args) => console.log('BROWSER LOG:', ...args);
dom.window.console.error = (...args) => console.log('BROWSER ERROR:', ...args);
dom.window.console.warn = (...args) => console.log('BROWSER WARN:', ...args);

dom.window.addEventListener('error', event => {
  console.log('UNHANDLED ERROR:', event.error);
});

// Wait for scripts to load
setTimeout(() => {
  console.log('Window JhomeApp:', typeof dom.window.JhomeApp);
  process.exit(0);
}, 3000);
