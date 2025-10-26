// compilePDF.js

//import { PDFDocument, rgb, StandardFonts } from './../libs/pdf-lib.min.js';
//import { PDFDocument, rgb, StandardFonts } from 'https://cdn.skypack.dev/pdf-lib';
import { PDFDocument, rgb } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import fontkit from 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm'



/**
 * Prende un oggetto e un path tipo 'sections[8].notes' e ritorna il valore.
 * @param {Object} obj - L'oggetto JSON
 * @param {string} path - Il path tipo 'sections[8].notes'
 * @returns valore corrispondente o undefined
 */
export const getValueByPath = (obj, path) => {
    if (!obj || !path) return undefined;

    // Trasforma 'sections[8].notes' in ['sections', '8', 'notes']
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
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
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
            if (att.data || att.image || att.file) {
                const base64 = att.data || att.image || att.file;
                if (base64.startsWith('data:image')) {
                    images.push(base64);
                }
            }
        }
    }
    return images;
};

/**
 * Compila PDF: scrive testo e check sul PDF esistente e aggiunge immagini finali
 */
export const compilePDF = async (prototype) => {
    if (!prototype.pdfBase64) {
        console.error('❌ Nessun pdfBase64 nel prototipo.');
        return;
    }

    const pdfBytes = base64ToArrayBuffer(prototype.pdfBase64);
    const pdfDoc = await PDFDocument.load(pdfBytes);


    // --- 2. Registra fontkit e carica il tuo font ---
    pdfDoc.registerFontkit(fontkit);
    const urlFont = './resources/font/IndieFlower-Regular.ttf'; // o NanumPenScript-Regular.ttf
    const fontBytes = await fetch(urlFont).then(res => res.arrayBuffer());
    const font = await pdfDoc.embedFont(fontBytes);   

    const pages = pdfDoc.getPages();

    // 1️⃣ Scrittura dei campi
    if (Array.isArray(prototype.compile)) {
        for (const field of prototype.compile) {
            const value = getValueByPath(prototype, field.value) || '';
            const pageIndex = (field.page || 1) - 1;
            const page = pages[pageIndex] || pages[pages.length - 1];
            const { width, height } = page.getSize();

            const color = field.color || rgb(0, 0, 1);

            console.log(`🖊️ Scrivo sul PDF: "${value}" in (${field.x}, ${field.y}) sulla pagina ${pageIndex + 1}`);
            

            if (field.type === 'text') {
                page.drawText(String(value), {
                    x: field.x,
                    y: height - field.y,
                    size: field.fontSize || 10,
                    font,
                    color,
                });
            } else if (field.type === 'check' && value === true) {
                page.drawRectangle({
                    x: field.x,
                    y: height - field.y,
                    width: 8,
                    height: 8,
                    borderWidth: 1,
                    color,
                });
            }
        }
    }

    // 2️⃣ Aggiunta immagini dagli attachments
    const allImages = extractAllImages(prototype);
    console.log(allImages);
    
    if (allImages.length > 0) {
        let currentPage = pdfDoc.addPage();
        let { width, height } = currentPage.getSize();
        let yPos = height - 100;

        for (const imgBase64 of allImages) {
            try {
                const imgBytes = base64ToArrayBuffer(imgBase64);
                let image;

                if (imgBase64.startsWith('data:image/png')) {
                    image = await pdfDoc.embedPng(imgBytes);
                } else {
                    image = await pdfDoc.embedJpg(imgBytes);
                }

                const imgWidth = 200;
                const imgHeight = (image.height / image.width) * imgWidth;

                currentPage.drawImage(image, {
                    x: 50,
                    y: yPos - imgHeight,
                    width: imgWidth,
                    height: imgHeight,
                });

                yPos -= imgHeight + 30;
                if (yPos < 100) {
                    currentPage = pdfDoc.addPage();
                    ({ width, height } = currentPage.getSize());
                    yPos = height - 100;
                }
            } catch (err) {
                console.warn('⚠️ Errore nel caricamento immagine:', err);
            }
        }
    }

    // 3️⃣ Esportazione finale
    const compiledBytes = await pdfDoc.save();
    const blob = new Blob([compiledBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${prototype.nome.replace(/\s+/g, '_')}_compiled.pdf`;
    a.click();
    URL.revokeObjectURL(url);
};