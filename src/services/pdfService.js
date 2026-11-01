import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Convert integer amount to Indian currency words format (Rupees)
 */
export function numberToWordsINR(amount) {
  if (!amount || isNaN(amount)) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const num = Math.round(Number(amount));
  if (num === 0) return "Zero Rupees Only";

  const numStr = ("000000000" + num).slice(-9);
  const match = numStr.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!match) return `${num} Rupees Only`;

  let words = "";
  const crore = Number(match[1]);
  const lakh = Number(match[2]);
  const thousand = Number(match[3]);
  const hundred = Number(match[4]);
  const remainder = Number(match[5]);

  if (crore > 0) {
    words += (a[crore] || `${b[Math.floor(crore / 10)]} ${a[crore % 10]}`).trim() + " Crore ";
  }
  if (lakh > 0) {
    words += (a[lakh] || `${b[Math.floor(lakh / 10)]} ${a[lakh % 10]}`).trim() + " Lakh ";
  }
  if (thousand > 0) {
    words += (a[thousand] || `${b[Math.floor(thousand / 10)]} ${a[thousand % 10]}`).trim() + " Thousand ";
  }
  if (hundred > 0) {
    words += a[hundred] + " Hundred ";
  }
  if (remainder > 0) {
    if (words !== "") words += "and ";
    words += (a[remainder] || `${b[Math.floor(remainder / 10)]} ${a[remainder % 10]}`).trim() + " ";
  }

  return words.trim() + " Rupees Only";
}

/**
 * Generate a professional, GST-compliant Tax Invoice PDF and trigger browser download
 *
 * @param {Object} invoice - Invoice details (id, clientName, clientId, date, dueDate, amount, tax, total, status, category, paymentMethod)
 * @param {Object} company - Enterprise profile info (name, gstin, pan, email, phone, address)
 * @param {Object} clientExtra - Optional extra client data (address, gstin, contact)
 * @returns {Object} { fileName, doc }
 */
