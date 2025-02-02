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
  const outputPath = `output/merged-${Date.now()}.pdf`;

  fs.writeFileSync(outputPath, pdfBytes);
  return outputPath;
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

    const mergedPdfPath = await mergePdfPages(req.files, selectedPages);
    res.json({ downloadUrl: `/download/${path.basename(mergedPdfPath)}` });
  } catch (error) {
    console.error("Error merging PDFs:", error);
    res.status(500).json({ error: error.message || "Failed to merge PDFs." });
  } finally {
    req.files.forEach(file => fs.unlinkSync(file.path));
  }
});

// Route to serve merged PDF downloads
app.get("/download/:fileName", (req, res) => {
  const filePath = path.join(__dirname, "output", req.params.fileName);
  res.download(filePath, (err) => {
    if (err) {
      console.error("Error sending file:", err);
      res.status(500).send("Error downloading file.");
    } else {
      fs.unlinkSync(filePath); // Clean up merged file after download
    }
  });
});

// Ensure required directories exist
fs.mkdirSync("uploads", { recursive: true });
fs.mkdirSync("output", { recursive: true });

app.listen(port, () => {
  console.log(`PDF Merger backend running at http://localhost:${port}`);
});