export const textFonts = [
  'Lato',
  'Ubuntu',
  'Poppins',
  'Roboto',
  'Montserrat',
  'Raleway',
  'Anton',
  'Bebas Neue',
  'Oswald',
  'Archivo Black',
  'Black Ops One',
  'Playfair Display',
  'Abril Fatface',
  'Pacifico',
  'Lobster',
  'Dancing Script',
  'Caveat',
  'Permanent Marker',
  'Bangers',
  'Righteous',
  'Courier Prime',
  'Rubik Storm',
  'Playwrite IT Trad',
  'Changa One',
  'Bungee',
  'Indie Flower',
  'Ruge Boogie',
];

export const textColors = [
  '#000000',
  '#ffffff',
  '#ff3c3c',
  '#ff9800',
  '#ffd600',
  '#00b170',
  '#2196f3',
  '#3f51b5',
  '#9c27b0',
  '#8b8b8b',
];

// Regular and bold (with their italics) of each font that has them
const TEXT_FONTS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Lato:ital,wght@0,400;0,700;1,400;1,700' +
  '&family=Ubuntu:ital,wght@0,400;0,700;1,400;1,700' +
  '&family=Poppins:ital,wght@0,400;0,700;1,400;1,700' +
  '&family=Roboto:ital,wght@0,400;0,700;1,400;1,700' +
  '&family=Montserrat:ital,wght@0,400;0,700;1,400;1,700' +
  '&family=Raleway:ital,wght@0,400;0,700;1,400;1,700' +
  '&family=Anton' +
  '&family=Bebas+Neue' +
  '&family=Oswald:wght@400;700' +
  '&family=Archivo+Black' +
  '&family=Black+Ops+One' +
  '&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700' +
  '&family=Abril+Fatface' +
  '&family=Pacifico' +
  '&family=Lobster' +
  '&family=Dancing+Script:wght@400;700' +
  '&family=Caveat:wght@400;700' +
  '&family=Permanent+Marker' +
  '&family=Bangers' +
  '&family=Righteous' +
  '&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700' +
  '&family=Rubik+Storm' +
  '&family=Playwrite+IT+Trad' +
  '&family=Changa+One:ital@0;1' +
  '&family=Bungee' +
  '&family=Indie+Flower' +
  '&family=Ruge+Boogie' +
  '&display=swap';

let textFontsLoaded: Promise<void> | null = null;

// The text tool fonts are only needed where texts are shown (designer, previews, print sheet):
// load them there instead of on every page. Resolves once their @font-face rules are known,
// also on failure (texts then fall back to another font)
export const loadTextFonts = (document: Document): Promise<void> => {
  if (textFontsLoaded) return textFontsLoaded;
  const link = document.createElement('link');
  link.id = 'text-fonts';
  link.rel = 'stylesheet';
  link.href = TEXT_FONTS_URL;
  textFontsLoaded = new Promise((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
  document.head.appendChild(link);
  return textFontsLoaded;
};
