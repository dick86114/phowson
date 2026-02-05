const resolveFromConfigDir = (id) => require(require.resolve(id, { paths: [__dirname] }));

module.exports = {
  plugins: [resolveFromConfigDir('tailwindcss'), resolveFromConfigDir('autoprefixer')],
};
