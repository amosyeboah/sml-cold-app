const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function buildPDF(outputPath) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 45, right: 45 },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const colors = {
    primary: '#1e3a8a',       // Deep Navy
    secondary: '#0284c7',     // Sky Blue
    accent: '#059669',        // Emerald
    dark: '#0f172a',          // Slate 900
    gray: '#475569',          // Slate 600
    lightBg: '#f8fafc',       // Slate 50
    border: '#cbd5e1',        // Slate 300
    cardBg: '#f1f5f9',        // Slate 100
  };

  // Helper: Section title
  function addSectionHeader(title, icon = '') {
    doc.moveDown(0.8);
    const y = doc.y;
    doc.rect(45, y, 4, 18).fill(colors.primary);
    doc.fillColor(colors.primary)
       .fontSize(13)
       .font('Helvetica-Bold')
       .text(`  ${icon} ${title}`, 52, y + 2);
    doc.moveDown(0.6);
  }

  // Header Banner
  doc.rect(45, 40, 505, 65).fill(colors.primary);
  doc.fillColor('#ffffff')
     .fontSize(16)
     .font('Helvetica-Bold')
     .text('SOFIYEM LEGACY LIMITED', 60, 52);
  doc.fontSize(10)
     .font('Helvetica')
     .text('COLD STORE INVENTORY ARCHITECTURE & OPERATIONAL GUIDE', 60, 72);
  doc.fontSize(8)
     .fillColor('#bae6fd')
     .text('Products, Inventory, Batches, Lots | Goods Inbound & Outbound POS Procedures', 60, 87);

  doc.y = 120;

  // 1. Conceptual Model
  addSectionHeader('1. Executive Conceptual Architecture: Product vs. Inventory vs. Batch vs. Lot');
  doc.fillColor(colors.gray)
     .fontSize(9)
     .font('Helvetica')
     .text(
       'In a commercial cold food depot (frozen fish, poultry, beef, turkey, dairy), accurate inventory management cannot rely on simple numbers alone. Cold food items are perishable, have strict expiry dates, and arrive in separate shipments with varying purchase costs. The platform structures inventory into a 4-tier hierarchy:',
       { align: 'justify', lineGap: 2 }
     );
  doc.moveDown(0.5);

  // Table of 4 tiers
  const tableData = [
    {
      term: 'PRODUCT (Master SKU)',
      def: 'The master definition of an item sold by the store (e.g., Atlantic Mackerel 20kg Carton, Titus Sardinella). Holds the barcode/SKU, category, name, and default prices. It does not expire itself; it is the catalog blueprint.',
    },
    {
      term: 'INVENTORY (Stock on Hand)',
      def: 'The live aggregate count of all physical cartons in the cold rooms available for sale. Formula: Total Inventory = Sum of all active, non-expired Batches for that Product. It represents the total store balance.',
    },
    {
      term: 'BATCH / LOT (Perishable Shipment)',
      def: 'A specific physical delivery of cartons received from a supplier on a specific date. Identified by a unique Batch Number / Lot ID, Expiry Date, Carton Quantity, and Unit Purchase Cost (₵). Enables food safety and cost tracking.',
    },
    {
      term: 'STOCK MOVEMENT (Audit Record)',
      def: 'The immutable transaction ledger recording every carton entering or leaving the cold store (RECEIVE, SALE, ADJUSTMENT, REFUND) with the user ID, role, and exact timestamp.',
    },
  ];

  tableData.forEach((row) => {
    const boxY = doc.y;
    doc.rect(45, boxY, 505, 34).fillAndStroke('#f8fafc', colors.border);
    doc.fillColor(colors.primary)
       .fontSize(8.5)
       .font('Helvetica-Bold')
       .text(row.term, 52, boxY + 5, { width: 140 });
    doc.fillColor(colors.dark)
       .fontSize(8)
       .font('Helvetica')
       .text(row.def, 195, boxY + 5, { width: 345, lineGap: 1.5 });
    doc.y = boxY + 38;
  });

  // Why Batches are Crucial
  doc.moveDown(0.3);
  doc.rect(45, doc.y, 505, 48).fillAndStroke('#ecfdf5', '#a7f3d0');
  doc.fillColor(colors.accent)
     .fontSize(9)
     .font('Helvetica-Bold')
     .text('WHY BATCH & LOT TRACKING IS ESSENTIAL FOR COLD STORES:', 55, doc.y + 6);
  doc.fillColor('#065f46')
     .fontSize(8)
     .font('Helvetica')
     .text(
       '1. FEFO Rule: Enforces First-Expired, First-Out so older cartons leave the cold room before newer stock.\n' +
       '2. Margin Accuracy: Locks in the exact purchase cost per shipment despite currency and freight fluctuations.\n' +
       '3. Food Safety: Prevents expired stock from being rung up at the checkout counter and isolates recalls.',
       55, doc.y + 18, { lineGap: 2 }
     );
  doc.y += 55;

  // 2. Receiving Goods (Inbound)
  addSectionHeader('2. Standard Operating Procedure: How Goods Are Received (Inbound Flow)');
  doc.fillColor(colors.gray)
     .fontSize(9)
     .font('Helvetica')
     .text(
       'When restock shipments arrive at the loading bay from frozen food suppliers, follow these 5 steps:',
       { lineGap: 1 }
     );
  doc.moveDown(0.4);

  const inboundSteps = [
    {
      num: 'STEP 1',
      title: 'Physical Dock Inspection',
      desc: 'Verify truck reefer temperature (-18°C or below). Inspect carton seals for defrosting. Record the Batch/Lot Number and Expiry Date printed on carton labels.',
    },
    {
      num: 'STEP 2',
      title: 'Open Purchases Module',
      desc: 'Log in as Admin or Manager. In the sidebar, select Purchases -> click "+ Record Restock Purchase".',
    },
    {
      num: 'STEP 3',
      title: 'Select Supplier & Reference',
      desc: 'Choose the Supplier from the dropdown. Enter the Supplier Delivery Note or Invoice Reference Number.',
    },
    {
      num: 'STEP 4',
      title: 'Add Items & Batch Information',
      desc: 'For each product unloaded:\n• Select Product (e.g., Horse Mackerel 20kg)\n• Enter Carton Batch/Lot # (e.g., LOT-2026-HM01)\n• Enter Expiry Date (must be in future)\n• Enter Received Quantity & Unit Cost (₵)\n• Click "+ Add Item"',
    },
    {
      num: 'STEP 5',
      title: 'Complete & Finalize Order',
      desc: 'Verify order totals. Click "Complete Purchase Order". The system instantly creates the Batch record, increments cold room stock, logs an Audit entry, and syncs to Supabase Cloud.',
    },
  ];

  inboundSteps.forEach((st) => {
    const boxY = doc.y;
    const h = st.num === 'STEP 4' ? 48 : 32;
    doc.rect(45, boxY, 505, h).fillAndStroke('#ffffff', '#e2e8f0');
    doc.fillColor(colors.secondary)
       .fontSize(8.5)
       .font('Helvetica-Bold')
       .text(st.num, 52, boxY + 6);
    doc.fillColor(colors.dark)
       .fontSize(8.5)
       .font('Helvetica-Bold')
       .text(st.title, 105, boxY + 6);
    doc.fillColor(colors.gray)
       .fontSize(8)
       .font('Helvetica')
       .text(st.desc, 105, boxY + 18, { width: 435, lineGap: 1.5 });
    doc.y = boxY + h + 4;
  });

  // PAGE 2
  doc.addPage();

  // 3. Selling Goods (Outbound POS)
  addSectionHeader('3. Standard Operating Procedure: How Goods Are Sold (Outbound POS Flow)');
  doc.fillColor(colors.gray)
     .fontSize(9)
     .font('Helvetica')
     .text(
       'At the checkout register, customer sales are rung up with automated FEFO batch depletion:',
       { lineGap: 1 }
     );
  doc.moveDown(0.4);

  const outboundSteps = [
    {
      num: 'STEP 1',
      title: 'Open POS Register',
      desc: 'The Cashier logs in using credentials or quick 4-Digit PIN. Open the POS register screen.',
    },
    {
      num: 'STEP 2',
      title: 'Scan or Select Products',
      desc: 'Scan carton barcode using handheld Bluetooth/USB scanner (triggers audio confirmation), or click the touch category grid (Fish, Poultry, Meat, Dairy), or type SKU in the search bar.',
    },
    {
      num: 'STEP 3',
      title: 'Automated FEFO Allocation',
      desc: 'The system automatically queries active non-expired batches and allocates cartons from the lot expiring earliest. Cashiers do not need to manually calculate or guess which lot to pull from.',
    },
    {
      num: 'STEP 4',
      title: 'Customer & Discounts (Optional)',
      desc: 'Select a customer profile for debt tracking or receipt assignment. Authorized staff can apply authorized line-item or cart discounts.',
    },
    {
      num: 'STEP 5',
      title: 'Payment & Receipt Printing',
      desc: 'Select Payment Rail: Cash (computes change & triggers cash drawer pulse), Mobile Money (MoMo reference), or Split Payment. Click "Complete Sale" to print 58mm/80mm thermal receipt.',
    },
    {
      num: 'STEP 6',
      title: 'Automatic Batch Deduction',
      desc: 'The system deducts sold quantities from the specific allocated Batch records, updates Product Inventory, flags Low Stock alerts if below threshold, and updates revenue reports.',
    },
  ];

  outboundSteps.forEach((st) => {
    const boxY = doc.y;
    doc.rect(45, boxY, 505, 34).fillAndStroke('#ffffff', '#e2e8f0');
    doc.fillColor(colors.accent)
       .fontSize(8.5)
       .font('Helvetica-Bold')
       .text(st.num, 52, boxY + 6);
    doc.fillColor(colors.dark)
       .fontSize(8.5)
       .font('Helvetica-Bold')
       .text(st.title, 105, boxY + 6);
    doc.fillColor(colors.gray)
       .fontSize(8)
       .font('Helvetica')
       .text(st.desc, 105, boxY + 18, { width: 435, lineGap: 1.5 });
    doc.y = boxY + 38;
  });

  // 4. Day-to-Day Operations & Inventory Exceptions
  addSectionHeader('4. Day-to-Day Cold Store Operations & Exceptions');

  const opsExceptions = [
    {
      title: 'Stock Recounts & Damage Adjustments (Defrost / Thawing)',
      text: 'If a carton is damaged or defrosted during freezer maintenance: Go to Inventory -> Adjust Stock -> select the Product and exact Batch/Lot -> enter adjustment (-1, -2) and reason (Defrost, Counting shrinkage). The system logs the audit trail and reduces batch stock.',
    },
    {
      title: 'Batch Expiry Monitoring & Cold Room Health',
      text: 'Use the Batch Tracking screen to filter lots by status:\n• Healthy (Green dot): More than 30 days to expiry.\n• Expiring Soon (Amber dot): 30 days or less remaining. Prioritize for wholesale promotions.\n• Expired (Red dot): Expired lot. Automatically locked from POS checkout to protect health compliance.',
    },
    {
      title: 'Customer Sales Returns & Refunds',
      text: 'When authorized by Admin: Go to Sales History -> select invoice -> click "Process Refund". The system returns the cartons back to their original Batch record, restores the inventory balance, and logs a reverse audit entry.',
    },
  ];

  opsExceptions.forEach((op) => {
    const boxY = doc.y;
    const h = op.title.includes('Monitoring') ? 48 : 36;
    doc.rect(45, boxY, 505, h).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fillColor(colors.primary)
       .fontSize(8.5)
       .font('Helvetica-Bold')
       .text(op.title, 52, boxY + 5);
    doc.fillColor(colors.dark)
       .fontSize(8)
       .font('Helvetica')
       .text(op.text, 52, boxY + 17, { width: 490, lineGap: 1.5 });
    doc.y = boxY + h + 4;
  });

  // 5. Summary Matrix Table
  doc.moveDown(0.4);
  addSectionHeader('5. Staff Quick Reference Cheat Sheet');

  const cheatY = doc.y;
  doc.rect(45, cheatY, 250, 65).fillAndStroke('#f0fdf4', '#86efac');
  doc.fillColor('#166534').fontSize(9).font('Helvetica-Bold').text('INBOUND: RECEIVING GOODS', 55, cheatY + 8);
  doc.fillColor('#14532d').fontSize(7.5).font('Helvetica').text(
    '1. Inspect vehicle temperature (-18°C).\n' +
    '2. Note Lot # and Expiry Date on cartons.\n' +
    '3. Go to Purchases -> Record Restock Purchase.\n' +
    '4. Enter Product, Lot, Expiry, Qty, Cost.\n' +
    '5. Click Save -> Stock balance increases!',
    55, cheatY + 22, { lineGap: 1.8 }
  );

  doc.rect(300, cheatY, 250, 65).fillAndStroke('#eff6ff', '#93c5fd');
  doc.fillColor('#1e40af').fontSize(9).font('Helvetica-Bold').text('OUTBOUND: SELLING GOODS', 310, cheatY + 8);
  doc.fillColor('#1e3a8a').fontSize(7.5).font('Helvetica').text(
    '1. Log into POS screen (Credentials or PIN).\n' +
    '2. Scan carton barcode or pick from catalog.\n' +
    '3. System FEFO engine automatically picks oldest lot.\n' +
    '4. Choose Cash, MoMo, or Split Payment.\n' +
    '5. Print Receipt -> Stock balance deducts!',
    310, cheatY + 22, { lineGap: 1.8 }
  );

  // Footer on all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.rect(45, 800, 505, 0.5).fill('#cbd5e1');
    doc.fillColor('#94a3b8')
       .fontSize(7.5)
       .font('Helvetica')
       .text('SOFIYEM Legacy Limited - Operational System Documentation | Confidential', 45, 806);
    doc.text(`Page ${i + 1} of ${range.count}`, 490, 806, { align: 'right' });
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

const targetPath = path.join(__dirname, '..', 'SOFIYEM_Cold_Store_Inventory_Guide.pdf');
buildPDF(targetPath)
  .then((p) => {
    console.log('PDF generated successfully at:', p);
    // Also copy to artifact directory if available
    const artifactDir = 'C:\\Users\\lenovo\\.gemini\\antigravity-ide\\brain\\23fdfb53-1a37-42fc-847b-e2166ebf0f17';
    if (fs.existsSync(artifactDir)) {
      const artPath = path.join(artifactDir, 'SOFIYEM_Cold_Store_Inventory_Guide.pdf');
      fs.copyFileSync(p, artPath);
      console.log('Copied to artifact directory:', artPath);
    }
  })
  .catch((err) => {
    console.error('Error generating PDF:', err);
    process.exit(1);
  });
