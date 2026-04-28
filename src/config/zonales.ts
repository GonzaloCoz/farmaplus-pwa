export interface Zonal {
    id: string;
    label: string;
    avatar?: string;
    branches: string[];
}

export const ZONALES: Zonal[] = [
    {
        id: "andres-zanovello",
        label: "Andres Zanovello",
        branches: [
            "Barracas", "Beccar", "Devoto", "Devoto II", "Devoto III", "Escobar",
            "Parque Patricios", "Pilar", "Pompeya", "San Isidro", "San Isidro II",
            "San Miguel", "Villa del Parque", "Villa del Parque II", "Villa Luro",
            "Villa Urquiza", "Villa Urquiza II", "Villa Urquiza III"
        ]
    },
    {
        id: "diego-ruiz",
        label: "Diego Ruiz",
        branches: [
            "Belgrano", "Belgrano IV", "Belgrano VII", "Belgrano VIII", "Berazategui",
            "Berazategui II", "Boedo", "Microcentro", "Microcentro II", "Nuñez",
            "Palermo IV", "Quilmes", "Retiro", "Retiro II", "Tribunales"
        ]
    },
    {
        id: "federico-formicelli",
        label: "Federico Formicelli",
        branches: [
            "Caballito", "Caballito II", "Caballito III", "Caballito IV", "Chacarita",
            "Flores", "Las Cañitas", "Parque Centenario", "Ramos Mejia", "Ramos Mejia II",
            "Ramos Mejia III", "Recoleta", "Recoleta II", "Recoleta III",
            "Recoleta IV", "Recoleta V"
        ]
    },
    {
        id: "juan-gorbaran",
        label: "Juan Gorbaran",
        branches: [
            "Belgrano II", "Belgrano III", "Belgrano V", "Belgrano VI", "Gonzalez Catan",
            "Gonzalez Catan II", "Gonzalez Catan III", "Mercedes", "Moron", "Padua",
            "Palermo", "Palermo II", "Palermo III", "Saladillo", "Villa Ballester",
            "Villa Ballester II", "Villa Crespo"
        ]
    }
];

export const getBranchesByZonales = (zonalIds: string[]): string[] => {
    if (zonalIds.length === 0) return [];
    const selectedZonales = ZONALES.filter(z => zonalIds.includes(z.id));
    return Array.from(new Set(selectedZonales.flatMap(z => z.branches)));
};
