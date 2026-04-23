const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "flashcards.db"));

// Two tables: one row per deck, one row per flashcard.
// `status` tracks the user's study progress: 'unseen' | 'got_it' | 'review'
db.exec(`
  CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deck_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    position INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'unseen',
    FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
  );
`);

db.pragma("foreign_keys = ON");

// Migration: add `status` column to existing flashcards tables that pre-date it
const columns = db.prepare("PRAGMA table_info(flashcards)").all();
if (!columns.some((c) => c.name === "status")) {
  db.exec("ALTER TABLE flashcards ADD COLUMN status TEXT NOT NULL DEFAULT 'unseen'");
}

function saveDeck(name, flashcards) {
  const insertDeck = db.prepare("INSERT INTO decks (name) VALUES (?)");
  const insertCard = db.prepare(
    "INSERT INTO flashcards (deck_id, question, answer, position) VALUES (?, ?, ?, ?)"
  );

  const tx = db.transaction((name, cards) => {
    const { lastInsertRowid: deckId } = insertDeck.run(name);
    cards.forEach((c, i) => insertCard.run(deckId, c.question, c.answer, i));
    return deckId;
  });

  return tx(name, flashcards);
}

function listDecks() {
  // Subquery grabs the first card's question (position = 0) as a preview snippet
  return db
    .prepare(
      `SELECT d.id, d.name, d.created_at,
              COUNT(f.id) AS card_count,
              SUM(CASE WHEN f.status = 'got_it' THEN 1 ELSE 0 END) AS got_it_count,
              (SELECT question FROM flashcards
               WHERE deck_id = d.id AND position = 0) AS preview
       FROM decks d
       LEFT JOIN flashcards f ON f.deck_id = d.id
       GROUP BY d.id
       ORDER BY d.created_at DESC`
    )
    .all();
}

function getDeck(id) {
  const deck = db.prepare("SELECT * FROM decks WHERE id = ?").get(id);
  if (!deck) return null;
  const cards = db
    .prepare(
      "SELECT id, question, answer, status FROM flashcards WHERE deck_id = ? ORDER BY position"
    )
    .all(id);
  return { ...deck, flashcards: cards };
}

function deleteDeck(id) {
  return db.prepare("DELETE FROM decks WHERE id = ?").run(id);
}

function updateCardStatus(cardId, status) {
  const valid = ["unseen", "got_it", "review"];
  if (!valid.includes(status)) throw new Error(`Invalid status: ${status}`);
  return db.prepare("UPDATE flashcards SET status = ? WHERE id = ?").run(status, cardId);
}

module.exports = { saveDeck, listDecks, getDeck, deleteDeck, updateCardStatus };
