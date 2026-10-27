// Netlify la ejecuta sola cuando alguien acepta la invitación y crea su cuenta.
// Si la invitación ya traía un acceso (MD+ o "solo fotos", puesto desde el CRM o al pagar),
// se respeta. Si no traía ninguno (invitación hecha a mano desde Netlify), entra como MD+ ("member").
// Un manual de taller ("taller-<id>") también cuenta como acceso: quien solo tiene el manual
// NO se convierte en MD+ al crear su cuenta.
exports.handler = async (event) => {
  let roles = ['member'];
  try {
    const { user } = JSON.parse(event.body || '{}');
    const actuales = (user && user.app_metadata && user.app_metadata.roles) || [];
    const yaTieneAcceso = actuales.some((r) => ['member', 'participante', 'admin'].includes(r) || /^taller-/.test(r));
    roles = yaTieneAcceso ? actuales : Array.from(new Set([...actuales, 'member']));
  } catch (e) {
    console.error('identity-signup:', e.message);
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ app_metadata: { roles } }),
  };
};
