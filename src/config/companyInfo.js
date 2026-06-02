/**
 * Datos fiscales y de contacto de la empresa para emisión de facturas.
 * Editar AQUÍ los valores reales. No se exponen al cliente final, solo se usan
 * para generar facturas legales (TPS/TVQ Quebec).
 */
export const COMPANY_INFO = {
  // Identificación legal
  legalName: 'Tout À un Clic Là',
  tradeName: 'ToutAunClicLa',

  // Dirección
  address: {
    line1: '1614 Avenue Bourbonnière',
    city: 'Montréal',
    province: 'QC',
    postalCode: 'H1W 3N4',
    country: 'Canada'
  },

  // Contacto
  phone: '+1 (438) 468-1855',
  email: 'serviceclient@toutaunclicla.com',
  website: 'https://www.toutaunclicla.com',

  // Números fiscales (requeridos por ARC/Revenu Québec)
  taxNumbers: {
    gst: '747932762RT0001', // TPS (federal)
    qst: '1232743812TQ0001' // TVQ (provincial)
  }
};
