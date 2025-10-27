// SPA routing handler for Cloudflare Pages
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Handle API routes or other special routes if needed
  if (url.pathname.startsWith("/api/")) {
    // You can add API route handling here if needed
    return new Response("API endpoint", { status: 200 });
  }

  // For all other routes, serve the index.html (SPA routing)
  try {
    const indexHtml = await context.env.ASSETS.fetch(
      new Request("/index.html"),
    );
    return indexHtml;
  } catch (error) {
    return new Response("Not Found", { status: 404 });
  }
}
