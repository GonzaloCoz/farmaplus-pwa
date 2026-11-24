export interface Zonal {
    id: string;
    label: string;
    avatar?: string;
    branches: string[];
}

export const DEFAULT_ZONALES: Zonal[] = [
    {
        id: 'azanovello',
        label: 'Andrés Zanovello',
        branches: ['Barracas', 'Beccar', 'Colegiales', 'Devoto', 'Devoto II', 'Devoto III', 'Escobar', 'Parque Patricios', 'Pilar', 'Pilar II', 'Pompeya', 'San Isidro', 'San Isidro II', 'San Miguel', 'Villa del Parque', 'Villa del Parque II', 'Villa Luro', 'Villa Urquiza', 'Villa Urquiza II', 'Villa Urquiza III', 'Villa Urquiza IV']
    },
    {
        id: 'druiz',
        label: 'Diego Ruiz',
        branches: ['Belgrano', 'Belgrano IV', 'Belgrano VII', 'Belgrano VIII', 'Berazategui', 'Berazategui II', 'Boedo', 'Microcentro', 'Microcentro II', 'Nuñez', 'Palermo IV', 'Quilmes', 'Retiro', 'Retiro II', 'Tribunales']
    },
    {
        id: 'fformichelli',
        label: 'Federico Formichelli',
        branches: ['Balvanera', 'Balvanera II', 'Caballito', 'Caballito II', 'Caballito III', 'Caballito IV', 'Chacarita', 'Flores', 'Las Cañitas', 'Parque Centenario', 'Ramos Mejia', 'Ramos Mejia II', 'Ramos Mejia III', 'Recoleta', 'Recoleta II', 'Recoleta III', 'Recoleta IV', 'Recoleta V', 'Recoleta VI']
    },
    {
        id: 'jgorbaran',
        label: 'Juan Gorbaran',
        branches: ['Belgrano II', 'Belgrano III', 'Belgrano V', 'Belgrano VI', 'Gonzalez Catan', 'Gonzalez Catan II', 'Gonzalez Catan III', 'Mercedes', 'Morón', 'Padua', 'Palermo', 'Palermo II', 'Palermo III', 'Saladillo', 'Villa Ballester', 'Villa Ballester II', 'Villa Crespo']
    }
];
