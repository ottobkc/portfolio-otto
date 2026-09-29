// Netlify la ejecuta sola cuando alguien acepta la invitación y crea su cuenta.
// Le asigna el rol "member", que es lo que netlify.toml exige para abrir /members/.
exports.handler = async (event) => {
  let roles = ['member'];
  try {
    const { user } = JSON.parse(event.body || '{}');
    const actuales = (user && user.app_metadata && user.app_metadata.roles) || [];
    roles = Array.from(new Set([...actuales, 'member']));
  } catch (e) {
    console.error('identity-signup:', e.message);
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ app_metadata: { roles } }),
  };
};
