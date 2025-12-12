
-- 1. Insert Branches
INSERT INTO public.branches (name, slug) VALUES
('Belgrano VI', 'belgranovi'),
('Barracas', 'barracas'),
('Recoleta', 'recoleta'),
('Recoleta III', 'recoletaiii'),
('Recoleta IV', 'recoletaiv'),
('Recoleta V', 'recoletav'),
('Beccar', 'beccar'),
('Belgrano IV', 'belgranoiv'),
('Belgrano', 'belgrano'),
('Belgrano II', 'belgranoii'),
('Belgrano III', 'belgranoiii'),
('Belgrano VII', 'belgranovii'),
('Belgrano VIII', 'belgranoviii'),
('Belgrano V', 'belgranov'),
('Berazategui', 'berazategui'),
('Berazategui II', 'berazateguiii'),
('Caballito', 'caballito'),
('Caballito II', 'caballitoii'),
('Caballito III', 'caballitoiii'),
('Caballito IV', 'caballitoiv'),
('Chacarita', 'chacarita'),
('Devoto', 'devoto'),
('Flores', 'flores'),
('Las Cañitas', 'lascanitas'),
('Microcentro', 'microcentro'),
('Microcentro II', 'microcentroii'),
('Nuñez', 'nunez'),
('Palermo', 'palermo'),
('Palermo II', 'palermoii'),
('Palermo III', 'palermoiii'),
('Parque Centenario', 'parquecentenario'),
('Parque Patricios', 'parquepatricios'),
('Pilar', 'pilar'),
('Pompeya', 'pompeya'),
('Quilmes', 'quilmes'),
('Recoleta II', 'recoletaii'),
('Retiro', 'retiro'),
('devoto II', 'devotoii'),
('Retiro II', 'retiroii'),
('San Isidro I', 'sanisidroi'),
('San Isidro II', 'sanisidroii'),
('San Miguel', 'sanmiguel'),
('Tribunales', 'tribunales'),
('Villa Ballester', 'villaballester'),
('Villa Ballester II', 'villaballesterii'),
('Villa Crespo', 'villacrespo'),
('Villa del Parque', 'villadelparque'),
('Villa del Parque II', 'villadelparqueii'),
('Villa Luro', 'villaluro'),
('Villa Urquiza', 'villaurquiza'),
('Villa Urquiza II', 'villaurquizaii'),
('Villa Urquiza III', 'villaurquizaiii'),
('Ramos Mejia', 'ramosmejia'),
('Ramos Mejia II', 'ramosmejiaii'),
('Ramos Mejia III', 'ramosmejiaiii'),
('Gonzales Catan', 'gonzalescatan'),
('Gonzales Catan II', 'gonzalescatanii'),
('Gonzales Catan III', 'gonzalescataniii'),
('Padua', 'padua'),
('Mercedes', 'mercedes'),
('Morón', 'moron'),
('Saladillo', 'saladillo')
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert Branch Users (automatically linked to branch)
INSERT INTO public.profiles (username, full_name, role, branch_id)
SELECT 
    slug as username,
    'Farmacia ' || name as full_name,
    'branch' as role,
    id as branch_id
FROM public.branches
ON CONFLICT (username) DO NOTHING;

-- 3. Insert Admins
INSERT INTO public.profiles (username, full_name, role) VALUES
('gcoz', 'Gonzalo Coz', 'admin'),
('ediaz', 'Emanuel Diaz', 'admin'),
('ebustos', 'Ezequiel Bustos', 'admin'),
('nmomeno', 'Nicolas Momeño', 'admin'),
('cfraga', 'Carlos Fraga', 'admin')
ON CONFLICT (username) DO NOTHING;
