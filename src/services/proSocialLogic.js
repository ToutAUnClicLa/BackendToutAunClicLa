// =============================================================================
// MÓDULO PRO — Lógica pura de redes sociales (SIN IO). Testeable sin DB.
// =============================================================================

// Límite de redes sociales por tier. free no tiene perfil público => 0.
const SOCIAL_LIMITS = { free: 0, pro: 5, max: Infinity };

// ¿puede agregar otra red según su tier y cuántas tiene ya?
const canAddSocial = (tier, currentCount) => currentCount < (SOCIAL_LIMITS[tier] ?? 0);

export { SOCIAL_LIMITS, canAddSocial };
