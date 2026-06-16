export default async function healthRoutes(app) {
  app.get('/', async () => ({
    message: 'Welcome to the Google Scholar Backend API',
    endpoints: {
      '/health': 'Check API health status',
      '/profile?user={id}': 'Get profile data for a Google Scholar user',
      '/bibtex?user={id}': 'Get all bibtex entries for a Google Scholar user as plain text',
      '/cited-by?url={url}': 'Get cited-by data for a specific publication URL',
      '/related-papers?url={url}': 'Get related papers for a specific publication URL'
    }
  }));

  app.get('/health', async () => ({
    ok: true,
    service: 'googlescholar-backend'
  }));
}
