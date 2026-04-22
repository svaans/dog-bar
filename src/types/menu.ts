export type ModifierSelections = Record<string, string>;

export type ModifierOption = {
  id: string;
  label: string;
  /** Si está definido, este precio sustituye al del plato para la línea (p. ej. base agua/leche). */
  priceEuros?: number;
};

export type ModifierStep = {
  id: string;
  label: string;
  options: ModifierOption[];
};

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  /** Texto pequeño tipo nota de carta (p. ej. piña entera). */
  note?: string;
  /** null = precio en barra / consultar */
  priceEuros: number | null;
  modifiers?: ModifierStep[];
  /** Códigos cortos: gluten, lacteos, frutos-secos, huevo, pescado, soja… */
  allergens?: string[];
  /** Ruta pública bajo `/` o URL absoluta a imagen del plato. */
  imageUrl?: string;
  /** Producto pensado para mascotas (se muestra en carta con icono). */
  forPets?: boolean;
};

export type MenuSection = {
  id: string;
  title: string;
  items: MenuItem[];
};

export type MenuTab = {
  id: string;
  label: string;
  sections: MenuSection[];
};
