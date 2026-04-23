const path = require("path");
// Load .env from the project root (one level up from backend/)
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const multer = require("multer");
const { extractText } = require("./services/fileParser");
const { generateFlashcards } = require("./services/aiService");
const { saveDeck, listDecks, getDeck, deleteDeck, updateCardStatus } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Multer stores uploaded files temporarily in backend/uploads/
const upload = multer({ dest: path.join(__dirname, "uploads") });

// Serve the frontend files (index.html, app.js, styles.css)
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use(express.json());

// Generate flashcards from an uploaded file and save the deck to the database
app.post("/api/generate", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const text = await extractText(req.file.path, req.file.originalname);
    const flashcards = await generateFlashcards(text);

    // Use the uploaded filename (without extension) as the deck name
    const name = path.parse(req.file.originalname).name;
    const deckId = saveDeck(name, flashcards);

    res.json({ deckId, name, flashcards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List all saved decks (with card counts)
app.get("/api/decks", (req, res) => {
  res.json({ decks: listDecks() });
});

// Load a single deck with all its flashcards
app.get("/api/decks/:id", (req, res) => {
  const deck = getDeck(Number(req.params.id));
  if (!deck) return res.status(404).json({ error: "Deck not found" });
  res.json(deck);
});

// Delete a deck and its flashcards
app.delete("/api/decks/:id", (req, res) => {
  const result = deleteDeck(Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: "Deck not found" });
  res.json({ ok: true });
});

// Update a single card's study status (got_it / review / unseen)
app.patch("/api/flashcards/:id", (req, res) => {
  try {
    const result = updateCardStatus(Number(req.params.id), req.body.status);
    if (result.changes === 0) return res.status(404).json({ error: "Card not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
