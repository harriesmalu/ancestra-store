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
// ─────────────────────────────────────────────────────────────────────────────
const ZONE_RATES = {
  C: { label: 'CABA',                home: 4800,  branch: 3600,  minDays: 1, maxDays: 2  },
  B: { label: 'Buenos Aires',        home: 7200,  branch: 5800,  minDays: 2, maxDays: 4  },
  S: { label: 'Santa Fe',            home: 10500, branch: 8500,  minDays: 4, maxDays: 6  },
  X: { label: 'Córdoba',             home: 10500, branch: 8500,  minDays: 4, maxDays: 6  },
  E: { label: 'Entre Ríos',         home: 10500, branch: 8500,  minDays: 4, maxDays: 6  },
  L: { label: 'La Pampa',            home: 11000, branch: 9000,  minDays: 4, maxDays: 7  },
  T: { label: 'Tucumán',             home: 12500, branch: 10000, minDays: 5, maxDays: 7  },
  G: { label: 'Santiago del Estero', home: 12500, branch: 10000, minDays: 5, maxDays: 8  },
  A: { label: 'Salta',               home: 13000, branch: 10500, minDays: 5, maxDays: 8  },
  Y: { label: 'Jujuy',               home: 13500, branch: 11000, minDays: 5, maxDays: 8  },
  K: { label: 'Catamarca',           home: 12500, branch: 10000, minDays: 5, maxDays: 8  },
  F: { label: 'La Rioja',            home: 12500, branch: 10000, minDays: 5, maxDays: 8  },
  W: { label: 'Corrientes',          home: 13000, branch: 10500, minDays: 5, maxDays: 8  },
  H: { label: 'Chaco',               home: 13500, branch: 11000, minDays: 5, maxDays: 8  },
  N: { label: 'Misiones',            home: 13500, branch: 11000, minDays: 5, maxDays: 9  },
  P: { label: 'Formosa',             home: 14000, branch: 11500, minDays: 6, maxDays: 9  },
  M: { label: 'Mendoza',             home: 12500, branch: 10000, minDays: 5, maxDays: 7  },
  J: { label: 'San Juan',            home: 12500, branch: 10000, minDays: 5, maxDays: 7  },
  D: { label: 'San Luis',            home: 12000, branch: 9500,  minDays: 4, maxDays: 7  },
  Q: { label: 'Neuquén',             home: 14500, branch: 11500, minDays: 5, maxDays: 8  },
  R: { label: 'Río Negro',          home: 14500, branch: 11500, minDays: 5, maxDays: 8  },
  U: { label: 'Chubut',              home: 17000, branch: 14000, minDays: 6, maxDays: 10 },
  Z: { label: 'Santa Cruz',          home: 18500, branch: 15000, minDays: 7, maxDays: 12 },
  V: { label: 'Tierra del Fuego',    home: 21000, branch: 17500, minDays: 8, maxDays: 14 },
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
