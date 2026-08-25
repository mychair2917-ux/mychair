const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync('index.html'));
});
server.listen(8080, async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:8080');
  
  // Wait for FB to initialize
  await page.waitForFunction('window.FB !== undefined');

  browser.on('targetcreated', async (target) => {
    if (target.type() === 'page') {
      const newPage = await target.page();
      const url = newPage.url();
      console.log("POPUP_URL:", url);
      await browser.close();
      server.close();
      process.exit(0);
    }
  });

  const popupUrl = await page.evaluate(() => {
    return new Promise((resolve) => {
      const originalOpen = window.open;
      window.open = function(url, name, features) {
        resolve(url);
        return originalOpen(url, name, features);
      };
      
      FB.login(
        function(response) {},
        {
          config_id: '1763034791576572',
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            sessionInfoVersion: 3,
          }
        }
      );
    });
  });
  
  console.log("INTERCEPTED_URL:", popupUrl);
  await browser.close();
  server.close();
});
