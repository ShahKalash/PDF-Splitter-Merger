const express = require("express");
const multer = require("multer");
const { PDFDocument } = require("pdf-lib");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const morgan = require("morgan");
const ejs = require("ejs");

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static("public"));

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Set up storage for uploaded PDFs
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Helper function to merge selected PDF pages
async function mergePdfPages(files, selectedPages) {
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i].path;
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pagesToCopy = selectedPages[i] || [];

    for (const pageIndex of pagesToCopy) {
      if (Number.isInteger(pageIndex) && pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
        const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [pageIndex]);
        mergedPdf.addPage(copiedPage);
      } else {
        console.warn(`Skipping invalid page index ${pageIndex} for file ${filePath}`);
      }
    }
  }

  if (mergedPdf.getPageCount() === 0) {
    throw new Error("No valid pages selected for merging.");
  }

  const pdfBytes = await mergedPdf.save();
  return pdfBytes;
}

// Route to render index.ejs
app.get("/", (req, res) => {
  res.render("index");
});

// Route to upload PDFs and select pages
app.post("/upload", upload.array("pdfFiles"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    let selectedPages;
    try {
      selectedPages = JSON.parse(req.body.selectedPages);
    } catch (err) {
      return res.status(400).json({ error: "Invalid selectedPages format." });
    }

    const mergedPdfBytes = await mergePdfPages(req.files, selectedPages);
    const base64Pdf = Buffer.from(mergedPdfBytes).toString('base64');

    res.json({ base64Pdf });
  } catch (error) {
    console.error("Error merging PDFs:", error);
    res.status(500).json({ error: error.message || "Failed to merge PDFs." });
  } finally {
    req.files.forEach(file => fs.unlinkSync(file.path));
  }
});

app.listen(port, () => {
  console.log(`PDF Merger backend running at http://localhost:${port}`);
});
