// worksiteHandler.js
import { genPDF } from './genPDF.js';
import { compilePDF } from './compilePDF.js';

export const downloadWorksite = async (prototype) => {
  switch (prototype.prototypeType) {
    case 'generate':
      genPDF(prototype);
      break;

    case 'pre_filled':
      compilePDF(prototype);
      break;

    default:
      console.warn('Tipo prototipo non riconosciuto');
      break;
  }
};
