export interface LandBenchmark {
  areaLabel: string;
  medianChfPerParcelM2: number;
  lowerQuartileChfPerParcelM2: number;
  upperQuartileChfPerParcelM2: number;
  periodLabel: string;
  source?: string;
}

// 7 districts of the canton of Fribourg
export const FRIBOURG_DISTRICT_STATS: Record<
  "Sarine" | "Gruyère" | "Veveyse" | "Lac" | "Broye" | "Singine" | "Glâne",
  LandBenchmark
> = {
  Sarine: {
    areaLabel: "district de la Sarine (FR)",
    medianChfPerParcelM2: 840,
    lowerQuartileChfPerParcelM2: 620,
    upperQuartileChfPerParcelM2: 1100,
    periodLabel: "cadrage 2024–2025",
    source: "Service de la statistique du canton de Fribourg (StatA)",
  },
  Gruyère: {
    areaLabel: "district de la Gruyère (FR)",
    medianChfPerParcelM2: 720,
    lowerQuartileChfPerParcelM2: 520,
    upperQuartileChfPerParcelM2: 950,
    periodLabel: "cadrage 2024–2025",
    source: "Service de la statistique du canton de Fribourg (StatA)",
  },
  Veveyse: {
    areaLabel: "district de la Veveyse (FR)",
    medianChfPerParcelM2: 800,
    lowerQuartileChfPerParcelM2: 600,
    upperQuartileChfPerParcelM2: 1050,
    periodLabel: "cadrage 2024–2025",
    source: "Service de la statistique du canton de Fribourg (StatA)",
  },
  Lac: {
    areaLabel: "district du Lac (FR)",
    medianChfPerParcelM2: 810,
    lowerQuartileChfPerParcelM2: 590,
    upperQuartileChfPerParcelM2: 1080,
    periodLabel: "cadrage 2024–2025",
    source: "Service de la statistique du canton de Fribourg (StatA)",
  },
  Broye: {
    areaLabel: "district de la Broye (FR)",
    medianChfPerParcelM2: 650,
    lowerQuartileChfPerParcelM2: 480,
    upperQuartileChfPerParcelM2: 840,
    periodLabel: "cadrage 2024–2025",
    source: "Service de la statistique du canton de Fribourg (StatA)",
  },
  Singine: {
    areaLabel: "district de la Singine (FR)",
    medianChfPerParcelM2: 610,
    lowerQuartileChfPerParcelM2: 440,
    upperQuartileChfPerParcelM2: 790,
    periodLabel: "cadrage 2024–2025",
    source: "Service de la statistique du canton de Fribourg (StatA)",
  },
  Glâne: {
    areaLabel: "district de la Glâne (FR)",
    medianChfPerParcelM2: 580,
    lowerQuartileChfPerParcelM2: 410,
    upperQuartileChfPerParcelM2: 750,
    periodLabel: "cadrage 2024–2025",
    source: "Service de la statistique du canton de Fribourg (StatA)",
  },
};

// Fallback when canton is Fribourg but commune is not recognized
export const FRIBOURG_CANTON_FALLBACK: LandBenchmark = {
  areaLabel: "canton de Fribourg (FR)",
  medianChfPerParcelM2: 780,
  lowerQuartileChfPerParcelM2: 550,
  upperQuartileChfPerParcelM2: 1000,
  periodLabel: "cadrage 2024–2025",
  source: "Service de la statistique du canton de Fribourg (StatA)",
};

// Default benchmark for canton Vaud (Morges)
export const VAUD_MORGES_BENCHMARK: LandBenchmark = {
  areaLabel: "district de Morges (VD)",
  medianChfPerParcelM2: 2280,
  lowerQuartileChfPerParcelM2: 1450,
  upperQuartileChfPerParcelM2: 3650,
  periodLabel: "cadrage 2024–2025",
};

type FribourgDistrict = keyof typeof FRIBOURG_DISTRICT_STATS;

