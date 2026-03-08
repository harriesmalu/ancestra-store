// api/_zone-rates.js
// Tarifas de envío por zona geográfica — fallback cuando no hay API configurada.
// Cubre todo el país usando rangos de Código Postal.
//
// ⚠️  Los precios están en ARS y deben actualizarse periódicamente.
//     Última revisión: marzo 2026. Para precios en tiempo real usar Correo o Envíopack.

const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});

// ─────────────────────────────────────────────────────────────────────────────
// Mapa CP (4 dígitos numérico) → código de provincia (igual que Correo Arg.)
// ─────────────────────────────────────────────────────────────────────────────
export function getProvinceCodeFromCP(cp) {
  const n = parseInt(cp, 10);
  if (isNaN(n)) return 'B';

  if (n >= 1000 && n <= 1499) return 'C'; // CABA
  if (n >= 1500 && n <= 2199) return 'B'; // GBA / Buenos Aires Prov.
  if (n >= 2200 && n <= 2999) return 'B'; // Buenos Aires Prov. interior
  if (n >= 3000 && n <= 3199) return 'S'; // Santa Fe
  if (n >= 3200 && n <= 3299) return 'E'; // Entre Ríos
  if (n >= 3300 && n <= 3399) return 'W'; // Corrientes
  if (n >= 3400 && n <= 3449) return 'N'; // Misiones
  if (n >= 3450 && n <= 3499) return 'W'; // Corrientes
  if (n >= 3500 && n <= 3599) return 'H'; // Chaco
  if (n >= 3600 && n <= 3699) return 'P'; // Formosa
  if (n >= 3700 && n <= 3899) return 'H'; // Chaco / Formosa
  if (n >= 3900 && n <= 3999) return 'N'; // Misiones
  if (n >= 4000 && n <= 4199) return 'T'; // Tucumán
  if (n >= 4200 && n <= 4399) return 'G'; // Santiago del Estero
  if (n >= 4400 && n <= 4599) return 'A'; // Salta
  if (n >= 4600 && n <= 4699) return 'Y'; // Jujuy
  if (n >= 4700 && n <= 4799) return 'K'; // Catamarca
  if (n >= 5000 && n <= 5299) return 'X'; // Córdoba
  if (n >= 5300 && n <= 5399) return 'F'; // La Rioja
  if (n >= 5400 && n <= 5499) return 'J'; // San Juan
  if (n >= 5500 && n <= 5699) return 'M'; // Mendoza
  if (n >= 5700 && n <= 5799) return 'D'; // San Luis
  if (n >= 5800 && n <= 5999) return 'X'; // Córdoba (sur)
  if (n >= 6000 && n <= 6299) return 'B'; // Buenos Aires
  if (n >= 6300 && n <= 6499) return 'L'; // La Pampa
  if (n >= 6500 && n <= 8199) return 'B'; // Buenos Aires (sur/Bahía)
  if (n >= 8200 && n <= 8499) return 'R'; // Río Negro
  if (n >= 8500 && n <= 8999) return 'Q'; // Neuquén
  if (n >= 9000 && n <= 9199) return 'U'; // Chubut
  if (n >= 9200 && n <= 9399) return 'Z'; // Santa Cruz
  if (n >= 9400 && n <= 9999) return 'V'; // Tierra del Fuego
  return 'B';
}

