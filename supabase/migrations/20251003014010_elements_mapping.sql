-- Insert element categories
INSERT INTO public.element_categories (name) VALUES
  ('Metallic composites'),
  ('Trace elements'),
  ('Deleterious elements'),
  ('xTrace elements')
ON CONFLICT (name) DO NOTHING;
-- Insert element category mappings
-- Metallic composites: Ag, Au, Bi, Cd, Co, Cr, Cu, Fe, Ir, Mn, Mo, Ni, Pb, Pd, Pt, Rh, Ru, Sb, Sn, Ti, V, W, Zn
INSERT INTO public.element_category_map (element_id, category_id)
SELECT e.id, c.id
FROM public.elements e
CROSS JOIN public.element_categories c
WHERE c.name = 'Metallic composites'
  AND e.symbol IN ('Ag', 'Au', 'Bi', 'Cd', 'Co', 'Cr', 'Cu', 'Fe', 'Ir', 'Mn', 'Mo', 'Ni', 'Pb', 'Pd', 'Pt', 'Rh', 'Ru', 'Sb', 'Sn', 'Ti', 'V', 'W', 'Zn')
ON CONFLICT (element_id, category_id) DO NOTHING;
-- Trace elements: As, Br, Ce, Cl, Hf, Hg, La, Na, Nb, P, Rb, Re, S, Se, Sm, Sr, Ta, Te, Th, U, Y, Zr
INSERT INTO public.element_category_map (element_id, category_id)
SELECT e.id, c.id
FROM public.elements e
CROSS JOIN public.element_categories c
WHERE c.name = 'Trace elements'
  AND e.symbol IN ('As', 'Br', 'Ce', 'Cl', 'Hf', 'Hg', 'La', 'Na', 'Nb', 'P', 'Rb', 'Re', 'S', 'Se', 'Sm', 'Sr', 'Ta', 'Te', 'Th', 'U', 'Y', 'Zr')
ON CONFLICT (element_id, category_id) DO NOTHING;
-- Deleterious elements: As, Bi, Cd, Cl, Br, Cu, Hg, Pb, Sb, Se, Sn, S, Te, Zn, U, Th, P
INSERT INTO public.element_category_map (element_id, category_id)
SELECT e.id, c.id
FROM public.elements e
CROSS JOIN public.element_categories c
WHERE c.name = 'Deleterious elements'
  AND e.symbol IN ('As', 'Bi', 'Cd', 'Cl', 'Br', 'Cu', 'Hg', 'Pb', 'Sb', 'Se', 'Sn', 'S', 'Te', 'Zn', 'U', 'Th', 'P')
ON CONFLICT (element_id, category_id) DO NOTHING;
-- xTrace elements
INSERT INTO public.element_category_map (element_id, category_id)
SELECT e.id, c.id
FROM public.elements e
CROSS JOIN public.element_categories c
WHERE c.name = 'xTrace elements'
  AND e.symbol IN ('Ag', 'As', 'Au', 'Cd', 'Co', 'Cr', 'Cu', 'Fe', 'Mn', 'Ni', 'Pb', 'Pd', 'Sb', 'Sn', 'Zn')
ON CONFLICT (element_id, category_id) DO NOTHING;
-- Mark "xTrace elements" as default category
UPDATE public.element_categories 
SET is_default = TRUE 
WHERE name = 'xTrace elements';
