const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = 'C:/Users/ACER/supplychain-demo-main/frontend/src';
const API_EXPR = "(process.env.REACT_APP_API_URL || 'http://localhost:5000/api')";

function walkDir(dir) {
    const results = [];
    fs.readdirSync(dir).forEach(file => {
        const fp = path.join(dir, file);
        if (fs.statSync(fp).isDirectory()) results.push(...walkDir(fp));
        else if (file.endsWith('.js') || file.endsWith('.jsx')) results.push(fp);
    });
    return results;
}

let totalFixed = 0;

walkDir(FRONTEND_SRC).forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('localhost:5000')) return;
    const original = content;

    // Fix template literals: `http://localhost:5000/api/...
    content = content.replace(/`http:\/\/localhost:5000\/api\//g, '`${' + API_EXPR + '}/');

    // Fix double-quoted: "http://localhost:5000/api/..."
    content = content.replace(/"http:\/\/localhost:5000\/api\/([^"]*)"/g, (_, r) => '`${' + API_EXPR + '}/' + r + '`');

    // Fix single-quoted: 'http://localhost:5000/api/...'
    content = content.replace(/'http:\/\/localhost:5000\/api\/([^']*)'/g, (_, r) => '`${' + API_EXPR + '}/' + r + '`');

    // Fix bare http://localhost:5000 (CertificateViewer: "http://localhost:5000${url}")
    content = content.replace(/"http:\/\/localhost:5000(\$\{[^}]+\})"/g, (_, v) => '`${' + API_EXPR + ".replace('/api', '')" + '}' + v + '`');
    content = content.replace(/`http:\/\/localhost:5000(\$\{)/g, '`${' + API_EXPR + ".replace('/api', '')" + '}${');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed: ' + filePath.replace(FRONTEND_SRC, ''));
        totalFixed++;
    }
});

console.log('\nDone! Fixed ' + totalFixed + ' file(s).');
