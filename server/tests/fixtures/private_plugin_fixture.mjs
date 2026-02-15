export const registerPrivateRoutes = async (app) => {
  app.get('/private/ping', async () => {
    return { ok: true }
  })
}