export function generateInvoicePDF(invoice, company = {}, clientExtra = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Default company info
  const companyInfo = {
    name: company.name || "LAXMI ENTERPRISES",
    tagline: company.tagline || "Industrial Supplies, Hardware & Trading",
    gstin: company.gstin || "27AAACL1234F1Z5",
    pan: company.pan || "AAACL1234F",
    phone: company.phone || "+91 98765 43210",
    email: company.email || "contact@laxmienterprises.com",
    address: company.address || "Shop No. 12, Commercial Complex, Near Industrial Estate, Pune - 411038, Maharashtra, India",
    state: "Maharashtra (Code: 27)",
    bankName: "State Bank of India (SBI)",
    bankBranch: "Pune Industrial Estate Branch",
    accountNumber: "398201554902",
    ifscCode: "SBIN0001245",
    accountName: "Laxmi Enterprises Commercial"
  };

  const invoiceAmount = Number(invoice.amount) || 0;
  const invoiceTax = Number(invoice.tax) || Math.round(invoiceAmount * 0.18);
  const invoiceTotal = Number(invoice.total) || (invoiceAmount + invoiceTax);
  const cgst = Math.round(invoiceTax / 2);
  const sgst = invoiceTax - cgst;

  // 1. TOP BRAND HEADER ACCENT BAR (Royal Sapphire)
  doc.setFillColor(0, 91, 181); // #005bb5
  doc.rect(0, 0, pageWidth, 8, "F");

  // Secondary Cyan Accent Line
  doc.setFillColor(0, 180, 216); // #00b4d8
  doc.rect(0, 8, pageWidth, 1.5, "F");

  let currentY = 16;

  // 2. COMPANY HEADER & INVOICE TITLE
  // Left: Company Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 43, 92); // Deep corporate navy
  doc.text(companyInfo.name, margin, currentY);

  currentY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(companyInfo.tagline, margin, currentY);

  currentY += 4.5;
  doc.setFontSize(8.5);
  doc.text(`${companyInfo.address}`, margin, currentY, { maxWidth: 105 });

  currentY += 7.5;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`GSTIN: ${companyInfo.gstin}  |  PAN: ${companyInfo.pan}`, margin, currentY);

  currentY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${companyInfo.phone}  |  Email: ${companyInfo.email}`, margin, currentY);

  // Right Side: TAX INVOICE BADGE & INVOICE METADATA
  const rightX = pageWidth - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 91, 181);
  doc.text("TAX INVOICE", rightX, 17, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("(Original for Recipient • GST Commercial)", rightX, 21.5, { align: "right" });

  // Metadata Card Box
  const metaBoxY = 24;
  const metaBoxW = 68;
  const metaBoxH = 26;
  const metaBoxX = pageWidth - margin - metaBoxW;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(metaBoxX, metaBoxY, metaBoxW, metaBoxH, 2, 2, "FD");

  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  // Invoice Number
  doc.setFont("helvetica", "bold");
  doc.text("Invoice No:", metaBoxX + 4, metaBoxY + 6);
  doc.setTextColor(0, 91, 181);
  doc.text(invoice.id, rightX - 4, metaBoxY + 6, { align: "right" });

  // Invoice Date
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  doc.text("Invoice Date:", metaBoxX + 4, metaBoxY + 11);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.date || new Date().toISOString().slice(0, 10), rightX - 4, metaBoxY + 11, { align: "right" });

  // Due Date
  doc.setFont("helvetica", "normal");
  doc.text("Due Date:", metaBoxX + 4, metaBoxY + 16);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.dueDate || "-", rightX - 4, metaBoxY + 16, { align: "right" });

  // Payment Status with Pill
  doc.setFont("helvetica", "normal");
  doc.text("Payment Status:", metaBoxX + 4, metaBoxY + 21);

  const statusText = (invoice.status || "Paid").toUpperCase();
  if (statusText === "PAID") {
    doc.setTextColor(16, 185, 129); // Green
  } else if (statusText === "PENDING") {
    doc.setTextColor(245, 158, 11); // Amber
  } else {
    doc.setTextColor(239, 68, 68); // Red
  }
  doc.setFont("helvetica", "bold");
  doc.text(statusText, rightX - 4, metaBoxY + 21, { align: "right" });

  // 3. SEPARATOR LINE
  currentY += 6;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // 4. BILL TO / SHIP TO & SUPPLIER BOXES
  currentY += 4;
  const colW = (contentWidth - 6) / 2;
  const boxH = 32;

  // Box 1: Supplier / Billed By
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, colW, boxH, 2, 2, "FD");

  // Box 1 Header
  doc.setFillColor(0, 91, 181);
  doc.roundedRect(margin, currentY, colW, 6, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("BILLED BY (SUPPLIER)", margin + 4, currentY + 4.2);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(companyInfo.name, margin + 4, currentY + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`GSTIN: ${companyInfo.gstin}`, margin + 4, currentY + 16);
  doc.text(`PAN: ${companyInfo.pan}`, margin + 4, currentY + 20);
  doc.text(`State: ${companyInfo.state}`, margin + 4, currentY + 24);
  doc.text(`Place of Supply: Maharashtra (27)`, margin + 4, currentY + 28);

  // Box 2: Billed To (Customer)
  const box2X = margin + colW + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(box2X, currentY, colW, boxH, 2, 2, "FD");

  // Box 2 Header
  doc.setFillColor(0, 43, 92);
  doc.roundedRect(box2X, currentY, colW, 6, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("BILLED TO (CUSTOMER / RECIPIENT)", box2X + 4, currentY + 4.2);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.clientName || "Valued Enterprise Client", box2X + 4, currentY + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Client ID: ${invoice.clientId || "CL-001"}`, box2X + 4, currentY + 16);
  doc.text(`GSTIN: ${clientExtra.gstin || "27AABCS1429B1Z2 (Registered)"}`, box2X + 4, currentY + 20);
  doc.text(`Location / City: ${clientExtra.city || "Pune / Maharashtra, India"}`, box2X + 4, currentY + 24);
  doc.text(`Payment Mode: ${invoice.paymentMethod || "NEFT / Commercial Transfer"}`, box2X + 4, currentY + 28);

  currentY += boxH + 6;

  // 5. ITEMIZED PARTICULARS TABLE (via jspdf-autotable)
  const categoryDesc = (invoice.category && !invoice.category.toLowerCase().includes("hardware") && !invoice.category.toLowerCase().includes("industrial")) ? invoice.category : "Animal Feed & Agro Supplies";
  const hsnMap = {
    "Hardware": "7318 (Industrial Fasteners & Screws)",
    "Electrical": "8544 (Insulated Cables & Fittings)",
    "Mechanical": "8481 (Taps, Cocks, Valves & Boiler Parts)",
    "Piping & Conduit": "7307 (Tube or Pipe Fittings of Iron/Steel)",
    "General": "8479 (Industrial Machinery & Equipment)"
  };
  const hsnCode = hsnMap[invoice.category] || "8481 / 7318";

  const tableBody = (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0)
    ? invoice.items.map((item, idx) => [
        String(idx + 1),
        item.description || item.name || `${categoryDesc} Item`,
        item.hsn || hsnCode,
        `${item.qty || 1} ${item.unit || "Nos"}`,
        `Rs. ${Number(item.rate || item.price || 0).toLocaleString("en-IN")}`,
        `Rs. ${Number(item.taxable || (Number(item.qty || 1) * Number(item.rate || item.price || 0))).toLocaleString("en-IN")}`,
        `${item.gstRate || 18}%`,
        `Rs. ${Number(item.total || 0).toLocaleString("en-IN")}`
      ])
    : [
        [
          "1",
          `${categoryDesc}\nCommercial industrial supplies lot as per order reference`,
          hsnCode,
          "1 Lot",
          `Rs. ${invoiceAmount.toLocaleString("en-IN")}`,
          `Rs. ${invoiceAmount.toLocaleString("en-IN")}`,
          "18% GST",
          `Rs. ${invoiceTotal.toLocaleString("en-IN")}`
        ]
      ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [
      [
        "#",
        "Item Description / Particulars",
        "HSN/SAC",
        "Qty",
        "Rate (INR)",
        "Taxable Value (INR)",
        "GST Rate",
        "Total Amount (INR)"
      ]
    ],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [0, 91, 181],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle"
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 58 },
      2: { cellWidth: 24, fontSize: 7, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 20, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 14, halign: "center" },
      7: { cellWidth: 22, halign: "right", fontStyle: "bold" }
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 3.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  const finalTableY = doc.lastAutoTable.finalY + 4;

  // 6. TOTALS & BREAKDOWN SUMMARY SECTION
  const summaryBoxW = 76;
  const summaryBoxX = pageWidth - margin - summaryBoxW;
  const summaryBoxY = finalTableY;

  // Totals Box
  const hasPaymentBreakdown = invoice.paidAmount !== undefined;
  const boxHeight = hasPaymentBreakdown ? 47 : 36;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxW, boxHeight, 2, 2, "FD");

  let lineY = summaryBoxY + 6;
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.text("Taxable Value (Subtotal):", summaryBoxX + 4, lineY);
  doc.setFont("helvetica", "bold");
  doc.text(`Rs. ${invoiceAmount.toLocaleString("en-IN")}`, rightX - 4, lineY, { align: "right" });

  // CGST (9%)
  lineY += 5;
  doc.setFont("helvetica", "normal");
  doc.text("CGST @ 9%:", summaryBoxX + 4, lineY);
  doc.setFont("helvetica", "bold");
  doc.text(`Rs. ${cgst.toLocaleString("en-IN")}`, rightX - 4, lineY, { align: "right" });

  // SGST (9%)
  lineY += 5;
  doc.setFont("helvetica", "normal");
  doc.text("SGST @ 9%:", summaryBoxX + 4, lineY);
  doc.setFont("helvetica", "bold");
  doc.text(`Rs. ${sgst.toLocaleString("en-IN")}`, rightX - 4, lineY, { align: "right" });

  // Total GST
  lineY += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Total Tax (GST 18%):", summaryBoxX + 4, lineY);
  doc.setFont("helvetica", "bold");
  doc.text(`Rs. ${invoiceTax.toLocaleString("en-IN")}`, rightX - 4, lineY, { align: "right" });

  // Grand Total Highlight Bar
  lineY += 4;
  doc.setFillColor(0, 91, 181);
  doc.roundedRect(summaryBoxX + 1.5, lineY, summaryBoxW - 3, 9, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL (INR):", summaryBoxX + 4, lineY + 6);
  doc.text(`Rs. ${invoiceTotal.toLocaleString("en-IN")}`, rightX - 4, lineY + 6, { align: "right" });

  if (hasPaymentBreakdown) {
    lineY += 12.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(5, 150, 105);
    doc.text("Amount Received / Paid:", summaryBoxX + 4, lineY);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${Number(invoice.paidAmount || 0).toLocaleString("en-IN")}`, rightX - 4, lineY, { align: "right" });

    lineY += 4.5;
    const balance = Number(invoice.balanceDue || 0);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(balance > 0 ? 220 : 5, balance > 0 ? 38 : 150, balance > 0 ? 38 : 105);
    doc.text("Remaining Balance Due:", summaryBoxX + 4, lineY);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${balance.toLocaleString("en-IN")}`, rightX - 4, lineY, { align: "right" });
  }

  // LEFT SIDE: AMOUNT IN WORDS & BANK DETAILS
  const leftW = contentWidth - summaryBoxW - 6;
  let leftY = summaryBoxY;

  // Amount in Words Card
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, leftY, leftW, 13, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 91, 181);
  doc.text("INVOICE AMOUNT IN WORDS (INR):", margin + 3.5, leftY + 4.5);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const wordsText = numberToWordsINR(invoiceTotal);
  doc.text(wordsText, margin + 3.5, leftY + 9.5, { maxWidth: leftW - 7 });

  // Bank Account & Remittance Card
  leftY += 16;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, leftY, leftW, 28, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 43, 92);
  doc.text("BANK DETAILS FOR WIRE / NEFT / RTGS PAYMENT:", margin + 3.5, leftY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Bank Name: ${companyInfo.bankName}`, margin + 3.5, leftY + 10);
  doc.text(`Account Name: ${companyInfo.accountName}`, margin + 3.5, leftY + 14);
  doc.text(`Account Number: ${companyInfo.accountNumber}`, margin + 3.5, leftY + 18);
  doc.text(`IFSC Code: ${companyInfo.ifscCode}  |  Branch: ${companyInfo.bankBranch}`, margin + 3.5, leftY + 22);

  // 7. TERMS & CONDITIONS AND AUTHORIZED SIGNATORY
  const bottomY = Math.max(summaryBoxY + 39, leftY + 31) + 4;

  // Terms & Conditions (Left)
  const termsW = leftW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("TERMS & CONDITIONS:", margin, bottomY + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text("1. All disputes are subject to Pune, Maharashtra jurisdiction only.", margin, bottomY + 8);
  doc.text("2. Payment is due within standard agreed credit period. Interest @ 18% p.a. chargeable on overdue accounts.", margin, bottomY + 11.5);
  doc.text("3. Goods once received and inspected cannot be returned without written authorization from Laxmi Enterprises.", margin, bottomY + 15);
  doc.text("4. Input Tax Credit (ITC) applicable as per GST Section 16 of CGST Act, 2017.", margin, bottomY + 18.5);

  // Authorized Signatory Block (Right)
  const signX = pageWidth - margin - 60;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 43, 92);
  doc.text(`For ${companyInfo.name}`, signX + 30, bottomY + 4, { align: "center" });

  // Stamp / Digital Seal Placeholder box
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(signX, bottomY + 7, 60, 13, 1, 1, "D");
  doc.setLineDashPattern([], 0); // Reset dash

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("[ Digitally Verified • Authorized Seal ]", signX + 30, bottomY + 15, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Authorized Signatory", signX + 30, bottomY + 24, { align: "center" });

  // 8. FOOTER NOTE
  const footerY = 286;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("This is an electronically generated GST Tax Invoice from Laxmi Enterprises ERP Portal. No physical signature required.", margin, footerY);
  doc.text("Page 1 of 1", rightX, footerY, { align: "right" });

  // Bottom Sapphire Brand Accent Line
  doc.setFillColor(0, 91, 181);
  doc.rect(0, 294, pageWidth, 3, "F");

  // Save PDF directly to user's computer
  const cleanId = (invoice.id || "INV").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${cleanId}_Laxmi_Enterprises_Invoice.pdf`;
  try {
    if (typeof window !== "undefined" && typeof doc.save === "function") {
      doc.save(fileName);
    }
  } catch (saveErr) {
    console.warn("doc.save skipped:", saveErr.message);
  }

  return { fileName, doc };
}

