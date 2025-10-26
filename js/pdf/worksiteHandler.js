// worksiteHandler.js
import { genPDF } from './genPDF.js';
import { compilePDF } from './compilePDF.js';

export const downloadWorksite = async (prototype) => {
  if (prototype.prototypeType === 'generate') {
    genPDF(prototype);
  } else if (prototype.prototypeType === 'pre_filled') {

    const res = await fetch(`./prototypes/cantiere_enel_pre_filled.json`);
    let prototypeData = null;
    if (res.ok) prototypeData = await res.json();
    //compilePDF(prototypeData);

    compilePDF(prototype);
  } else {
    console.warn('Tipo prototipo non riconosciuto');
  }
};
