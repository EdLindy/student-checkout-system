const PDFDocument = require('pdfkit');

exports.handler = async (event) => {
  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const rows = Array.isArray(payload) ? payload : (payload.rows || []);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    // header
    doc.fontSize(16).text('Activity Log', { align: 'center' }).moveDown();
    doc.fontSize(10);

    // table header
    const startX = doc.x;
    const columnPositions = [startX, startX + 160, startX + 320, startX + 480];
    doc.text('Student', columnPositions[0], doc.y);
    doc.text('Destination', columnPositions[1], doc.y);
    doc.text('Checkout', columnPositions[2], doc.y);
    doc.text('Return', columnPositions[3], doc.y);
    doc.text('Duration', columnPositions[3] + 140, doc.y);
    doc.moveDown();

    for (const r of rows) {
      const student = r.student || '';
      const destination = r.destination || '';
      const checkout = r.checkout ? new Date(r.checkout).toLocaleString() : '';
      const ret = r.return ? new Date(r.return).toLocaleString() : '';
      const duration = r.duration || '';

      doc.text(student, columnPositions[0], doc.y, { width: 150 });
      doc.text(destination, columnPositions[1], doc.y, { width: 150 });
      doc.text(checkout, columnPositions[2], doc.y, { width: 150 });
      doc.text(ret, columnPositions[3], doc.y, { width: 150 });
      doc.text(duration, columnPositions[3] + 140, doc.y, { width: 100 });
      doc.moveDown();
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
