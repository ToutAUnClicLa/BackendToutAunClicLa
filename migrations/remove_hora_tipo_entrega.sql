-- Migration: Remove hora_entrega_preferida and tipo_entrega from carrito and pedidos tables
-- Date: 2025-01-24
-- Purpose: Simplify delivery options to only keep metodo_entrega and notas_entrega

-- 1. Remove constraints and indexes from carrito table
ALTER TABLE public.carrito DROP CONSTRAINT IF EXISTS carrito_hora_entrega_preferida_check;
ALTER TABLE public.carrito DROP CONSTRAINT IF EXISTS carrito_tipo_entrega_check;
DROP INDEX IF EXISTS idx_carrito_hora_entrega;

-- 2. Remove columns from carrito table
ALTER TABLE public.carrito
  DROP COLUMN IF EXISTS hora_entrega_preferida,
  DROP COLUMN IF EXISTS tipo_entrega;

-- 3. Remove columns from pedidos table
ALTER TABLE public.pedidos
  DROP COLUMN IF EXISTS hora_entrega_preferida,
  DROP COLUMN IF EXISTS tipo_entrega;

-- 4. Update comments for remaining delivery fields
COMMENT ON COLUMN public.carrito.metodo_entrega IS 'Método de entrega: puerta (dejar en puerta), manos (entregar en mano), recepcion (dejar en recepción)';
COMMENT ON COLUMN public.carrito.notas_entrega IS 'Notas adicionales para el repartidor';

COMMENT ON COLUMN public.pedidos.metodo_entrega IS 'Método de entrega: puerta (dejar en puerta), manos (entregar en mano), recepcion (dejar en recepción)';
COMMENT ON COLUMN public.pedidos.notas_entrega IS 'Notas adicionales para el repartidor';