// Mapping of Fribourg communes to their respective districts
const COMMUNE_TO_DISTRICT: Record<string, FribourgDistrict> = {
  // Sarine
  fribourg: "Sarine",
  freiburg: "Sarine",
  marly: "Sarine",
  "villars sur glane": "Sarine",
  givisiez: "Sarine",
  "granges paccot": "Sarine",
  corminboeuf: "Sarine",
  belfaux: "Sarine",
  matran: "Sarine",
  cottens: "Sarine",
  neyruz: "Sarine",
  avry: "Sarine",
  gibloux: "Sarine",
  "le mouret": "Sarine",
  treyvaux: "Sarine",
  hauterive: "Sarine",
  "la brillaz": "Sarine",
  "la sonnaz": "Sarine",
  ferpicloz: "Sarine",
  autigny: "Sarine",
  prez: "Sarine",
  ponthaux: "Sarine",
  grolley: "Sarine",
  "bois d amont": "Sarine",

  // Gruyère
  bulle: "Gruyère",
  riaz: "Gruyère",
  broc: "Gruyère",
  gruyeres: "Gruyère",
  "bas intyamon": "Gruyère",
  "haut intyamon": "Gruyère",
  marsens: "Gruyère",
  vuadens: "Gruyère",
  corbieres: "Gruyère",
  grandvillard: "Gruyère",
  sorens: "Gruyère",
  echarlens: "Gruyère",
  botterens: "Gruyère",
  cresuz: "Gruyère",
  jaun: "Gruyère",
  "la roche": "Gruyère",
  "le paquier": "Gruyère",
  "pont en ogoz": "Gruyère",
  "pont la ville": "Gruyère",
  sales: "Gruyère",
  "val de charmey": "Gruyère",

  // Veveyse
  "chatel saint denis": "Veveyse",
  "chatel st denis": "Veveyse",
  attalens: "Veveyse",
  bossonnens: "Veveyse",
  remaufens: "Veveyse",
  semsales: "Veveyse",
  "le flon": "Veveyse",
  "saint martin": "Veveyse",
  "st martin": "Veveyse",
  "granges veveyse": "Veveyse",
  granges: "Veveyse",
  "la verrerie": "Veveyse",

  // Lac
  morat: "Lac",
  murten: "Lac",
  courgevaux: "Lac",
  "mont vully": "Lac",
  meyriez: "Lac",
  cressier: "Lac",
  kerzers: "Lac",
  fraschels: "Lac",
  "ried bei kerzers": "Lac",
  gurmels: "Lac",
  kleinbosingen: "Lac",
  muntelier: "Lac",
  greng: "Lac",
  courtepin: "Lac",
  "misery courtion": "Lac",

  // Broye
  estavayer: "Broye",
  "estavayer le lac": "Broye",
  "belmont broye": "Broye",
  domdidier: "Broye",
  "saint aubin": "Broye",
  "st aubin": "Broye",
  gletterens: "Broye",
  portalban: "Broye",
  "delley portalban": "Broye",
  montagny: "Broye",
  cugy: "Broye",
  "cheyres chables": "Broye",
  fetigny: "Broye",
  "fetigny menieres": "Broye",
  menieres: "Broye",
  lully: "Broye",
  surpierre: "Broye",
  "les montets": "Broye",
  chatillon: "Broye",
  prevondavaux: "Broye",
  sevaz: "Broye",

  // Singine (Sense)
  dudingen: "Singine",
  duedingen: "Singine",
  schmitten: "Singine",
  tafers: "Singine",
  bosingen: "Singine",
  boesingen: "Singine",
  "wunnewil flamatt": "Singine",
  flamatt: "Singine",
  heitenried: "Singine",
  giffers: "Singine",
  plaffeien: "Singine",
  tentlingen: "Singine",
  "st ursen": "Singine",
  "saint ursen": "Singine",
  plasselb: "Singine",
  "st silvester": "Singine",
  "saint silvester": "Singine",
  brunisried: "Singine",
  zumholz: "Singine",
  rechthalten: "Singine",
  ueberstorf: "Singine",

  // Glâne
  romont: "Glâne",
  ursy: "Glâne",
  siviriez: "Glâne",
  rue: "Glâne",
  "vuisternens devant romont": "Glâne",
  mezieres: "Glâne",
  "billens hennens": "Glâne",
  billens: "Glâne",
  hennens: "Glâne",
  chatonnaye: "Glâne",
  massonnens: "Glâne",
  torny: "Glâne",
  "le chatelard": "Glâne",
  grangettes: "Glâne",
  villorsonnens: "Glâne",
  villarsiviriaux: "Glâne",
};

/**
 * Normalizes a commune name to facilitate matching (lowercased, accents removed, non-alphanumeric removed)
 */
export function normalizeCommuneName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]/g, " ")     // Replace punctuation/dashes with spaces
    .replace(/\s+/g, " ")           // Collapse consecutive spaces
    .trim();
}

/**
 * Associates a commune to the correct Fribourg district benchmark, or defaults to canton fallback.
 * If canton is VD, returns the Morges default benchmark.
 */
export function getLandBenchmark(canton: string, commune: string): LandBenchmark {
  const upperCanton = canton.trim().toUpperCase();

  if (upperCanton === "VD") {
    return VAUD_MORGES_BENCHMARK;
  }

  if (upperCanton === "FR") {
    const normalizedInput = normalizeCommuneName(commune);
    
    // Direct lookup
    if (COMMUNE_TO_DISTRICT[normalizedInput]) {
      const district = COMMUNE_TO_DISTRICT[normalizedInput];
      return FRIBOURG_DISTRICT_STATS[district];
    }

    // Partial lookup (splitting by slash or checking if words of input are inside our keys, or vice-versa)
    const words = normalizedInput.split(" ");
    for (const word of words) {
      if (word.length >= 3) {
        if (COMMUNE_TO_DISTRICT[word]) {
          const district = COMMUNE_TO_DISTRICT[word];
          return FRIBOURG_DISTRICT_STATS[district];
        }
        
        // Let's also check if any COMMUNE_TO_DISTRICT key is contained in our normalizedInput
        for (const key of Object.keys(COMMUNE_TO_DISTRICT)) {
          if (key.length >= 3 && (normalizedInput.includes(key) || key.includes(normalizedInput))) {
            const district = COMMUNE_TO_DISTRICT[key];
            return FRIBOURG_DISTRICT_STATS[district];
          }
        }
      }
    }

    // Default fallback if not recognized
    return FRIBOURG_CANTON_FALLBACK;
  }

  // General default fallback for other cantons
  return VAUD_MORGES_BENCHMARK;
}
