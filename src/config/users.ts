
export interface BranchUser {
    username: string;
    name: string; // Display name
    role: 'branch';
}

export interface AdminUser {
    username: string;
    name: string;
    role: 'admin';
}

export const ADMIN_USERS: AdminUser[] = [
    { username: 'admin1', name: 'Administrador 1', role: 'admin' },
    { username: 'admin2', name: 'Administrador 2', role: 'admin' },
    { username: 'admin3', name: 'Administrador 3', role: 'admin' },
    { username: 'admin4', name: 'Administrador 4', role: 'admin' },
    { username: 'admin5', name: 'Administrador 5', role: 'admin' },
    { username: 'admin6', name: 'Administrador 6', role: 'admin' },
];

export const BRANCH_NAMES = [
    "Belgrano VI",
    "Barracas",
    "Recoleta",
    "Recoleta III",
    "Recoleta IV",
    "Recoleta V",
    "Beccar",
    "Belgrano IV",
    "Belgrano",
    "Belgrano II",
    "Belgrano III",
    "Belgrano VII",
    "Belgrano VIII",
    "Belgrano V",
    "Berazategui",
    "Berazategui II",
    "Caballito",
    "Caballito II",
    "Caballito III",
    "Caballito IV",
    "Chacarita",
    "Devoto",
    "Flores",
    "Las Cañitas",
    "Microcentro",
    "Microcentro II",
    "Nuñez",
    "Palermo",
    "Palermo II",
    "Palermo III",
    "Parque Centenario",
    "Parque Patricios",
    "Pilar",
    "Pompeya",
    "Quilmes",
    "Recoleta II",
    "Retiro",
    "devoto II",
    "Retiro II",
    "San Isidro I",
    "San Isidro II",
    "San Miguel",
    "Tribunales",
    "Villa Ballester",
    "Villa Ballester II",
    "Villa Crespo",
    "Villa del Parque",
    "Villa del Parque II",
    "Villa Luro",
    "Villa Urquiza",
    "Villa Urquiza II",
    "Villa Urquiza III",
    "Ramos Mejia",
    "Ramos Mejia II",
    "Ramos Mejia III",
    "Gonzales Catan",
    "Gonzales Catan II",
    "Gonzales Catan III",
    "Padua",
    "Mercedes",
    "Morón",
    "Saladillo"
];

// Helper to generate BranchUser objects from names
export const BRANCH_USERS: BranchUser[] = BRANCH_NAMES.map(name => ({
    username: name.toLowerCase().replace(/\s+/g, ''), // e.g. "Belgrano VI" -> "belgranovi"
    name: `Farmacia ${name}`,
    role: 'branch'
}));

export const DEFAULT_PASSWORD = 'farmaplus';
