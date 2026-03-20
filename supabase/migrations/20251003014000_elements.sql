-- Insert all elements
INSERT INTO public.elements (symbol, name, atomic_number) VALUES
('Ag', 'Silver', 47), ('Au', 'Gold', 79), ('Bi', 'Bismuth', 83),
('Cd', 'Cadmium', 48), ('Co', 'Cobalt', 27), ('Cr', 'Chromium', 24),
('Cu', 'Copper', 29), ('Fe', 'Iron', 26), ('Ir', 'Iridium', 77),
('Mn', 'Manganese', 25), ('Mo', 'Molybdenum', 42), ('Ni', 'Nickel', 28),
('Pb', 'Lead', 82), ('Pd', 'Palladium', 46), ('Pt', 'Platinum', 78),
('Rh', 'Rhodium', 45), ('Ru', 'Ruthenium', 44), ('Sb', 'Antimony', 51),
('Sn', 'Tin', 50), ('Ti', 'Titanium', 22), ('V', 'Vanadium', 23),
('W', 'Tungsten', 74), ('Zn', 'Zinc', 30),
('As', 'Arsenic', 33), ('Br', 'Bromine', 35), ('Ce', 'Cerium', 58),
('Cl', 'Chlorine', 17), ('Hf', 'Hafnium', 72), ('Hg', 'Mercury', 80),
('La', 'Lanthanum', 57), ('Na', 'Sodium', 11), ('Nb', 'Niobium', 41),
('P', 'Phosphorus', 15), ('Rb', 'Rubidium', 37), ('Re', 'Rhenium', 75),
('S', 'Sulfur', 16), ('Se', 'Selenium', 34), ('Sm', 'Samarium', 62),
('Sr', 'Strontium', 38), ('Ta', 'Tantalum', 73), ('Te', 'Tellurium', 52),
('Th', 'Thorium', 90), ('U', 'Uranium', 92), ('Y', 'Yttrium', 39),
('Zr', 'Zirconium', 40)
ON CONFLICT (symbol) DO NOTHING;;
