
fetch('https://nqrwqrmigaknitmvlokp.supabase.co/rest/v1/products?select=*&head=true', {
    method: 'GET',
    headers: {
        'apikey': 'sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ',
        'Authorization': 'Bearer sb_publishable_JQ1KlkFCoM1LG5_FWPJk5g_n_jzHifZ',
        'Prefer': 'count=exact'
    }
}).then(res => {
    console.log('Range:', res.headers.get('content-range'));
}).catch(err => console.error(err));
