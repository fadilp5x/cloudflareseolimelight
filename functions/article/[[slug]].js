// functions/article/[[slug]].js

// A simple in-memory cache to avoid re-fetching the HTML template on every request
let _html;

export async function onRequest(context) {
    try {
        // --- THIS IS THE PERMANENT FIX ---
        // We are no longer importing any external libraries.
        // Instead, we will use the native fetch API to call the Supabase REST endpoint directly.

        const SUPABASE_URL = context.env.SUPABASE_URL;
        const SUPABASE_KEY = context.env.SUPABASE_SERVICE_KEY; // The secret key

        const slug = context.params.slug[0];
        if (!slug) {
            return new Response('Article slug is missing.', { status: 400 });
        }

        // Construct the Supabase REST API URL
        // We select the columns we need: title, excerpt, image_url, and the author's full_name
        const apiUrl = `${SUPABASE_URL}/rest/v1/posts?slug=eq.${slug}&select=title,excerpt,image_url,authors(full_name)`;

        // Make the direct API call using fetch
        const apiResponse = await fetch(apiUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Accept': 'application/vnd.pgrst.object+json' // Ensures we get a single object, not an array
            }
        });

        if (!apiResponse.ok) {
            console.error('Supabase API error:', apiResponse.status, await apiResponse.text());
            return Response.redirect(new URL('/', context.request.url).toString(), 302);
        }

        const article = await apiResponse.json();

        if (!article) {
             return Response.redirect(new URL('/', context.request.url).toString(), 302);
        }
        // --- END OF THE FIX BLOCK ---


        // 4. Fetch the original article.html template from your deployed site
        const originUrl = new URL(context.request.url);
        
        if (!_html) {
            const response = await context.env.ASSETS.fetch(new URL('/article.html', originUrl));
            if (!response.ok) {
                throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
            }
            _html = await response.text();
        }
        
        const pageUrl = new URL(`/article/${slug}`, originUrl).toString();
        const escapeQuotes = (str) => str ? str.replace(/"/g, '&quot;') : '';

        // 5. Replace the placeholder meta tags with dynamic content
        const finalHtml = _html
            .replace(/<title>.*?<\/title>/, `<title>${escapeQuotes(article.title)} | The Limelight</title>`)
            .replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${escapeQuotes(article.excerpt)}" />`)
            .replace(/<meta name="author" content=".*?"\s*\/?>/, `<meta name="author" content="${escapeQuotes(article.authors.full_name)}" />`)
            .replace(/<meta property="og:title" content=".*?"\s*\/?>/, `<meta property="og:title" content="${escapeQuotes(article.title)}" />`)
            .replace(/<meta property="og:description" content=".*?"\s*\/?>/, `<meta property="og:description" content="${escapeQuotes(article.excerpt)}" />`)
            .replace(/<meta property="og:image" content=".*?"\s*\/?>/, `<meta property="og:image" content="${article.image_url}" />`)
            .replace(/<meta property="og:url" content=".*?"\s*\/?>/, `<meta property="og:url" content="${pageUrl}" />`)
            .replace(/<meta property="twitter:title" content=".*?"\s*\/?>/, `<meta property="twitter:title" content="${escapeQuotes(article.title)}" />`)
            .replace(/<meta property="twitter:description" content=".*?"\s*\/?>/, `<meta property="twitter:description" content="${escapeQuotes(article.excerpt)}" />`)
            .replace(/<meta property="twitter:image" content=".*?"\s*\/?>/, `<meta property="twitter:image" content="${article.image_url}" />`)
            .replace(/<meta property="twitter:url" content=".*?"\s*\/?>/, `<meta property="twitter:url" content="${pageUrl}" />`);
        
        // 6. Return the modified HTML to the browser/crawler
        return new Response(finalHtml, {
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });

    } catch (err) {
        console.error('Cloudflare Function error:', err);
        return new Response('An internal error occurred while processing the article.', { status: 500 });
    }
}
