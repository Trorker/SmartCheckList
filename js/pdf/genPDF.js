// js/downloadWorksitePdf.js
export async function genPDF(worksite) {
  // usa jsPDF globale
  const { jsPDF } = window.jspdf;

  // impostazioni documento
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // helper per caricare immagine e ottenere dimensioni reali
  const loadImageDims = (dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
  };

  // helper aggiungi immagine scalata con max dimensioni (in mm)
  const addImageScaled = async (dataUrl, x, y, maxWmm, maxHmm) => {
    try {
      const dims = await loadImageDims(dataUrl);
      // convertiamo pixel -> mm per stima; non serve esatta perché usiamo ratio
      // ma calcoliamo ratio basato sui pixel
      const ratio = Math.min(maxWmm / dims.w, maxHmm / dims.h);
      const drawW = dims.w * ratio;
      const drawH = dims.h * ratio;

      // rileva tipo
      const m = dataUrl.match(/^data:image\/(png|jpeg|jpg)/i);
      const imgType = (m && m[1] && m[1].toLowerCase().startsWith('png')) ? 'PNG' : 'JPEG';
      doc.addImage(dataUrl, imgType, x, y, drawW, drawH);
      return { width: drawW, height: drawH };
    } catch (err) {
      console.warn('addImageScaled error', err);
      return null;
    }
  };

  // helper: se non c'è spazio sufficiente, aggiunge pagina e resetta y
  let y = margin;
  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // helper: testo a capo automatico all'interno di width
  const writeWrapped = (text, x, width, lineHeight = 6, size = 11, style = {}) => {
    doc.setFontSize(size);
    const splitted = doc.splitTextToSize(String(text || ''), width);
    for (const line of splitted) {
      ensureSpace(lineHeight + 1);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  // --- Header (logo + titolo) ---
  const logoUrl = './resources/img/LOGO-LEVRATTI.png';
  try {
    // proviamo a inserire logo (se presente)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = logoUrl;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => res(); // non bloccare se logo non c'è
    });

    // se img.width > 0 allora è caricata
    if (img.width) {
      const logoW = 30; // mm
      const logoH = (img.height / img.width) * logoW;
      doc.addImage(img, 'PNG', margin, y, logoW, logoH);
      // titolo centrato rispetto alla pagina
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(worksite.nome || 'Cantiere', pageWidth / 2, y + logoH / 2, { align: 'center' });
      y += logoH + 6;
    } else {
      // solo titolo se nessun logo
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(worksite.nome || 'Cantiere', pageWidth / 2, y + 6, { align: 'center' });
      y += 12;
    }
  } catch (err) {
    console.warn('Logo not loaded', err);
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(worksite.nome || 'Cantiere', pageWidth / 2, y + 6, { align: 'center' });
    y += 12;
  }

  // metadata worksite (indirizzo / comune / data / verificatore)
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const metaX = margin;
  const metaW = contentWidth;
  const metaLines = [
    `Descrizione: ${worksite.descr || ''}`,
    `Data: ${worksite.data || ''}`,
    `Indirizzo: ${worksite.worksite?.indirizzo || ''}`,
    `Comune: ${worksite.worksite?.comune || ''}`,
    `Impresa: ${worksite.worksite?.impresa || ''}`,
    `Verificatore: ${worksite.worksite?.verificatore || ''}`
  ];
  for (const l of metaLines) {
    ensureSpace(6);
    doc.text(l, metaX, y);
    y += 6;
  }
  y += 4;

  // --- Itera sulle sezioni ---
  for (const section of worksite.sections || []) {
    // titolo sezione
    ensureSpace(10);
    doc.setFontSize(14);
    doc.setTextColor(0, 102, 204);
    doc.text(section.title || (section.type || '').toUpperCase(), margin, y);
    y += 6;

    // divider
    ensureSpace(4);
    doc.setDrawColor(220);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // NOTES generali della sezione
    if (section.notes && section.notes.trim()) {
      doc.setFontSize(11);
      doc.setTextColor(50);
      writeWrapped(section.notes.trim(), margin + 4, contentWidth - 8, 6, 11);
      y += 4;
    }

    // TYPE: checklist
    if (section.type === 'checklist' && Array.isArray(section.items)) {
      for (const item of section.items) {
        ensureSpace(8);
        // checkbox
        const boxSize = 5;
        doc.rect(margin + 2, y - 4, boxSize, boxSize); // quadretto
        // se item.value è 'C' o true -> segno
        const val = item.value;
        if (val === true || String(val).toLowerCase() === 'c' || String(val).toLowerCase() === 'yes' || val === 'check' || val === '✓') {
          doc.setFontSize(12);
          doc.text('✓', margin + 2 + 1, y - 0.5);
        } else if (val && typeof val === 'string' && val !== 'C') {
          // scrivi valore testuale vicino al testo
          // verrà mostrato come "- testo : valore"
        }
        // testo item
        doc.setFontSize(11);
        doc.setTextColor(0);
        // disegna testo con wrap in area rimanente
        const textX = margin + 12;
        const textW = contentWidth - 12;
        const lines = doc.splitTextToSize(item.text || '', textW);
        for (const ln of lines) {
          ensureSpace(6);
          doc.text(ln, textX, y);
          y += 6;
        }
        // eventuale note dell'item
        if (item.note && item.note.trim()) {
          ensureSpace(5);
          doc.setFontSize(10);
          doc.setTextColor(100);
          const noteLines = doc.splitTextToSize('Nota: ' + item.note, textW - 8);
          for (const ln of noteLines) {
            doc.text(ln, textX + 4, y);
            y += 5;
          }
        }
        y += 2;
      }
      y += 4;
    }

    // TYPE: table
    if (section.type === 'table' && Array.isArray(section.items)) {
      // per ogni item (che rappresenta una tabella) creiamo un autoTable
      for (const it of section.items) {
        // intestazioni e righe
        const head = [it.columns || []];
        const body = Array.isArray(it.rows) ? it.rows : [];

        // se rows sono vuote, mostriamo una riga vuota o placeholder
        const tableStartY = y;
        doc.autoTable({
          startY: tableStartY,
          head: head,
          body: body,
          theme: 'grid',
          headStyles: { fillColor: [0, 102, 204], textColor: 255 },
          styles: { fontSize: 10 },
          margin: { left: margin, right: margin },
          tableWidth: contentWidth
        });
        y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 6 : tableStartY + 20;
      }
    }

    // Allegati immagini nella sezione (non signature)
    if (Array.isArray(section.attachments) && section.attachments.length) {
      for (const att of section.attachments) {
        if (!att.data) continue;
        // aggiungiamo immagine con max 80x60 mm
        ensureSpace(65);
        const added = await addImageScaled(att.data, margin + 5, y, 80, 60);
        if (added) y += added.height + 6;
        else y += 6;
      }
    }

    // TYPE: signature (firme)
    if (section.type === 'signature' && Array.isArray(section.signatures)) {
      for (const sig of section.signatures) {
        ensureSpace(30);
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(sig.role || 'Firma', margin + 2, y);
        y += 6;
        if (sig.signature) {
          // firma come image data url
          const added = await addImageScaled(sig.signature, margin + 2, y, 60, 25);
          if (added) y += added.height + 6;
          else y += 14;
        } else {
          // spazio vuoto per firma
          doc.setDrawColor(180);
          doc.setLineWidth(0.4);
          doc.line(margin + 2, y + 6, margin + 2 + 60, y + 6);
          y += 16;
        }
      }
      y += 6;
    }

    // spazio tra le sezioni
    y += 6;

    // overflow controllo finale per sezione
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  } // fine loop section

  // Alla fine: salva eventuali allegati generali (worksite.attachments) in appendice
  if (Array.isArray(worksite.attachments) && worksite.attachments.length) {
    doc.addPage();
    y = margin;
    doc.setFontSize(14);
    doc.text('Allegati', margin, y);
    y += 10;

    for (const att of worksite.attachments) {
      if (!att.data) continue;
      ensureSpace(70);
      const added = await addImageScaled(att.data, margin + 5, y, contentWidth - 10, pageHeight - margin - y);
      if (added) y += added.height + 6;
      else y += 8;
    }
  }

  // salva PDF (nome dal worksite)
  const filename = (worksite.nome && worksite.nome.trim()) ? `${worksite.nome.replace(/\s+/g, '_')}.pdf` : 'worksite.pdf';
  doc.save(filename);
}
