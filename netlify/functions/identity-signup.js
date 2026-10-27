// Netlify la ejecuta sola cuando alguien acepta la invitación y crea su cuenta.
// El acceso (MD+ o "solo fotos") lo pone antes el CRM o el pago al invitar, y aquí se respeta.
// Una cuenta que llega sin acceso (registro abierto por error, invitación hecha a mano desde Netlify)
// entra SIN acceso: se le da desde el CRM. Así nadie puede hacerse MD+ registrándose solo.
exports.handler = async (event) => {
  let roles = [];
  try {
    const { user } = JSON.parse(event.body || '{}');
    roles = (user && user.app_metadata && user.app_metadata.roles) || [];
  } catch (e) {
    console.error('identity-signup:', e.message);
  }
  return { statusCode: 200, body: JSON.stringify({ app_metadata: { roles } }) };
};
