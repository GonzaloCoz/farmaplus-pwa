
const https = require('https');

const url = 'https://nqrwqrmigaknitmvlokp.supabase.co/rest/v1/products?select=*&head=true';
const options = {
    method: 'GET',
    headers: {
        'apikey': 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ',
        'Authorization': 'Bearer sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ',
        'Prefer': 'count=exact'
    }
};

const req = https.request(url, options, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Content-Range:', res.headers['content-range']);
});

req.on('error', (e) => {
    console.error(e);
});

req.end();
