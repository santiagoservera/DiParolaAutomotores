import type { Vehiculo, Testimonio } from "@/types";

// Imágenes de testimonios - reemplazar con las reales cuando estén disponibles
import imgPuma208 from "@/assets/IMG_208.JPG.jpeg";
import imgFacundoEcosport from "@/assets/IMG_ecoSport.JPG.jpeg";

export const VEHICULOS_DESTACADOS: Vehiculo[] = [
  {
    id: 1,
    marca: "Toyota",
    modelo: "Corolla 2.0 SEG",
    nombre: "Toyota Corolla 2.0 SEG",
    year: 2023,
    km: "15.000 km",
    img: "https://images.unsplash.com/photo-1648866892305-e63d20e5701d?q=80&w=1080",
    categoria: "Sedán",
  },
  {
    id: 2,
    marca: "Volkswagen",
    modelo: "Taos Highline",
    nombre: "Volkswagen Taos Highline",
    year: 2022,
    km: "22.000 km",
    img: "https://images.unsplash.com/photo-1602142514882-d7cda3781bab?q=80&w=1080",
    categoria: "SUV",
  },
  {
    id: 3,
    marca: "Ford",
    modelo: "Ranger Limited",
    nombre: "Ford Ranger Limited",
    year: 2021,
    km: "45.000 km",
    img: "https://images.unsplash.com/photo-1746047420047-03fc7a9b9226?q=80&w=1080",
    categoria: "Pick-up",
  },
  {
    id: 4,
    marca: "Honda",
    modelo: "Civic EXL",
    nombre: "Honda Civic EXL",
    year: 2020,
    km: "38.000 km",
    img: "https://images.unsplash.com/photo-1648866892305-e63d20e5701d?q=80&w=1080",
    categoria: "Sedán",
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
  telefonos: ["+54 11 1234-5678", "+54 11 8765-4321"],
  email: "ventas@diparola.com.ar",
  direccion: "Av. Principal 1234, CABA",
  horario: "Lunes a Sábado de 09 a 19hs",
  whatsapp: "+5491112345678",
  redes: {
    instagram: "https://instagram.com/diparola",
    facebook: "https://facebook.com/diparola",
  },
};
