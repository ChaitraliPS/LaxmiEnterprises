// Reusable CSV Export Helper
export function downloadCSV(filename, headers, rows) {
  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
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
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
