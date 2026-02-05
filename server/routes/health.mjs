export const registerHealthRoutes = async (app) => {
  app.get('/health', async () => ({ ok: true }));
};

