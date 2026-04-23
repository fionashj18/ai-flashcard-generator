const fs = require("fs").promises;
const path = require("path");
const pdfParse = require("pdf-parse");

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".pdf") {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === ".txt" || ext === ".md") {
    return await fs.readFile(filePath, "utf8");
  }

  throw new Error(`Unsupported file type: ${ext}. Use .pdf, .txt, or .md`);
}

module.exports = { extractText };
