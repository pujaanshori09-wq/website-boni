export type GarmentBaseColor = 'black' | 'white' | 'brown';

export type PrintFinish =
  | 'gloss-wax'
  | 'chrome-foil'
  | 'plush-flock'
  | 'halftone-screen'
  | 'stealth-tonal';

export type GarmentSize = 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface GarmentProduct {
  id: string;
  pageNumber: number; // 1-17 matching /assets/aistudio/qpky_ref_92df85dc.pdf
  indexLabel: string; // '01' .. '17'
  name: string;
  subtitle: string;
  baseColor: GarmentBaseColor;
  colorLabel: string;
  baseHex: string;
  hasBackGraphic: boolean;
  printFinish: PrintFinish;
  finishLabel: string;
  priceUsd: number;
  editionRun: string;
  description: string;
  /** Fine-tuned specular sheen/roughness hint for the graphic ink layer */
  inkRoughness: number;
  inkMetalness: number;
  inkClearcoat: number;
}

export const GARMENT_SIZES: GarmentSize[] = ['S', 'M', 'L', 'XL', 'XXL'];

export const PDF_CATALOG_PATH = '/assets/aistudio/qpky_ref_92df85dc.pdf';

export const GARMENT_CATALOG: GarmentProduct[] = [
  {
    id: 'stamp-tee',
    pageNumber: 1,
    indexLabel: '01',
    name: 'Stamp Tee',
    subtitle: 'Sealed with Love — Crimson Wax Crest',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: true,
    printFinish: 'gloss-wax',
    finishLabel: 'High-Gloss Relief Plastisol & Halftone Back',
    priceUsd: 98,
    editionRun: 'Edition of 150',
    description:
      'Sculptural blood-red wax seal embossed with the signature P emblem across the chest, finished with micro-script copy ("every mark hides a desire") and a crimson halftone crest on the back.',
    inkRoughness: 0.22,
    inkMetalness: 0.08,
    inkClearcoat: 0.85,
  },
  {
    id: 'born-in-shine',
    pageNumber: 2,
    indexLabel: '02',
    name: 'Born in Shine',
    subtitle: 'Cobalt Flock Halo & Twin Figures',
    baseColor: 'white',
    colorLabel: 'Optic White',
    baseHex: '#F3F3F1',
    hasBackGraphic: true,
    printFinish: 'plush-flock',
    finishLabel: 'Tactile Flock Print & Halftone Back',
    priceUsd: 105,
    editionRun: 'Edition of 120',
    description:
      'Plush electric-blue oval P halo and matching PENANCE banner framing mirrored crimson figures, paired with a cobalt halftone emblem across the upper back.',
    inkRoughness: 0.92,
    inkMetalness: 0.0,
    inkClearcoat: 0.0,
  },
  {
    id: 'roll-or-bleed',
    pageNumber: 3,
    indexLabel: '03',
    name: 'Roll or Bleed',
    subtitle: 'Stacked Crimson Dice & Glass Dagger',
    baseColor: 'white',
    colorLabel: 'Optic White',
    baseHex: '#F3F3F1',
    hasBackGraphic: false,
    printFinish: 'gloss-wax',
    finishLabel: 'High-Definition Multi-Screen Gloss',
    priceUsd: 92,
    editionRun: 'Edition of 150',
    description:
      'Vertical stack of lacquered crimson dice spelling PENANCE beside a gloved grip holding a fractured crystalline blade on heavyweight optic white jersey.',
    inkRoughness: 0.34,
    inkMetalness: 0.05,
    inkClearcoat: 0.45,
  },
  {
    id: 'still-alive',
    pageNumber: 4,
    indexLabel: '04',
    name: 'Still Alive',
    subtitle: 'Charcoal Flock Ring Portrait',
    baseColor: 'white',
    colorLabel: 'Optic White',
    baseHex: '#F3F3F1',
    hasBackGraphic: false,
    printFinish: 'plush-flock',
    finishLabel: 'Soft-Hand Discharge & Plush Ring Detail',
    priceUsd: 95,
    editionRun: 'Edition of 120',
    description:
      'Fine-art figurative study framed inside a textured charcoal-violet oval P ring on crisp 280GSM boxy white cotton with an unprinted minimalist back.',
    inkRoughness: 0.85,
    inkMetalness: 0.0,
    inkClearcoat: 0.0,
  },
  {
    id: 'flag',
    pageNumber: 5,
    indexLabel: '05',
    name: 'Flag',
    subtitle: '2025 Art & Graphic Department',
    baseColor: 'white',
    colorLabel: 'Optic White',
    baseHex: '#F3F3F1',
    hasBackGraphic: true,
    printFinish: 'halftone-screen',
    finishLabel: 'Distressed Water-Based Screenprint',
    priceUsd: 90,
    editionRun: 'Edition of 200',
    description:
      'Weathered star-bordered banner uniting repeating PENANCE PIERCE typographic stripes with the house canton insignia and a deep ink halftone emblem across the back.',
    inkRoughness: 0.78,
    inkMetalness: 0.0,
    inkClearcoat: 0.0,
  },
  {
    id: 'death',
    pageNumber: 6,
    indexLabel: '06',
    name: 'Death',
    subtitle: 'Gothic Engraving — Monochrome Plate',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: false,
    printFinish: 'halftone-screen',
    finishLabel: 'High-Opacity Stark White Plastisol',
    priceUsd: 92,
    editionRun: 'Edition of 150',
    description:
      'Stark white black-metal lettering crowning an archival woodcut-inspired battle scene between gothic columns, grounded with italic script ("you can sneak, but you can\'t hide!").',
    inkRoughness: 0.65,
    inkMetalness: 0.0,
    inkClearcoat: 0.1,
  },
  {
    id: 'war',
    pageNumber: 7,
    indexLabel: '07',
    name: 'War',
    subtitle: 'Documentary Plate & Crimson Calligraphy',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: true,
    printFinish: 'halftone-screen',
    finishLabel: 'Monochrome Halftone & Crimson Overprint',
    priceUsd: 96,
    editionRun: 'Edition of 150',
    description:
      'High-contrast monochrome archival photograph sliced across with bold blood-red Arabic typography and repeating brand lockup, echoed by a crimson halftone back crest.',
    inkRoughness: 0.62,
    inkMetalness: 0.02,
    inkClearcoat: 0.12,
  },
  {
    id: 'human-conditions',
    pageNumber: 8,
    indexLabel: '08',
    name: 'Human Conditions',
    subtitle: 'Triptych Barbed-Wire Studies',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: false,
    printFinish: 'halftone-screen',
    finishLabel: 'Crisp White Archival Screenprint',
    priceUsd: 94,
    editionRun: 'Edition of 150',
    description:
      'Mirrored angular PENANCE PIERCE wordmark suspended above three barbed-wire framed sensory plates and white calligraphic script on heavyweight black jersey.',
    inkRoughness: 0.68,
    inkMetalness: 0.0,
    inkClearcoat: 0.08,
  },
  {
    id: 'chromatic',
    pageNumber: 9,
    indexLabel: '09',
    name: 'Chromatic',
    subtitle: 'Liquid Chrome Oval P License',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: false,
    printFinish: 'chrome-foil',
    finishLabel: 'Liquid Metallic Chrome Transfer',
    priceUsd: 110,
    editionRun: 'Edition of 100',
    description:
      'Mirror-polished liquid silver oval P emblem with industrial Creative Design Development micro-licensing mark, engineered to catch gallery spotlights.',
    inkRoughness: 0.18,
    inkMetalness: 0.72,
    inkClearcoat: 0.9,
  },
  {
    id: 'first-breath-brown',
    pageNumber: 10,
    indexLabel: '10',
    name: 'First Breath Brown',
    subtitle: 'Washed Espresso & Dusty Rose',
    baseColor: 'brown',
    colorLabel: 'Washed Espresso',
    baseHex: '#2C2117',
    hasBackGraphic: true,
    printFinish: 'halftone-screen',
    finishLabel: 'Pigment-Dyed Wash & Soft-Hand Pink Print',
    priceUsd: 102,
    editionRun: 'Edition of 120',
    description:
      'Vintage pigment-washed dark espresso cotton paired with razor-edged dusty rose gothic lettering, quoted "first breath" subtext, and a rose halftone back emblem.',
    inkRoughness: 0.74,
    inkMetalness: 0.0,
    inkClearcoat: 0.05,
  },
  {
    id: 'black-on-black',
    pageNumber: 11,
    indexLabel: '11',
    name: 'Black on Black',
    subtitle: 'Stealth Tonal First Breath Edition',
    baseColor: 'black',
    colorLabel: 'Stealth Black',
    baseHex: '#0E0E10',
    hasBackGraphic: true,
    printFinish: 'stealth-tonal',
    finishLabel: 'Tonal High-Density Matte/Satin Black',
    priceUsd: 104,
    editionRun: 'Edition of 100',
    description:
      'Monolithic tonal study layering satin-black gothic chest typography and a stealth halftone back emblem over ultra-matte obsidian cotton—revealed under angled studio light.',
    inkRoughness: 0.32,
    inkMetalness: 0.12,
    inkClearcoat: 0.5,
  },
  {
    id: 'venetta',
    pageNumber: 12,
    indexLabel: '12',
    name: 'Venetta',
    subtitle: 'Pain Is Pleasure — Chrome Back Crest',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: true,
    printFinish: 'chrome-foil',
    finishLabel: 'Metallic Chrome Crest & Gothic Ring Back',
    priceUsd: 115,
    editionRun: 'Edition of 100',
    description:
      'Minimal triple wordmark across the front chest opening to an expansive back centerpiece: concentric gothic "PAIN IS PLEASURE" lettering anchored by a sculpted liquid chrome sigil.',
    inkRoughness: 0.2,
    inkMetalness: 0.65,
    inkClearcoat: 0.85,
  },
  {
    id: 'pain',
    pageNumber: 13,
    indexLabel: '13',
    name: 'Pain',
    subtitle: 'The Pain of Being Human',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: false,
    printFinish: 'halftone-screen',
    finishLabel: 'Magenta Spot-Color & Halftone Collage',
    priceUsd: 96,
    editionRun: 'Edition of 150',
    description:
      'Visceral hot-crimson gothic display framing a dark surreal anatomical collage flanked by twin ceremonial daggers on heavyweight matte black jersey.',
    inkRoughness: 0.64,
    inkMetalness: 0.0,
    inkClearcoat: 0.1,
  },
  {
    id: 'hustler',
    pageNumber: 14,
    indexLabel: '14',
    name: 'Hustler',
    subtitle: 'Manifesto & Crimson Slash Emblem',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: false,
    printFinish: 'halftone-screen',
    finishLabel: 'Brutalist Block Type & Crimson Halftone Overprint',
    priceUsd: 94,
    editionRun: 'Edition of 150',
    description:
      'Full-chest brutalist editorial manifesto ("HUSTLE HARD, BUT DON\'T WORSHIP THE GRIND... HUSTLER RESPECT HUSTLER") struck through with a vibrant magenta-red halftone emblem.',
    inkRoughness: 0.6,
    inkMetalness: 0.0,
    inkClearcoat: 0.12,
  },
  {
    id: 'sulivan',
    pageNumber: 15,
    indexLabel: '15',
    name: 'Sulivan',
    subtitle: 'Plush Turquoise & Violet Spotted Oval',
    baseColor: 'white',
    colorLabel: 'Optic White',
    baseHex: '#F3F3F1',
    hasBackGraphic: true,
    printFinish: 'plush-flock',
    finishLabel: 'High-Pile Textured Print & Lower Back Hit',
    priceUsd: 105,
    editionRun: 'Edition of 120',
    description:
      'Tactile fur-textured turquoise and purple spotted oval P centerpiece paired with a matching sculpted "penance pierce" signature positioned at the lower-left back hem.',
    inkRoughness: 0.94,
    inkMetalness: 0.0,
    inkClearcoat: 0.0,
  },
  {
    id: 'sinant-pierce',
    pageNumber: 16,
    indexLabel: '16',
    name: 'Sinant Pierce',
    subtitle: 'Arched Distressed Metallic Wordmark',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: false,
    printFinish: 'chrome-foil',
    finishLabel: 'Warm Silver-Gold Metallic Screenprint',
    priceUsd: 98,
    editionRun: 'Edition of 150',
    description:
      'Arched weathered metallic PENANCE lettering accented with subtle specular star glints and wide-tracked P I E R C E typography across the chest.',
    inkRoughness: 0.34,
    inkMetalness: 0.45,
    inkClearcoat: 0.45,
  },
  {
    id: 'penance-pierce',
    pageNumber: 17,
    indexLabel: '17',
    name: 'Penance Pierce',
    subtitle: 'Calligraphic Thorn Script & White Halftone Back',
    baseColor: 'black',
    colorLabel: 'Obsidian Black',
    baseHex: '#101012',
    hasBackGraphic: true,
    printFinish: 'halftone-screen',
    finishLabel: 'Distressed Chalk Screenprint & Halftone Back',
    priceUsd: 98,
    editionRun: 'Edition of 150',
    description:
      'Razor-sharp distressed white thorn calligraphy reading Penance PIERCE across the front, balanced with a luminous white halftone emblem across the back shoulders.',
    inkRoughness: 0.72,
    inkMetalness: 0.0,
    inkClearcoat: 0.05,
  },
];

export interface SizeMeasurementRow {
  size: GarmentSize;
  chestCm: number;
  lengthCm: number;
  shoulderCm: number;
  sleeveCm: number;
}

export const SIZE_CHART_DATA: SizeMeasurementRow[] = [
  { size: 'S', chestCm: 57, lengthCm: 69, shoulderCm: 54, sleeveCm: 22 },
  { size: 'M', chestCm: 60, lengthCm: 72, shoulderCm: 57, sleeveCm: 23.5 },
  { size: 'L', chestCm: 63, lengthCm: 75, shoulderCm: 60, sleeveCm: 25 },
  { size: 'XL', chestCm: 66, lengthCm: 78, shoulderCm: 63, sleeveCm: 26.5 },
  { size: 'XXL', chestCm: 69, lengthCm: 80, shoulderCm: 66, sleeveCm: 28 },
];

export const FREE_SHIPPING_THRESHOLD_USD = 200;
export const STANDARD_SHIPPING_USD = 18;
