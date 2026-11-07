function escapeHtml(text = "") {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getStylesheetTags() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => link.getAttribute("href"))
    .filter(Boolean)
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("\n");
}

function openPrintWindow(title = "", html = "") {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) {
    alert("Permita pop-ups para exportar o PDF.");
    return null;
  }

  const doc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${getStylesheetTags()}
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      padding: 12mm;
      color: #000;
      font-family: Arial, sans-serif;
    }

    .pdf-sheet,
    .pdf-sheet * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box;
    }

    .pdf-sheet {
      width: 100%;
      max-width: none;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    .pdf-title {
      margin: 0 0 6px 0 !important;
    }

    .pdf-subtitle {
      margin: 0 0 8px 0 !important;
    }

    .pdf-meta {
      margin: 0 0 14px 0 !important;
    }

    .pdf-cifra-content {
      font-family: "Courier New", Courier, monospace !important;
      white-space: pre-wrap !important;
      line-height: 1.45 !important;
      tab-size: 4 !important;
      -moz-tab-size: 4 !important;
      font-variant-ligatures: none !important;
      overflow: visible !important;
      min-height: 0 !important;
      box-shadow: none !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
    }

    .pdf-cifra-content * {
      font-family: inherit !important;
      white-space: inherit !important;
      line-height: inherit !important;
      letter-spacing: inherit !important;
      font-variant-ligatures: inherit !important;
    }

    .pdf-musica-content {
      overflow: visible !important;
      min-height: 0 !important;
      box-shadow: none !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
    }

    .pdf-musica-content * {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @page {
      size: auto;
      margin: 10mm;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(doc);
  printWindow.document.close();
  return printWindow;
}

function getMusicaExportHtml() {
  const title = document.getElementById("musica-titulo")?.textContent?.trim() || "Música";
  const subtitle = document.getElementById("musica-subtitulo")?.textContent?.trim() || "";
  const metaHtml = document.getElementById("musica-meta")?.innerHTML || "";
  const letraHtml = document.getElementById("musica-letra")?.innerHTML || "";

  return {
    title,
    html: `
      <section class="pdf-sheet">
        <h1 class="pdf-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="pdf-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        ${metaHtml ? `<div class="pdf-meta">${metaHtml}</div>` : ""}
        <article class="pdf-musica-content">${letraHtml}</article>
      </section>
    `
  };
}

function getCifraExportHtml() {
  const title = document.getElementById("cifra-titulo")?.textContent?.trim() || "Cifra";
  const subtitle = document.getElementById("cifra-subtitulo")?.textContent?.trim() || "";
  const metaHtml = document.getElementById("cifra-meta")?.innerHTML || "";
  const cifraHtml = document.getElementById("cifra-content")?.innerHTML || "";

  return {
    title,
    html: `
      <section class="pdf-sheet">
        <h1 class="pdf-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="pdf-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        ${metaHtml ? `<div class="pdf-meta">${metaHtml}</div>` : ""}
        <article class="pdf-cifra-content">${cifraHtml}</article>
      </section>
    `
  };
}

function printWindowWhenReady(printWindow) {
  if (!printWindow) return;

  const doPrint = () => {
    const fontsReady = printWindow.document.fonts?.ready || Promise.resolve();
    Promise.resolve(fontsReady).finally(() => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    });
  };

  if (printWindow.document.readyState === "complete") {
    doPrint();
  } else {
    printWindow.addEventListener("load", doPrint, { once: true });
  }
}

export function exportMusicaPdf() {
  const data = getMusicaExportHtml();
  const printWindow = openPrintWindow(data.title, data.html);
  printWindowWhenReady(printWindow);
}

export function exportCifraPdf() {
  const data = getCifraExportHtml();
  const printWindow = openPrintWindow(data.title, data.html);
  printWindowWhenReady(printWindow);
}
