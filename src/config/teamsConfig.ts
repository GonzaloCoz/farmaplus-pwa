export const TEAMS_RECIPIENTS = {
    GHCOZ: "GHCoz@farmaplus.com.ar",
    EDIAZ: "ediaz@farmaplus.com.ar",
    EBUSTOS: "ebustos@farmaplus.com.ar"
};

const BRANCH_MAPPING: Record<string, string> = {
    // Grupo GHCOZ
    "belgrano vii": TEAMS_RECIPIENTS.GHCOZ,
    "devoto": TEAMS_RECIPIENTS.GHCOZ,
    "palermo ii": TEAMS_RECIPIENTS.GHCOZ,
    "recoleta ii": TEAMS_RECIPIENTS.GHCOZ,
    "devoto ii": TEAMS_RECIPIENTS.GHCOZ,
    "san miguel": TEAMS_RECIPIENTS.GHCOZ,
    "villa crespo": TEAMS_RECIPIENTS.GHCOZ,
    "villa del parque": TEAMS_RECIPIENTS.GHCOZ,
    "villa del parque ii": TEAMS_RECIPIENTS.GHCOZ,
    "villa luro": TEAMS_RECIPIENTS.GHCOZ,
    "ramos mejia": TEAMS_RECIPIENTS.GHCOZ,
    "ramos mejia ii": TEAMS_RECIPIENTS.GHCOZ,
    "ramos mejia iii": TEAMS_RECIPIENTS.GHCOZ,
    "gonzalez catan": TEAMS_RECIPIENTS.GHCOZ,
    "gonzalez catan ii": TEAMS_RECIPIENTS.GHCOZ,
    "gonzalez catan iii": TEAMS_RECIPIENTS.GHCOZ,
    "padua": TEAMS_RECIPIENTS.GHCOZ,
    "mercedes": TEAMS_RECIPIENTS.GHCOZ,
    "morón": TEAMS_RECIPIENTS.GHCOZ,
    "saladillo": TEAMS_RECIPIENTS.GHCOZ,
    "devoto x": TEAMS_RECIPIENTS.GHCOZ,

    // Grupo EDIAZ
    "belgrano vi": TEAMS_RECIPIENTS.EDIAZ,
    "recoleta": TEAMS_RECIPIENTS.EDIAZ,
    "recoleta iii": TEAMS_RECIPIENTS.EDIAZ,
    "recoleta iv": TEAMS_RECIPIENTS.EDIAZ,
    "recoleta v": TEAMS_RECIPIENTS.EDIAZ,
    "beccar": TEAMS_RECIPIENTS.EDIAZ,
    "belgrano iv": TEAMS_RECIPIENTS.EDIAZ,
    "belgrano": TEAMS_RECIPIENTS.EDIAZ,
    "belgrano ii": TEAMS_RECIPIENTS.EDIAZ,
    "belgrano iii": TEAMS_RECIPIENTS.EDIAZ,
    "belgrano viii": TEAMS_RECIPIENTS.EDIAZ,
    "belgrano v": TEAMS_RECIPIENTS.EDIAZ,
    "palermo iii": TEAMS_RECIPIENTS.EDIAZ,
    "san isidro": TEAMS_RECIPIENTS.EDIAZ,
    "san isidro ii": TEAMS_RECIPIENTS.EDIAZ,
    "tribunales": TEAMS_RECIPIENTS.EDIAZ,
    "villa ballester": TEAMS_RECIPIENTS.EDIAZ,
    "villa ballester ii": TEAMS_RECIPIENTS.EDIAZ,
    "villa urquiza": TEAMS_RECIPIENTS.EDIAZ,
    "villa urquiza ii": TEAMS_RECIPIENTS.EDIAZ,
    "villa urquiza iii": TEAMS_RECIPIENTS.EDIAZ,

    // Grupo EBUSTOS
    "barracas": TEAMS_RECIPIENTS.EBUSTOS,
    "berazategui": TEAMS_RECIPIENTS.EBUSTOS,
    "berazategui ii": TEAMS_RECIPIENTS.EBUSTOS,
    "caballito": TEAMS_RECIPIENTS.EBUSTOS,
    "caballito ii": TEAMS_RECIPIENTS.EBUSTOS,
    "caballito iii": TEAMS_RECIPIENTS.EBUSTOS,
    "caballito iv": TEAMS_RECIPIENTS.EBUSTOS,
    "chacarita": TEAMS_RECIPIENTS.EBUSTOS,
    "flores": TEAMS_RECIPIENTS.EBUSTOS,
    "las cañitas": TEAMS_RECIPIENTS.EBUSTOS,
    "microcentro": TEAMS_RECIPIENTS.EBUSTOS,
    "microcentro ii": TEAMS_RECIPIENTS.EBUSTOS,
    "nuñez": TEAMS_RECIPIENTS.EBUSTOS,
    "palermo": TEAMS_RECIPIENTS.EBUSTOS,
    "parque centenario": TEAMS_RECIPIENTS.EBUSTOS,
    "parque patricios": TEAMS_RECIPIENTS.EBUSTOS,
    "pilar": TEAMS_RECIPIENTS.EBUSTOS,
    "pompeya": TEAMS_RECIPIENTS.EBUSTOS,
    "quilmes": TEAMS_RECIPIENTS.EBUSTOS,
    "retiro": TEAMS_RECIPIENTS.EBUSTOS,
    "retiro ii": TEAMS_RECIPIENTS.EBUSTOS,
};

export const getTeamsRecipient = (branchName?: string): string => {
    if (!branchName) return TEAMS_RECIPIENTS.GHCOZ;
    const clean = branchName.toLowerCase().trim();
    return BRANCH_MAPPING[clean] || TEAMS_RECIPIENTS.GHCOZ;
};
