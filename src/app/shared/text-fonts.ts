export const textFonts = [
  'Lato',
  'Ubuntu',
  'Anton',
  'Bebas Neue',
  'Oswald',
  'Montserrat',
  'Playfair Display',
  'Pacifico',
  'Lobster',
  'Permanent Marker',
  'Bangers',
  'Courier Prime',
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

const TEXT_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Ubuntu:wght@300;400;500;700&family=Anton&family=Bangers&family=Bebas+Neue&family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Lobster&family=Montserrat:ital,wght@0,400;0,700;1,400;1,700&family=Oswald:wght@400;700&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap';

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
