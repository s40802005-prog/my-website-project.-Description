const https = require('https');
const { URL } = require('url');

function postForm(fields) {
  return new Promise((resolve,reject) => {
    const endpoint = process.env.TOPSMM_API_URL;
    const key = process.env.TOPSMM_API_KEY;
    if (!endpoint || !key) return reject(new Error('TopSMM API URL/key not configured.'));
    const url = new URL(endpoint);
    const body = new URLSearchParams({ key, ...fields }).toString();
    const req = https.request({
      hostname:url.hostname, path:url.pathname + url.search, method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}
    }, resp => {
      let data=''; resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try { const parsed=JSON.parse(data); if(resp.statusCode>=400) reject(new Error('Provider returned HTTP '+resp.statusCode)); else resolve(parsed); }
        catch { reject(new Error('Invalid provider response')); }
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
async function getBalance() {
  return postForm({ action:'balance' });
}
async function getServices() {
  return postForm({ action:'services' });
}
// Do not enable live order placement until service mapping and provider terms are reviewed.
async function addOrder(service, link, quantity) {
  if (!service || !link || !quantity) throw new Error('Missing order parameters');
  return postForm({ action:'add', service:String(service), link:String(link), quantity:String(quantity) });
}
module.exports = { getBalance, getServices, addOrder };
