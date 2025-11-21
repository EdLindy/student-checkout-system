const PDFDocument = require('pdfkit');

function drawTableRow(doc, y, cols, widths) {
  const startX = doc.page.margins.left;
  for (let i = 0; i < cols.length; i++) {
    const x = startX + widths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(cols[i] || '', x + 2, y, { width: widths[i] - 4, continued: false });
  }
}

exports.handler = async (event) => {
  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const rows = Array.isArray(payload) ? payload : (payload.rows || []);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidths = [pageWidth * 0.25, pageWidth * 0.25, pageWidth * 0.2, pageWidth * 0.2, pageWidth * 0.1];

    doc.fontSize(16).text('Activity Log', { align: 'center' }).moveDown(0.5);
    doc.fontSize(10);

    let y = doc.y;
    const lineHeight = 16;

    // header
    drawTableRow(doc, y, ['Student', 'Destination', 'Checkout', 'Return', 'Duration'], colWidths);
    y += lineHeight;
    doc.moveTo(doc.page.margins.left, y - 6).lineTo(doc.page.width - doc.page.margins.right, y - 6).stroke();

    for (const r of rows) {
      const student = r.student || '';
      const destination = r.destination || '';
      const checkout = r.checkout ? new Date(r.checkout).toLocaleString() : '';
      const ret = r.return ? new Date(r.return).toLocaleString() : '';
      const duration = r.duration || '';

      // Estimate height needed for the student/destination cells (wrap)
      const maxLines = Math.max(
        Math.ceil(doc.widthOfString(student) / colWidths[0]),
        Math.ceil(doc.widthOfString(destination) / colWidths[1]),
        1
      );
      const blockHeight = Math.max(lineHeight * maxLines, lineHeight);

      if (y + blockHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.y;
        drawTableRow(doc, y, ['Student', 'Destination', 'Checkout', 'Return', 'Duration'], colWidths);
        y += lineHeight;
      }

      drawTableRow(doc, y, [student, destination, checkout, ret, duration], colWidths);
      y += blockHeight;
    }

    doc.end();

    await new Promise((resolve) => doc.on('end', resolve));
    const pdf = Buffer.concat(chunks);

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="activity-log.pdf"'
      },
      body: pdf.toString('base64')
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) })
    };
  }
};
