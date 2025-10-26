// js/downloadWorksitePdf.js
export async function genPDF(worksite) {

    const { jsPDF } = window.jspdf; // ottieni jsPDF globale

    const doc = new jsPDF();

    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- Logo aziendale ---
    const logoUrl = './resources/img/LOGO-LEVRATTI.png';
    const img = new Image();
    img.crossOrigin = "anonymous"; // importante per evitare problemi CORS
    img.src = logoUrl;
    img.onload = () => {
        const logoWidth = 40;
        const logoHeight = (img.height / img.width) * logoWidth;
        doc.addImage(img, 'PNG', 20, y, logoWidth, logoHeight);

        // Titolo cantiere centrato rispetto alla pagina
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(worksite.nome || 'Cantiere', pageWidth / 2, y + logoHeight / 2 + 5, { align: 'center' });
        y += logoHeight + 10;

        // Descrizione cantiere
        if (worksite.descr) {
            doc.setFontSize(12);
            doc.setTextColor(80, 80, 80);
            doc.text(worksite.descr, 20, y);
            y += 10;
        }

        // Itera sulle sezioni
        for (const section of worksite.sections || []) {
            // Titolo sezione colorato
            doc.setFontSize(16);
            doc.setTextColor(0, 102, 204);
            doc.text(section.type.toUpperCase(), 20, y);
            y += 8;

            // Divider line
            doc.setDrawColor(0, 102, 204);
            doc.setLineWidth(0.5);
            doc.line(20, y, pageWidth - 20, y);
            y += 4;

            // Checklist
            if (section.type === 'checklist' && section.items) {
                section.items.forEach(item => {
                    doc.setFontSize(12);
                    doc.setTextColor(0, 0, 0);
                    doc.text(`- ${item.text}: ${item.value !== undefined ? item.value : ''}`, 25, y);
                    y += 6;
                    if (item.note && item.note.trim() !== '') {
                        doc.setFontSize(10);
                        doc.setTextColor(100, 100, 100);
                        doc.text(`  Nota: ${item.note}`, 30, y);
                        y += 6;
                    }
                });
                y += 4;
            }

            // Tabelle
            if (section.type === 'table' && section.items) {
                const tableData = section.items.map(i => [i.text, i.value || '', i.note || '']);
                doc.autoTable({
                    startY: y,
                    head: [['Campo', 'Valore', 'Note']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [0, 102, 204], textColor: 255 },
                    styles: { fontSize: 10 },
                    margin: { left: 20, right: 20 },
                });
                y = doc.lastAutoTable.finalY + 6;
            }

            // Allegati immagini
            if (section.attachments) {
                for (const att of section.attachments) {
                    if (att.data) {
                        try {
                            doc.addImage(att.data, 'PNG', 25, y, 60, 40);
                            y += 45;
                        } catch (err) {
                            console.error('Errore caricamento immagine:', att.name, err);
                        }
                    }
                }
            }

            // Firme
            if (section.type === 'signature' && section.signatures) {
                for (const sig of section.signatures) {
                    if (sig.signature) {
                        try {
                            doc.setFontSize(10);
                            doc.setTextColor(0, 0, 0);
                            doc.text(`Firma (${sig.role || 'utente'}):`, 25, y);
                            y += 3;
                            doc.addImage(sig.signature, 'PNG', 25, y, 50, 20);
                            y += 25;
                        } catch (err) {
                            console.error('Errore inserimento firma', err);
                        }
                    }
                }
                y += 10;
            }

            // Overflow pagina
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
        }

        // Salva PDF
        doc.save(`${worksite.nome.replace(/\s+/g, '_')}.pdf`);
    };

    img.onerror = () => {
        console.error('Errore caricamento logo');
    };


}