// ─────────────────────────────────────────────────────────────────────────────
// Definición de zonas: precio domicilio / sucursal / días estimados
// Precios en ARS para paquete de 500g, 15x15x15cm.
// Fuente: tarifario Envíopack (tabla_costos.xls), transportista más barato por zona.
// ⚠️  Última revisión: marzo 2026. Para precios en tiempo real usar Correo o Envíopack.
// ─────────────────────────────────────────────────────────────────────────────
const ZONE_RATES = {
  // Zona Envíopack: CABA → transportista más barato: Correo Envíopack
  C: { label: 'CABA',                home: 8962,  branch: 7824,  minDays: 1, maxDays: 2  },
  // Zona Envíopack: GBA 1 (anillo interno) → Correo Envíopack
  // GBA 2/3 son ~$1.500 más caros; se usa GBA 1 como base (zona más poblada)
  B: { label: 'Buenos Aires',        home: 10595, branch: 9457,  minDays: 2, maxDays: 4  },
  // Zona Envíopack: PAMPEANA → Andesmar
  S: { label: 'Santa Fe',            home: 11471, branch: 10333, minDays: 4, maxDays: 6  },
  // Zona Envíopack: CORDOBA CAPITAL → Andesmar
  X: { label: 'Córdoba',             home: 7176,  branch: 6038,  minDays: 3, maxDays: 5  },
  // Zona Envíopack: PAMPEANA → Andesmar
  E: { label: 'Entre Ríos',          home: 11471, branch: 10333, minDays: 4, maxDays: 6  },
  // Zona Envíopack: PAMPEANA → Andesmar
  L: { label: 'La Pampa',            home: 11471, branch: 10333, minDays: 4, maxDays: 7  },
  // Zona Envíopack: NOROESTE → Andesmar
  T: { label: 'Tucumán',             home: 9289,  branch: 8151,  minDays: 4, maxDays: 7  },
  // Zona Envíopack: NOROESTE → Andesmar
  G: { label: 'Santiago del Estero', home: 9289,  branch: 8151,  minDays: 5, maxDays: 8  },
  // Zona Envíopack: NOROESTE → Andesmar
  A: { label: 'Salta',               home: 9289,  branch: 8151,  minDays: 5, maxDays: 8  },
  // Zona Envíopack: NOROESTE → Andesmar
  Y: { label: 'Jujuy',               home: 9289,  branch: 8151,  minDays: 5, maxDays: 8  },
  // Zona Envíopack: NOROESTE → Andesmar
  K: { label: 'Catamarca',           home: 9289,  branch: 8151,  minDays: 5, maxDays: 8  },
  // Zona Envíopack: NOROESTE → Andesmar
  F: { label: 'La Rioja',            home: 9289,  branch: 8151,  minDays: 5, maxDays: 8  },
  // Zona Envíopack: NORDESTE → Andesmar
  W: { label: 'Corrientes',          home: 10617, branch: 9479,  minDays: 5, maxDays: 8  },
  // Zona Envíopack: NORDESTE → Andesmar
  H: { label: 'Chaco',               home: 10617, branch: 9479,  minDays: 5, maxDays: 8  },
  // Zona Envíopack: NORDESTE → Andesmar
  N: { label: 'Misiones',            home: 10617, branch: 9479,  minDays: 5, maxDays: 9  },
  // Zona Envíopack: NORDESTE → Andesmar
  P: { label: 'Formosa',             home: 10617, branch: 9479,  minDays: 6, maxDays: 9  },
  // Zona Envíopack: MENDOZA CAPITAL → Andesmar
  M: { label: 'Mendoza',             home: 7176,  branch: 6038,  minDays: 4, maxDays: 6  },
  // Zona Envíopack: CUYO → Andesmar
  J: { label: 'San Juan',            home: 7184,  branch: 6046,  minDays: 4, maxDays: 7  },
  // Zona Envíopack: CUYO → Andesmar
  D: { label: 'San Luis',            home: 7184,  branch: 6046,  minDays: 4, maxDays: 7  },
  // Zona Envíopack: PATAGONIA → Andesmar
  Q: { label: 'Neuquén',             home: 12721, branch: 11583, minDays: 5, maxDays: 8  },
  // Zona Envíopack: PATAGONIA → Andesmar
  R: { label: 'Río Negro',           home: 12721, branch: 11583, minDays: 5, maxDays: 8  },
  // Zona Envíopack: PATAGONIA → Andesmar
  U: { label: 'Chubut',              home: 12721, branch: 11583, minDays: 6, maxDays: 10 },
  // Zona Envíopack: PATAGONIA → Andesmar
  Z: { label: 'Santa Cruz',          home: 12721, branch: 11583, minDays: 7, maxDays: 12 },
  // Zona Envíopack: TIERRA DEL FUEGO → OCA
  V: { label: 'Tierra del Fuego',    home: 16754, branch: 15616, minDays: 8, maxDays: 14 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Devuelve opciones de envío en el mismo formato que usa correo-quote.js
// ─────────────────────────────────────────────────────────────────────────────
export function getZoneRates(cp) {
  const provinceCode = getProvinceCodeFromCP(cp);
  const zone         = ZONE_RATES[provinceCode] || ZONE_RATES['B'];

  const options = [
    {
      type:           'domicilio',
      label:          'Envío a domicilio',
      price:          zone.home,
      priceFormatted: formatter.format(zone.home),
      deliveryMin:    zone.minDays,
      deliveryMax:    zone.maxDays,
      deliveryLabel:  zone.minDays === zone.maxDays
                        ? `${zone.minDays} días hábiles`
                        : `${zone.minDays} a ${zone.maxDays} días hábiles`,
      productName:    `${zone.label} — tarifa estándar`,
      source:         'zone',
    },
    {
      type:           'sucursal',
      label:          'Retiro en sucursal',
      price:          zone.branch,
      priceFormatted: formatter.format(zone.branch),
      deliveryMin:    zone.minDays,
      deliveryMax:    zone.maxDays + 1,
      deliveryLabel:  `${zone.minDays} a ${zone.maxDays + 1} días hábiles`,
      productName:    `${zone.label} — tarifa estándar`,
      source:         'zone',
    },
  ];

  return { options, province: zone.label, provinceCode };
}
