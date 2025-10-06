// functions/article/[[slug]].js

import { createClient } from '@supabase/supabase-js';

// A simple in-memory cache to avoid re-fetching the HTML template on every request
let _html;

export async function onRequest(context) {
    try {
        // 1. Initialize Supabase client using Environment Variables from Cloudflare
        const supabase = createClient(
            context.env.SUPABASE_URL,
            context.env.SUPABASE_SERVICE_KEY // Use the secret Service Role key here
        );

        // 2. Get the article slug from the URL path
        // For a URL like /article/my-first-post, context.params.slug will be ['my-first-post']
        const slug = context.params.slug[0];
        if (!slug) {
            return new Response('Article slug is missing.', { status: 400 });
        }

        // 3. Fetch the specific article data from Supabase
        const { data: article, error } = await supabase
            .from('posts')
            .select('title, excerpt, image_url, authors(full_name)')
            .eq('slug', slug)
            .single();

        if (error || !article) {
            console.error('Article not found or error fetching:', slug, error);
            // Redirect to the homepage if the article doesn't exist
            return Response.redirect(new URL('/', context.request.url).toString(), 302);
        }

        // 4. Fetch the original article.html template from your deployed site
        const originUrl = new URL(context.request.url);
        const templateUrl = new URL('/article.html', originUrl);
        
        // Use a simple cache for the template file to improve performance
        if (!_html) {
            const response = await context.env.ASSETS.fetch(templateUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
            }
            _html = await response.text();
        }
        
        const pageUrl = new URL(`/article/${slug}`, originUrl).toString();

        // 5. Replace the placeholder meta tags with dynamic content
        // This is a robust way to replace tags regardless of their exact formatting
        const finalHtml = _html
            .replace(/<title>.*?<\/title>/, `<title>${article.title.replace(/"/g, '&quot;')} | The Limelight</title>`)
            .replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${article.excerpt.replace(/"/g, '&quot;')}" />`)
            .replace(/<meta name="author" content=".*?"\s*\/?>/, `<meta name="author" content="${article.authors.full_name.replace(/"/g, '&quot;')}" />`)
            .replace(/<meta property="og:title" content=".*?"\s*\/?>/, `<meta property="og:title" content="${article.title.replace(/"/g, '&quot;')}" />`)
            .replace(/<meta property="og:description" content=".*?"\s*\/?>/, `<meta property="og:description" content="${article.excerpt.replace(/"/g, '&quot;')}" />`)
            .replace(/<meta property="og:image" content=".*?"\s*\/?>/, `<meta property="og:image" content="${article.image_url}" />`)
            .replace(/<meta property="og:url" content=".*?"\s*\/?>/, `<meta property="og:url" content="${pageUrl}" />`)
            .replace(/<meta property="twitter:title" content=".*?"\s*\/?>/, `<meta property="twitter:title" content="${article.title.replace(/"/g, '&quot;')}" />`)
            .replace(/<meta property="twitter:description" content=".*?"\s*\/?>/, `<meta property="twitter:description" content="${article.excerpt.replace(/"/g, '&quot;')}" />`)
            .replace(/<meta property="twitter:image" content=".*?"\s*\/?>/, `<meta property="twitter:image" content="${article.image_url}" />`)
            .replace(/<meta property="twitter:url" content=".*?"\s*\/?>/, `<meta property="twitter:url" content="${pageUrl}" />`);
        
        // 6. Return the modified HTML to the browser/crawler
        return new Response(finalHtml, {
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
            },
        });

    } catch (err) {
        console.error('Cloudflare Function error:', err);
        return new Response('An internal error occurred while processing the article.', { status: 500 });
    }
}
