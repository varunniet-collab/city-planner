self.addEventListener('install', (event) => {
  console.log('Service Worker Installed');
});

self.addEventListener('fetch', (event) => {
  // यह ऐप को बैकग्राउंड में चलने की अनुमति देता है
});
