import type { Vehiculo, Testimonio } from "@/types";

// Imágenes de testimonios - reemplazar con las reales cuando estén disponibles
import imgPuma208 from "@/assets/IMG_208.JPG.jpeg";
import imgFacundoEcosport from "@/assets/IMG_ecoSport.JPG.jpeg";

export const VEHICULOS_DESTACADOS: Vehiculo[] = [
  {
    id: 1,
    marca: "Toyota",
    modelo: "Hilux",
    nombre: "Toyota Hilux",
    year: 2023,
    km: "",
    img: "https://i.pinimg.com/736x/f2/a1/28/f2a128edfcd8556d8521a2bcdb0692f2.jpg",
    categoria: "Pick-up",
  },
  {
    id: 2,
    marca: "Fiat",
    modelo: "Cronos",
    nombre: "Fiat Cronos",
    year: 2023,
    km: "",
    img: "https://www.carone.com.ar/wp-content/uploads/2022/01/fiat-Cronos-Presicion.png",
    categoria: "Sedán",
  },
  {
    id: 3,
    marca: "Renault",
    modelo: "Kwid",
    nombre: "Renault Kwid",
    year: 2023,
    km: "",
    img: "https://infoplan.com.ar/wp-content/uploads/2024/12/Kwid.png",
    categoria: "Hatchback",
  },
];

export const TESTIMONIOS: Testimonio[] = [
  {
    id: 1,
    nombre: "Puma Mansillo",
    texto:
      "Excelente atención y transparencia. Compré mi Peugeot 208 aquí y la experiencia fue impecable. Súper recomendados.",
    rating: 5,
    imagen: imgPuma208,
    vehiculo: "Peugeot 208",
  },
  {
    id: 2,
    nombre: "Facundo Aguilera",
    texto:
      "Muy profesionales. Me asesoraron en todo el proceso y encontré mi EcoSport ideal. El trato fue excelente de principio a fin.",
    rating: 5,
    imagen: imgFacundoEcosport,
    vehiculo: "Ford EcoSport",
  },
  {
    id: 3,
    nombre: "María Luz Sosa",
    texto:
      "Gran stock de usados en excelente estado. Me ayudaron con la financiación y todo fue muy transparente.",
    rating: 5,
  },
];

export const INFO_CONTACTO = {
  telefonos: ["+54 9 2643 16-0888"],
  email: "ventas@diparola.com.ar",
  direccion: "Av. Principal 1234, CABA",
  horario: "Lunes a Sábado de 09 a 19hs",
  whatsapp: "+5492643160888",
  redes: {
    instagram: "https://instagram.com/diparola",
    facebook: "https://facebook.com/diparola",
  },
};