/**
 * Generate a professional, GST-compliant Inward Purchase Voucher & Payment Receipt PDF
 * Includes support for Partial Payments, Day 1 Data, Installment logs, and Agribusiness Sector specifics.
 *
 * @param {Object} purchase - Inward purchase record details
 * @param {Object} company - Enterprise profile info
 * @returns {Object} { fileName, doc }
 */
export function generatePurchaseInvoicePDF(purchase = {}, company = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Default company info
  const companyInfo = {
    name: company.name || "LAXMI ENTERPRISES",
    tagline: company.tagline || "Agribusiness, Cattle Feed & Industrial Supplies",
    gstin: company.gstin || "27AAACL1234F1Z5",
    pan: company.pan || "AAACL1234F",
    phone: company.phone || "+91 98765 43210",
    email: company.email || "contact@laxmienterprises.com",
    address: company.address || "Shop No. 12, Commercial Complex, Near Industrial Estate, Pune - 411038, Maharashtra, India",
    state: "Maharashtra (Code: 27)",
    bankName: "State Bank of India (SBI)",
    bankBranch: "Pune Industrial Estate Branch",
    accountNumber: "398201554902",
    ifscCode: "SBIN0001245",
    accountName: "Laxmi Enterprises Commercial"
  };

  const isFeed = purchase.category === "Animal Feed Shop";
  const isDairy = purchase.category === "Dairy";
  const isFarmer = purchase.category === "Farmers";

  const taxableAmount = Number(purchase.taxableAmount) || 0;
  const gstRate = Number(purchase.gstRate) || 0;
  const gstAmount = Number(purchase.gstAmount) || Math.round(taxableAmount * (gstRate / 100));
  const totalAmount = Number(purchase.totalAmount || purchase.total || purchase.grandTotal) || (taxableAmount + gstAmount);
  const paidAmount = Number(purchase.paidAmount || purchase.day1Amount) || 0;
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  const day1Amount = Number(purchase.day1Amount) || (purchase.paymentStatus === "Paid" ? totalAmount : paidAmount);
  const day1Date = purchase.day1Date || purchase.date || new Date().toISOString().slice(0, 10);
  const day1Method = purchase.day1Method || purchase.paymentMethod || "RTGS / Bank Transfer";
  const day1Ref = purchase.day1Ref || "";
  const day1Notes = purchase.day1Notes || "";

  // 1. BRAND ACCENT STRIPE (Agri Emerald Green & Sky Blue)
  doc.setFillColor(5, 150, 105); // Emerald Green #059669
  doc.rect(0, 0, pageWidth, 8, "F");

  doc.setFillColor(2, 132, 199); // Sky Blue #0284c7
  doc.rect(0, 8, pageWidth, 1.5, "F");

  let currentY = 16;

  // 2. COMPANY HEADER (BUYER / RECEIVING ENTERPRISE)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(5, 150, 105); // Emerald
  doc.text(companyInfo.name, margin, currentY);

  currentY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(companyInfo.tagline, margin, currentY);

  currentY += 4.5;
  doc.setFontSize(8.5);
  doc.text(`${companyInfo.address}`, margin, currentY, { maxWidth: 105 });

  currentY += 7.5;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`GSTIN: ${companyInfo.gstin}  |  PAN: ${companyInfo.pan}`, margin, currentY);

  currentY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${companyInfo.phone}  |  Email: ${companyInfo.email}`, margin, currentY);

  // Right Side: DOCUMENT BADGE & METADATA
  const rightX = pageWidth - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(5, 150, 105);
  doc.text("PURCHASE INVOICE & RECEIPT", rightX, 17, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("(Inward Agribusiness Procurement Voucher)", rightX, 21.5, { align: "right" });

  // Metadata Card Box
  const metaBoxY = 24;
  const metaBoxW = 72;
  const metaBoxH = 28;
  const metaBoxX = pageWidth - margin - metaBoxW;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(metaBoxX, metaBoxY, metaBoxW, metaBoxH, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  // PO Number
  doc.setFont("helvetica", "bold");
  doc.text("PO Ref No:", metaBoxX + 4, metaBoxY + 5.5);
  doc.setTextColor(5, 150, 105);
  doc.text(purchase.id || "-", rightX - 4, metaBoxY + 5.5, { align: "right" });

  // Bill Number
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  doc.text("Vendor Bill No:", metaBoxX + 4, metaBoxY + 10.5);
  doc.setFont("helvetica", "bold");
  doc.text(purchase.billNumber || "-", rightX - 4, metaBoxY + 10.5, { align: "right" });

  // Issue Date
  doc.setFont("helvetica", "normal");
  doc.text("Voucher Date:", metaBoxX + 4, metaBoxY + 15.5);
  doc.setFont("helvetica", "bold");
  doc.text(purchase.date || "-", rightX - 4, metaBoxY + 15.5, { align: "right" });

  // Due Date
  doc.setFont("helvetica", "normal");
  doc.text("Due Date:", metaBoxX + 4, metaBoxY + 20.5);
  doc.setFont("helvetica", "bold");
  doc.text(purchase.dueDate || "-", rightX - 4, metaBoxY + 20.5, { align: "right" });

  // Payment Status
  doc.setFont("helvetica", "normal");
  doc.text("Settlement Status:", metaBoxX + 4, metaBoxY + 25.5);

  const statusText = (purchase.paymentStatus || "Paid").toUpperCase();
  if (statusText === "PAID") {
    doc.setTextColor(16, 185, 129); // Green
  } else if (statusText === "PARTIAL") {
    doc.setTextColor(245, 158, 11); // Amber
  } else {
    doc.setTextColor(239, 68, 68); // Red
  }
  doc.setFont("helvetica", "bold");
  doc.text(statusText === "PARTIAL" ? "PARTIALLY PAID" : statusText, rightX - 4, metaBoxY + 25.5, { align: "right" });

  // 3. SEPARATOR LINE
  currentY += 6;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // 4. RECEIVING ENTERPRISE & SUPPLIER ENTITY CARDS
  currentY += 4;
  const colW = (contentWidth - 6) / 2;
  const boxH = 34;

  // Box 1: Receiving Enterprise (Buyer)
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, colW, boxH, 2, 2, "FD");

  // Box 1 Header
  doc.setFillColor(5, 150, 105);
  doc.roundedRect(margin, currentY, colW, 6, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("BUYER / RECEIVING ENTERPRISE", margin + 4, currentY + 4.2);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(companyInfo.name, margin + 4, currentY + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`GSTIN: ${companyInfo.gstin} | PAN: ${companyInfo.pan}`, margin + 4, currentY + 16);
  doc.text(`Phone: ${companyInfo.phone}`, margin + 4, currentY + 20);
  doc.text(`Delivery Location: Pune, Maharashtra (27)`, margin + 4, currentY + 24);
  doc.text(`Warehouse/Bay: ${purchase.remarks || "Central Silo Receiving Bay"}`, margin + 4, currentY + 28, { maxWidth: colW - 8 });

  // Box 2: Supplier Entity (Seller / Vendor)
  const box2X = margin + colW + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(box2X, currentY, colW, boxH, 2, 2, "FD");

  // Box 2 Header
  doc.setFillColor(2, 132, 199); // Sky blue
  doc.roundedRect(box2X, currentY, colW, 6, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`SUPPLIER ENTITY (${(purchase.category || "General").toUpperCase()})`, box2X + 4, currentY + 4.2);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(purchase.vendorName || purchase.name || "Vendor Partner", box2X + 4, currentY + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Contact Person: ${purchase.contactPerson || purchase.vendorName || "-"}`, box2X + 4, currentY + 16);
  doc.text(`Village: ${purchase.village || "-"}, Taluka: ${purchase.taluka || "-"}, Dist: ${purchase.district || "-"}`, box2X + 4, currentY + 20);
  doc.text(`Mobile: ${purchase.contact || "-"} ${purchase.email ? "| " + purchase.email : ""}`, box2X + 4, currentY + 24);
  doc.text(`Sector: ${purchase.category || "-"}`, box2X + 4, currentY + 28);

  currentY += boxH + 4;

  // 5. AGRIBUSINESS SECTOR SPECIFICATIONS BOX
  doc.setFillColor(254, 252, 232); // Light amber / warm
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, currentY, contentWidth, 15, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text("SECTOR INTELLIGENCE & PROCUREMENT SPECIFICATION:", margin + 4, currentY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  let specText = "";
  if (isFeed) {
    specText = `Brands: ${purchase.brands || "Standard"} | Companies: ${purchase.companies || "Feed Mfrs"} | Stock Volume: ${purchase.feedQuantity || "-"} | Network: ${purchase.numberOfAnimals || "-"}`;
  } else if (isDairy) {
    specText = `Milk Quantity: ${purchase.milkQuantity || "-"} | Suppliers: ${purchase.numberOfSuppliers || 0} Members | Quality: ${purchase.fatPercent || "-"}% Fat, ${purchase.snfPercent || "-"}% SNF | Base Rate: Rs. ${purchase.ratePerLiter || 38}/Ltr`;
  } else if (isFarmer) {
    specText = `Livestock: ${purchase.numberOfAnimals || 0} Animals (${purchase.animalDetails || "General Cattle"}) | Produce: ${purchase.farmItemsSupplied || "Green Silage"} | Volume: ${purchase.farmQuantity || "-"}`;
  } else {
    specText = `Description: ${purchase.itemDescription} | Sector Category: ${purchase.category}`;
  }
  doc.text(specText, margin + 4, currentY + 10, { maxWidth: contentWidth - 8 });

  currentY += 19;

  // 6. ITEM PROCUREMENT TABLE (via autoTable)
  const tableData = [
    [
      "1",
      `${purchase.itemDescription}\nSector: ${purchase.category} • Bill Ref: ${purchase.billNumber || "-"}`,
      purchase.category || "Commercial",
      `₹${taxableAmount.toLocaleString("en-IN")}`,
      `${gstRate}% (₹${gstAmount.toLocaleString("en-IN")})`,
      `₹${totalAmount.toLocaleString("en-IN")}`
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["#", "Item Description & Inward Consignment", "Category", "Taxable Inward", "GST Rate", "Gross Total"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [5, 150, 105], // Emerald
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "left"
    },
    styles: {
      fontSize: 7.8,
      cellPadding: 3.5,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 72 },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 24, halign: "right", fontStyle: "bold" }
    }
  });

  currentY = doc.lastAutoTable.finalY + 5;

  // 7. FINANCIAL SETTLEMENT & PARTIAL PAYMENT (DAY 1) BREAKDOWN
  const summaryBoxW = 76;
  const summaryBoxX = pageWidth - margin - summaryBoxW;
  const summaryBoxY = currentY;

  // Left Side: Partial Payment / Day 1 Card & Installment History
  const leftW = contentWidth - summaryBoxW - 6;
  let leftY = currentY;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, leftY, leftW, 36, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text("PARTIAL PAYMENT & DAY 1 SETTLEMENT DATA:", margin + 3.5, leftY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Day 1 Paid Outflow:`, margin + 3.5, leftY + 10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(`₹${day1Amount.toLocaleString("en-IN")}`, margin + 38, leftY + 10.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(`Day 1 Payment Date:`, margin + 3.5, leftY + 15);
  doc.setFont("helvetica", "bold");
  doc.text(`${day1Date}`, margin + 38, leftY + 15);

  doc.setFont("helvetica", "normal");
  doc.text(`Payment Mode / Route:`, margin + 3.5, leftY + 19.5);
  doc.setFont("helvetica", "bold");
  doc.text(`${day1Method}`, margin + 38, leftY + 19.5);

  if (day1Ref) {
    doc.setFont("helvetica", "normal");
    doc.text(`UTR / Cheque Ref No:`, margin + 3.5, leftY + 24);
    doc.setFont("helvetica", "bold");
    doc.text(`${day1Ref}`, margin + 38, leftY + 24);
  }

  doc.setFont("helvetica", "normal");
  doc.text(`Settlement Notes:`, margin + 3.5, leftY + 28.5);
  doc.text(`${day1Notes || purchase.remarks || "Direct vendor procurement clearance"}`, margin + 38, leftY + 28.5, { maxWidth: leftW - 42 });

  // Status Badge inside Left Card
  doc.setFont("helvetica", "bold");
  doc.text(`Clearance Status:`, margin + 3.5, leftY + 33);
  doc.setTextColor(purchase.paymentStatus === "Paid" ? 16 : 245, purchase.paymentStatus === "Paid" ? 185 : 158, purchase.paymentStatus === "Paid" ? 129 : 11);
  doc.text(`${purchase.paymentStatus} Settlement`, margin + 38, leftY + 33);

  // Right Side: Grand Total & Dues Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxW, 36, 2, 2, "FD");

  let sumRowY = summaryBoxY + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Taxable Inward:", summaryBoxX + 4, sumRowY);
  doc.text(`₹${taxableAmount.toLocaleString("en-IN")}`, rightX - 4, sumRowY, { align: "right" });

  sumRowY += 4.5;
  doc.text(`GST (${gstRate}%):`, summaryBoxX + 4, sumRowY);
  doc.text(`₹${gstAmount.toLocaleString("en-IN")}`, rightX - 4, sumRowY, { align: "right" });

  sumRowY += 5;
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryBoxX + 3, sumRowY - 1, rightX - 3, sumRowY - 1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105);
  doc.text("Gross Inward Value:", summaryBoxX + 4, sumRowY + 3.5);
  doc.text(`₹${totalAmount.toLocaleString("en-IN")}`, rightX - 4, sumRowY + 3.5, { align: "right" });

  sumRowY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(16, 185, 129);
  doc.text("Paid Outflow (Day 1 / Advance):", summaryBoxX + 4, sumRowY + 2);
  doc.text(`₹${paidAmount.toLocaleString("en-IN")}`, rightX - 4, sumRowY + 2, { align: "right" });

  sumRowY += 6.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  if (balanceDue > 0) {
    doc.setTextColor(239, 68, 68); // Red
    doc.text("Outstanding Balance Due:", summaryBoxX + 4, sumRowY + 2);
    doc.text(`₹${balanceDue.toLocaleString("en-IN")}`, rightX - 4, sumRowY + 2, { align: "right" });
  } else {
    doc.setTextColor(16, 185, 129); // Green
    doc.text("Balance Due:", summaryBoxX + 4, sumRowY + 2);
    doc.text("₹0 (Fully Cleared)", rightX - 4, sumRowY + 2, { align: "right" });
  }

  // 8. AMOUNT IN WORDS
  currentY = Math.max(summaryBoxY + 38, leftY + 38) + 3;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 9, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Total Value in Words:", margin + 3.5, currentY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(numberToWordsINR(totalAmount), margin + 35, currentY + 5.5, { maxWidth: contentWidth - 40 });

  currentY += 12;

  // 9. BANK DETAILS & TERMS (Bottom Section)
  const bottomW = (contentWidth - 6) / 2;
  const bottomH = 24;

  // Bank Details (Left)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, bottomW, bottomH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105);
  doc.text("BANK ACCOUNT FOR RTGS / NEFT REMITTANCE:", margin + 3.5, currentY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(`Bank Name: ${companyInfo.bankName}`, margin + 3.5, currentY + 9);
  doc.text(`Account Name: ${companyInfo.accountName}`, margin + 3.5, currentY + 13);
  doc.text(`Account No: ${companyInfo.accountNumber}  |  IFSC: ${companyInfo.ifscCode}`, margin + 3.5, currentY + 17);
  doc.text(`Branch: ${companyInfo.bankBranch}`, margin + 3.5, currentY + 21);

  // Authorized Signatory Block (Right)
  const signX = margin + bottomW + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(signX, currentY, bottomW, bottomH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`For ${companyInfo.name}`, signX + bottomW / 2, currentY + 5, { align: "center" });

  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(signX + 15, currentY + 7.5, bottomW - 30, 9, 1, 1, "D");
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("[ Digitally Verified • Inward Gate Entry ]", signX + bottomW / 2, currentY + 13.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text("Authorized Inward Procurement Officer", signX + bottomW / 2, currentY + 21, { align: "center" });

  // 10. FOOTER NOTE & BRAND STRIPE
  const footerY = 286;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("This is an electronically generated Inward Purchase Voucher & Payment Receipt from Laxmi Enterprises ERP Portal.", margin, footerY);
  doc.text("Page 1 of 1", rightX, footerY, { align: "right" });

  doc.setFillColor(5, 150, 105); // Emerald accent bottom
  doc.rect(0, 294, pageWidth, 3, "F");

  // Save PDF directly to user's computer
  const cleanId = (purchase.id || "PUR").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${cleanId}_Purchase_Receipt.pdf`;
  try {
    if (typeof window !== "undefined" && typeof doc.save === "function") {
      doc.save(fileName);
    }
  } catch (saveErr) {
    console.warn("doc.save skipped:", saveErr.message);
  }

  return { fileName, doc };
}

// Alias for receipt download
export const generatePurchaseReceiptPDF = generatePurchaseInvoicePDF;

