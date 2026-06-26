// =============================================================================
// MÓDULO PRO — Lógica pura de tiers (SIN IO). Testeable sin DB.
// =============================================================================

const TIER_RANK = { free: 0, pro: 1, max: 2 };

// ¿el tier alcanza el mínimo requerido? Un tier desconocido cuenta como free.
const hasTier = (tier, min) => (TIER_RANK[tier] ?? 0) >= (TIER_RANK[min] ?? 0);

// Devuelve el tier de mayor rango entre dos (ej. caché vs suscripción).
const higherTier = (a, b) => ((TIER_RANK[a] ?? 0) >= (TIER_RANK[b] ?? 0) ? a : b);

export { TIER_RANK, hasTier, higherTier };
