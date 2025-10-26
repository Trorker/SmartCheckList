// compilePDF.js
import { PDFDocument, rgb } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import fontkit from 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm';

/**
 * Prende un oggetto e un path tipo 'sections[8].items[2].value' e ritorna il valore.
 */
export const getValueByPath = (obj, path) => {
    if (!obj || !path) return undefined;
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (let part of parts) {
        if (current[part] === undefined) return undefined;
        current = current[part];
    }
    return current;
};

/**
 * Converte Base64 in ArrayBuffer
 */
const base64ToArrayBuffer = (base64) => {
    // Rimuove eventuale prefisso "data:image/...;base64,"
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

    // Decodifica
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};


/**
 * Estrae tutte le immagini (Base64) dalle sezioni → attachments
 */
const extractAllImages = (prototype) => {
    const images = [];
    if (!prototype.sections) return images;
    for (const section of prototype.sections) {
        if (!section.attachments) continue;
        for (const att of section.attachments) {
            const base64 = att.data || att.image || att.file;
            if (base64 && base64.startsWith('data:image')) images.push(base64);
        }
    }
    return images;
};

/**
 * Compila PDF: scrive testo, checkboxes, note e immagini
 */
export const compilePDF = async (prototype) => {
    if (!prototype.pdfBase64) {
        console.error('❌ Nessun pdfBase64 nel prototipo.');
        return;
    }

    const pdfBytes = base64ToArrayBuffer(prototype.pdfBase64);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // --- font ---
    pdfDoc.registerFontkit(fontkit);
    const urlFont = './resources/font/IndieFlower-Regular.ttf';
    const fontBytes = await fetch(urlFont).then(res => res.arrayBuffer());
    const font = await pdfDoc.embedFont(fontBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width: pageWidth, height: pageHeight } = firstPage.getSize();

    // --- Logo azienda ---
    /*try {
        const logoUrl = './resources/img/LOGO-LEVRATTI.png';
        const logoBytes = await fetch(logoUrl).then(r => r.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoWidth = 120;
        const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
        firstPage.drawImage(logoImage, { x: 50, y: pageHeight - 80, width: logoWidth, height: logoHeight });
    } catch (err) {
        console.warn('⚠️ Errore caricamento logo:', err);
    }*/

    // --- Campi testuali e checkboxes ---
    if (Array.isArray(prototype.compile)) {
        for (const field of prototype.compile) {
            const value = getValueByPath(prototype, field.value) || '';
            const pageIndex = (field.page || 1) - 1;
            const page = pages[pageIndex] || pages[pages.length - 1];
            const { width, height } = page.getSize();
            const color = field.color || rgb(0, 0, 1);

            //console.log(field, value)


            if (field.type === 'text') {
                page.drawText(String(value), {
                    x: field.x,
                    y: height - field.y,
                    size: field.fontSize || 10,
                    font,
                    color,
                });
            } else if (field.type === 'check' /*&& (value === 'C' || value === 'N.C.' || value === 'N.A.')*/) {
                // checkbox per "C", "N.C.", "N.A."
                let offsetX = 0;
                if (value === 'C') offsetX = 0;
                else if (value === 'N.C.') offsetX = 25; // piccolo scostamento centrale
                else if (value === 'N.A.') offsetX = 50;

                page.drawText('X', {
                    x: field.x + offsetX,
                    y: height - field.y,
                    size: field.fontSize || 20,
                    font,
                    color,
                });
            } else if (field.type === 'signature' && value) {
                try {
                    // value deve essere un Base64 tipo 'data:image/png;base64,...'
                    const sigBytes = base64ToArrayBuffer(value);
                    let sigImage;

                    if (value.startsWith('data:image/png')) {
                        sigImage = await pdfDoc.embedPng(sigBytes);
                    } else if (value.startsWith('data:image/jpeg') || value.startsWith('data:image/jpg')) {
                        sigImage = await pdfDoc.embedJpg(sigBytes);
                    } else {
                        console.warn('Formato firma non supportato:', value);
                        continue;
                    }

                    // Dimensione firma
                    const sigWidth = field.width || 150;
                    const sigHeight = (sigImage.height / sigImage.width) * sigWidth;

                    page.drawImage(sigImage, {
                        x: field.x,
                        y: height - field.y - sigHeight, // y parte dal basso
                        width: sigWidth,
                        height: sigHeight,
                    });

                } catch (err) {
                    console.warn('Errore caricamento firma:', err);
                }
            }
        }
    }

    // --- Immagini ---
    const allImages = extractAllImages(prototype);
    if (allImages.length > 0) {
        let currentPage = pdfDoc.addPage();
        let { width, height } = currentPage.getSize();
        let imgY = height - 100;

        for (const imgBase64 of allImages) {
            try {
                const imgBytes = base64ToArrayBuffer(imgBase64);
                let image;
                if (imgBase64.startsWith('data:image/png')) image = await pdfDoc.embedPng(imgBytes);
                else if (imgBase64.startsWith('data:image/jpeg') || imgBase64.startsWith('data:image/jpg')) image = await pdfDoc.embedJpg(imgBytes);
                else continue;

                const imgWidth = 200;
                const imgHeight = (image.height / image.width) * imgWidth;

                currentPage.drawImage(image, { x: 50, y: imgY - imgHeight, width: imgWidth, height: imgHeight });
                imgY -= imgHeight + 30;

                if (imgY < 100) {
                    currentPage = pdfDoc.addPage();
                    ({ width, height } = currentPage.getSize());
                    imgY = height - 100;
                }
            } catch (err) {
                console.warn('⚠️ Errore caricamento immagine:', err);
            }
        }
    }

    // --- Esportazione PDF ---
    const compiledBytes = await pdfDoc.save();
    const blob = new Blob([compiledBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prototype.nome.replace(/\s+/g, '_')}_compiled.pdf`;
    a.click();
    URL.revokeObjectURL(url);
};
