import type { MenuTab } from "@/types/menu";

const postobonSabores = [
  { id: "manzana", label: "Manzana" },
  { id: "uva", label: "Uva" },
  { id: "tamarindo", label: "Tamarindo" },
  { id: "colombiana", label: "Colombiana" },
];

const zumoSabores = [
  { id: "fresa", label: "Fresa" },
  { id: "maracuya", label: "Maracuyá" },
  { id: "papaya", label: "Papaya" },
  { id: "guanabana", label: "Guanábana" },
  { id: "lulo", label: "Lulo" },
  { id: "avena-calena", label: "Avena caleña" },
  { id: "mango", label: "Mango" },
  { id: "mora", label: "Mora" },
  { id: "guayaba", label: "Guayaba" },
  { id: "pina", label: "Piña" },
  { id: "tomate-arbol", label: "Tomate de árbol" },
  { id: "milo-frio", label: "Milo frío" },
];

export const MERAKI_MENU: MenuTab[] = [
  {
    id: "comida",
    label: "Comida",
    sections: [
      {
        id: "para-picar",
        title: "Para picar",
        items: [
          {
            id: "patatas-bravas",
            name: "Patatas bravas",
            priceEuros: 7.9,
            allergens: ["gluten"],
          },
          { id: "patatas-alioli", name: "Patatas alioli", priceEuros: 7.9 },
          {
            id: "patatas-padron",
            name: "Patatas con pimientos de Padrón",
            priceEuros: 7.9,
          },
          {
            id: "salchipapas-8",
            name: "Salchipapas 8 salsas",
            priceEuros: 8.9,
          },
          {
            id: "salchipapas-suprema",
            name: "Salchipapas la suprema",
            description: "Nuestra versión especial",
            priceEuros: 14,
          },
          {
            id: "boquerones",
            name: "Boquerones en vinagre",
            priceEuros: 7.9,
          },
          {
            id: "picada-meraki",
            name: "Picada Meraki",
            description: "Papa criolla, yuca, chorizo, morcilla, salchicha",
            priceEuros: 15,
          },
          { id: "tiras-pollo", name: "Tiras de pollo", priceEuros: 9.9 },
          { id: "tequenos", name: "Tequeños", priceEuros: 7.9 },
        ],
      },
      {
        id: "raciones",
        title: "Raciones",
        items: [
          {
            id: "croquetas-jamon-queso",
            name: "Croquetas de jamón y queso",
            priceEuros: 7.9,
          },
          { id: "jamon-iberico", name: "Jamón ibérico", priceEuros: 22 },
          { id: "queso-curado", name: "Queso curado", priceEuros: 18 },
          {
            id: "tabla-jamon-queso",
            name: "Tabla mixta jamón y queso",
            priceEuros: 18,
          },
          {
            id: "tabla-ibericos",
            name: "Tabla ibéricos surtidos",
            priceEuros: 22,
          },
          { id: "nachos", name: "Nachos", priceEuros: 11.9 },
        ],
      },
      {
        id: "perritos-xxl",
        title: "Perritos XXL Meraki",
        items: [
          {
            id: "perrito-carrillada",
            name: "Perrito de carrillada",
            priceEuros: 14.9,
          },
          {
            id: "perrito-hawaiano",
            name: "Perrito hawaiano",
            priceEuros: 13.9,
          },
          {
            id: "perrito-picante",
            name: "Perrito picante",
            priceEuros: 13.9,
          },
          {
            id: "perrito-clasico",
            name: "Perrito clásico",
            priceEuros: 12.9,
          },
          {
            id: "perrito-clasico-normal",
            name: "Perrito clásico tamaño normal",
            description: "Tamaño normal",
            priceEuros: 2.5,
          },
        ],
      },
      {
        id: "pastas",
        title: "Pastas",
        items: [
          { id: "pasta-bolonesa", name: "Boloñesa", priceEuros: 11.9 },
          { id: "pasta-carbonara", name: "Carbonara", priceEuros: 11.9 },
        ],
      },
      {
        id: "arepas",
        title: "Arepas tiernas de maíz",
        items: [
          {
            id: "arepa-cochinita",
            name: "Cochinita pibil al adobo y queso",
            priceEuros: 7.9,
          },
          {
            id: "arepa-pollo",
            name: "Pollo asado desmechado y queso",
            priceEuros: 7.9,
          },
          {
            id: "arepa-carrillada",
            name: "Carrillada al Pedro Ximénez y queso",
            priceEuros: 7.9,
          },
          {
            id: "arepa-bandeja-paisa",
            name: "Bandeja paisa en arepa",
            priceEuros: 11.5,
          },
        ],
      },
      {
        id: "bocados-gourmet",
        title: "Bocados gourmet (brioche)",
        items: [
          {
            id: "bocado-cochinita",
            name: "Cochinita pibil al adobo",
            priceEuros: 8.9,
          },
          {
            id: "bocado-pollo",
            name: "Pollo asado desmechado",
            priceEuros: 8.9,
          },
          {
            id: "bocado-carrillada",
            name: "Carrillada al Pedro Ximénez",
            priceEuros: 8.9,
          },
        ],
      },
      {
        id: "sopa",
        title: 'Sopa "Meraki"',
        items: [
          {
            id: "sopa-pollo-meraki",
            name: "Sopa de pollo Meraki",
            description: "Acompañada de arroz y aguacate",
            priceEuros: 12.9,
          },
        ],
      },
      {
        id: "carnes",
        title: "Carnes",
        items: [
          {
            id: "costilla-meraki",
            name: "Costilla Meraki a la BBQ",
            priceEuros: 14.9,
          },
          {
            id: "chorizo-santarrosano",
            name: "Chorizo santarrosano",
            priceEuros: 7.9,
          },
          {
            id: "alitas-miel-mostaza",
            name: "Alitas miel mostaza",
            priceEuros: 11.9,
          },
          { id: "alitas-broaster", name: "Alitas broaster", priceEuros: 10.9 },
          { id: "alitas-bbq", name: "Alitas BBQ", priceEuros: 11.9 },
        ],
      },
    ],
  },
  {
    id: "postres",
    label: "Postres",
    sections: [
      {
        id: "postres-lista",
        title: "Postres",
        items: [
          {
            id: "ensalada-frutas",
            name: "Ensalada de frutas",
            priceEuros: 8,
          },
          {
            id: "ensalada-frutas-xl",
            name: "Ensalada de frutas XL",
            priceEuros: 13,
          },
          {
            id: "fresas-crema",
            name: "Fresas con crema",
            priceEuros: 6.5,
          },
          {
            id: "fresas-crema-melocoton",
            name: "Fresas con crema y melocotón",
            priceEuros: 7.5,
          },
          {
            id: "brownie-helado",
            name: "Brownie con helado",
            priceEuros: 6,
          },
          {
            id: "copa-helado",
            name: "Copa de helado (3 bolas)",
            priceEuros: 6,
          },
          {
            id: "salpicon-frutas",
            name: "Salpicón de frutas",
            priceEuros: 6,
          },
          { id: "banana-split", name: "Banana split", priceEuros: 7.5 },
        ],
      },
    ],
  },
  {
    id: "bebidas",
    label: "Bebidas",
    sections: [
      {
        id: "cafes",
        title: "Cafés",
        items: [
          { id: "cafe-solo", name: "Café solo", priceEuros: 1.8 },
          { id: "cafe-leche", name: "Café con leche", priceEuros: 2 },
          { id: "capuchino", name: "Capuchino", priceEuros: 3 },
          { id: "infusiones", name: "Infusiones", priceEuros: 2 },
          { id: "colacao", name: "Colacao", priceEuros: 3 },
          { id: "milo", name: "Milo", priceEuros: 3.3 },
        ],
      },
      {
        id: "para-beber",
        title: "Para beber",
        items: [
          { id: "cana", name: "Caña", priceEuros: 2 },
          { id: "doble", name: "Doble", priceEuros: 3 },
          { id: "jarra", name: "Jarra", priceEuros: 4.1 },
          { id: "vermut", name: "Vermut", priceEuros: 4 },
          { id: "tinto-verano", name: "Tinto de verano", priceEuros: 4 },
          { id: "calimocho", name: "Calimocho", priceEuros: 4.5 },
          {
            id: "cerveza-victoria",
            name: "Cerveza Victoria",
            priceEuros: 3,
          },
          { id: "cerveza-corona", name: "Corona", priceEuros: 3.5 },
          {
            id: "cerveza-club-colombia",
            name: "Club Colombia",
            priceEuros: 3.7,
          },
          { id: "cerveza-polar", name: "Polar", priceEuros: 3.5 },
          {
            id: "otros-tercios",
            name: "Otros tercios",
            description: "Selecciona tarifa según marca servida",
            priceEuros: null,
            modifiers: [
              {
                id: "tarifa-tercio",
                label: "Tarifa",
                options: [
                  { id: "t3", label: "Tarifa 3,00 €", priceEuros: 3 },
                  { id: "t33", label: "Tarifa 3,30 €", priceEuros: 3.3 },
                  { id: "t35", label: "Tarifa 3,50 €", priceEuros: 3.5 },
                ],
              },
            ],
          },
          {
            id: "refrescos-350",
            name: "Refrescos 350 ml",
            priceEuros: 3,
          },
          {
            id: "refrescos-postobon",
            name: "Refrescos Postobón",
            priceEuros: 3,
            modifiers: [
              {
                id: "sabor-postobon",
                label: "Sabor",
                options: postobonSabores,
              },
            ],
          },
          { id: "jugos-hit", name: "Jugos Hit", priceEuros: 2.7 },
          { id: "bitter-kas", name: "Bitter Kas", priceEuros: 3 },
          { id: "zumos", name: "Zumos", priceEuros: 2.9 },
          { id: "agua", name: "Agua", priceEuros: 2 },
          { id: "agua-gas", name: "Agua con gas", priceEuros: 3 },
        ],
      },
      {
        id: "cocteles",
        title: "Cócteles",
        items: [
          { id: "mojito", name: "Mojito", priceEuros: 8.5 },
          {
            id: "mojito-maracuya",
            name: "Mojito de maracuyá",
            priceEuros: 8.5,
          },
          {
            id: "pina-colada",
            name: "Piña colada",
            note: "Preparado al momento en su piña entera",
            priceEuros: 11.9,
          },
          { id: "margarita", name: "Margarita", priceEuros: 8.5 },
          {
            id: "sex-on-the-beach",
            name: "Sex on the beach",
            priceEuros: 8.5,
          },
          {
            id: "tequila-sunrise",
            name: "Tequila sunrise",
            priceEuros: 8.5,
          },
          {
            id: "coco-loco",
            name: "Coco loco",
            note: "Preparado al momento en su coco",
            priceEuros: 11.9,
          },
          { id: "aperol-spritz", name: "Aperol spritz", priceEuros: 7.5 },
          { id: "sangria-1l", name: "Sangría 1 L", priceEuros: 9.9 },
        ],
      },
      {
        id: "zumos-artesanales",
        title: "Zumos artesanales naturales",
        items: [
          {
            id: "zumo-artesanal",
            name: "Zumo artesanal natural",
            description: "Preparado al momento",
            note: "Elige sabor y base (agua o leche)",
            priceEuros: null,
            modifiers: [
              {
                id: "sabor-zumo",
                label: "Sabor",
                options: zumoSabores,
              },
              {
                id: "base-zumo",
                label: "Base",
                options: [
                  { id: "agua", label: "En agua", priceEuros: 5 },
                  { id: "leche", label: "En leche", priceEuros: 6 },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "copas",
    label: "Copas",
    sections: [
      {
        id: "ron",
        title: "Ron",
        items: [
          { id: "ron-barcelo", name: "Barceló", priceEuros: null },
          { id: "ron-brugal", name: "Brugal", priceEuros: null },
          { id: "ron-cacique", name: "Cacique", priceEuros: null },
          { id: "ron-gran-reserva", name: "Gran reserva", priceEuros: null },
          {
            id: "ron-viejo-caldas",
            name: "Ron viejo de Caldas",
            priceEuros: null,
          },
          { id: "ron-bacardi", name: "Bacardí", priceEuros: null },
        ],
      },
      {
        id: "whisky",
        title: "Whisky",
        items: [
          { id: "whisky-dyc", name: "Dyc", priceEuros: null },
          { id: "whisky-jb", name: "JB", priceEuros: null },
          {
            id: "whisky-jack-daniels",
            name: "Jack Daniel's",
            priceEuros: null,
          },
          { id: "whisky-red-label", name: "Red Label", priceEuros: null },
          { id: "whisky-black-label", name: "Black Label", priceEuros: null },
          { id: "whisky-ballantines", name: "Ballantine's", priceEuros: null },
          { id: "whisky-chivas", name: "Chivas", priceEuros: null },
          { id: "whisky-cardhu", name: "Cardhu", priceEuros: null },
        ],
      },
      {
        id: "vodka",
        title: "Vodka",
        items: [{ id: "vodka-absolut", name: "Absolut", priceEuros: null }],
      },
      {
        id: "tequila",
        title: "Tequila",
        items: [
          { id: "tequila-cuervo", name: "José Cuervo", priceEuros: null },
        ],
      },
      {
        id: "ginebra",
        title: "Ginebra",
        items: [
          { id: "gin-seagrams", name: "Seagram's", priceEuros: null },
          { id: "gin-larius", name: "Larius", priceEuros: null },
          { id: "gin-beefeater", name: "Beefeater", priceEuros: null },
          { id: "gin-nordes", name: "Nordés", priceEuros: null },
          { id: "gin-tanqueray", name: "Tanqueray", priceEuros: null },
          {
            id: "gin-puerto-indias",
            name: "Puerto de Indias",
            priceEuros: null,
          },
        ],
      },
      {
        id: "licores",
        title: "Licores",
        items: [
          { id: "licor-jagermeister", name: "Jägermeister", priceEuros: null },
          { id: "licor-baileys", name: "Baileys", priceEuros: null },
          { id: "licor-limoncello", name: "Limoncello", priceEuros: null },
          { id: "licor-pacharan", name: "Pacharán", priceEuros: null },
          {
            id: "licor-crema-orujo",
            name: "Crema de orujo",
            priceEuros: null,
          },
          {
            id: "licor-hierbas",
            name: "Licor de hierbas",
            priceEuros: null,
          },
          { id: "licor-cafe", name: "Licor de café", priceEuros: null },
        ],
      },
      {
        id: "sin-alcohol-sabores",
        title: "Sin alcohol (cócteles)",
        items: [
          { id: "mock-melocoton", name: "Melocotón", priceEuros: null },
          { id: "mock-mora", name: "Mora", priceEuros: null },
          { id: "mock-manzana", name: "Manzana", priceEuros: null },
        ],
      },
      {
        id: "aguardiente",
        title: "Aguardiente antioqueño",
        items: [
          { id: "aguardiente-azul", name: "Tapa azul", priceEuros: null },
          { id: "aguardiente-verde", name: "Tapa verde", priceEuros: null },
          { id: "aguardiente-roja", name: "Tapa roja", priceEuros: null },
          { id: "aguardiente-amarillo", name: "Amarillo", priceEuros: null },
        ],
      },
    ],
  },
  {
    id: "mascotas",
    label: "Mascotas",
    sections: [
      {
        id: "snacks-mascotas",
        title: "Para ellos también",
        items: [
          {
            id: "chuches-perro",
            name: "Chuches suaves para perro",
            description: "Bolsa pequeña; consultar marcas del día",
            priceEuros: 2.5,
            forPets: true,
          },
          {
            id: "agua-mascota",
            name: "Chapuzón de agua fresca",
            description: "Cuenco limpio con agua para tu compi de cuatro patas",
            priceEuros: 0,
            forPets: true,
          },
        ],
      },
    ],
  },
];
