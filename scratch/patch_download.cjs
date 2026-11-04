const fs = require('fs');

// 1. Patch src/services/pdfService.js
let pdfService = fs.readFileSync('src/services/pdfService.js', 'utf8');
const oldPattern = /if \(typeof window !== "undefined" && typeof doc\.save === "function"\) \{\s*doc\.save\(fileName\);\s*\}/g;
const newCode = `if (typeof window !== "undefined" && window.FlutterDownloadBridge) {
      try {
        const dataUri = doc.output("datauristring");
        window.FlutterDownloadBridge.postMessage(JSON.stringify({
          filename: fileName,
          dataUrl: dataUri
        }));
      } catch(e) {
        console.error("Flutter bridge error:", e);
        if (typeof doc.save === "function") doc.save(fileName);
      }
    } else if (typeof window !== "undefined" && typeof doc.save === "function") {
      doc.save(fileName);
    }`;

pdfService = pdfService.replace(oldPattern, newCode);
fs.writeFileSync('src/services/pdfService.js', pdfService, 'utf8');
console.log('✓ Patched src/services/pdfService.js');

// 2. Patch src/utils/exportUtils.js
let exportUtils = fs.readFileSync('src/utils/exportUtils.js', 'utf8');
const oldExport = `export function downloadCSV(filename, headers, rows) {
  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });`;

const newExport = `export function downloadCSV(filename, headers, rows) {
  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\\n");
  if (typeof window !== "undefined" && window.FlutterDownloadBridge) {
    try {
      const base64 = "data:text/csv;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(csvContent)));
      window.FlutterDownloadBridge.postMessage(JSON.stringify({
        filename: filename.endsWith(".csv") ? filename : filename + ".csv",
        dataUrl: base64
      }));
      return;
    } catch (e) {
      console.error(e);
    }
  }
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });`;

exportUtils = exportUtils.replace(oldExport, newExport);
fs.writeFileSync('src/utils/exportUtils.js', exportUtils, 'utf8');
console.log('✓ Patched src/utils/exportUtils.js');

// 3. Patch src/services/whatsappService.js
let waService = fs.readFileSync('src/services/whatsappService.js', 'utf8');
const oldWa = `export function downloadVCardFile(leads = [], fileName = "Laxmi_Enterprises_Expo_Contacts.vcf") {
  const vcfContent = generateVCardString(leads);
  const blob = new Blob([vcfContent], { type: "text/vcard;charset=utf-8" });`;

const newWa = `export function downloadVCardFile(leads = [], fileName = "Laxmi_Enterprises_Expo_Contacts.vcf") {
  const vcfContent = generateVCardString(leads);
  if (typeof window !== "undefined" && window.FlutterDownloadBridge) {
    try {
      const base64 = "data:text/vcard;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(vcfContent)));
      window.FlutterDownloadBridge.postMessage(JSON.stringify({
        filename: fileName,
        dataUrl: base64
      }));
      return;
    } catch(e) {
      console.error(e);
    }
  }
  const blob = new Blob([vcfContent], { type: "text/vcard;charset=utf-8" });`;

waService = waService.replace(oldWa, newWa);
fs.writeFileSync('src/services/whatsappService.js', waService, 'utf8');
console.log('✓ Patched src/services/whatsappService.js');
