const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Listen to console logs and errors
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
        page.on('response', response => {
            if (response.status() >= 400) {
                console.error('PAGE RESP ERROR:', response.status(), response.url());
            }
        });

        console.log("Navigating to http://localhost:3000/create...");
        await page.goto('http://localhost:3000/create', { waitUntil: 'networkidle2' });
        
        console.log("Waiting 5 seconds for React to render...");
        await new Promise(r => setTimeout(r, 5000));
        
        const html = await page.content();
        console.log("Body length:", html.length);
        if (html.includes("Weaving your experience")) {
            console.log("Stuck on loading screen.");
        }
        
        await browser.close();
    } catch (e) {
        console.error("Puppeteer script error:", e);
    }
})();
