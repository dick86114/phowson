export const registerPrivateRoutes = async (app) => {
  app.get('/private/demo', async () => {
    return { ok: true, source: 'private-template' }
  })
}

