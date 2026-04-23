const form = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const fileName = document.getElementById("file-name");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const deckList = document.getElementById("deck-list");
const section = document.getElementById("flashcard-section");
const deckTitle = document.getElementById("deck-title");
const card = document.getElementById("card");
const frontFace = card.querySelector(".card-front");
const backFace = card.querySelector(".card-back");
const counter = document.getElementById("counter");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const studyControls = document.getElementById("study-controls");
const statusButtons = document.getElementById("status-buttons");
const quizControls = document.getElementById("quiz-controls");
const revealBtn = document.getElementById("reveal-btn");
const quizGrade = document.getElementById("quiz-grade");
const quizResults = document.getElementById("quiz-results");
const scorePct = document.getElementById("score-pct");
const scoreDetail = document.getElementById("score-detail");
const scoreMessage = document.getElementById("score-message");
const restartQuizBtn = document.getElementById("restart-quiz-btn");
const progressText = document.getElementById("progress-text");
const progressPct = document.getElementById("progress-pct");
const progressFill = document.getElementById("progress-fill");
const studyHint = document.getElementById("study-hint");
const modeButtons = document.querySelectorAll(".mode-btn");
const quizTypeSelector = document.getElementById("quiz-type-selector");
const quizTypeRadios = document.querySelectorAll('input[name="quiz-type"]');
const mcOptions = document.getElementById("mc-options");

let flashcards = [];
let currentIndex = 0;
let mode = "study"; // "study" | "quiz"
let quizType = "flashcard"; // "flashcard" | "multiple-choice"
let quizScore = { right: 0, wrong: 0 };
let quizCardResults = []; // [{ cardId, correct }]
let currentDeckId = null;

refreshDeckList();

// === Drag & drop ===

["dragenter", "dragover"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) {
    fileInput.files = e.dataTransfer.files;
    showSelectedFile(file);
  }
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) showSelectedFile(file);
});

function showSelectedFile(file) {
  fileName.textContent = file.name;
  fileName.hidden = false;
  submitBtn.disabled = false;
}

// === Upload form ===

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  submitBtn.disabled = true;
  statusEl.innerHTML = `<span class="spinner"></span> Generating flashcards...`;
  section.hidden = true;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Request failed");
    }

    const data = await res.json();
    statusEl.textContent = `Generated ${data.flashcards.length} flashcards!`;

    const fullDeck = await (await fetch(`/api/decks/${data.deckId}`)).json();
    showDeck(fullDeck.id, fullDeck.name, fullDeck.flashcards);
    refreshDeckList();
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});

// === Saved deck list ===

async function refreshDeckList() {
  const res = await fetch("/api/decks");
  const { decks } = await res.json();

  deckList.innerHTML = "";
  if (decks.length === 0) {
    deckList.innerHTML = "<li class=\"empty\">No saved decks yet.</li>";
    return;
  }

  decks.forEach((deck) => {
    const masteryPct = deck.card_count
      ? Math.round((deck.got_it_count / deck.card_count) * 100)
      : 0;

    const quizBadge =
      deck.last_quiz_score !== null && deck.last_quiz_score !== undefined
        ? `<span class="quiz-badge ${scoreColorClass(deck.last_quiz_score)}">Last quiz: ${deck.last_quiz_score}%</span>`
        : `<span class="quiz-badge empty">No quiz yet</span>`;

    const li = document.createElement("li");
    li.innerHTML = `
      <button class="deck-open" data-id="${deck.id}">
        <div class="deck-name">${escapeHtml(deck.name)}</div>
        <div class="deck-preview">${escapeHtml(deck.preview || "")}</div>
        <div class="deck-meta">
          <span>${deck.card_count} cards</span>
          <span class="mastery">${masteryPct}% mastered</span>
        </div>
        <div class="mini-progress"><div style="width:${masteryPct}%"></div></div>
        ${quizBadge}
      </button>
      <button class="deck-delete" data-id="${deck.id}" title="Delete deck">&times;</button>
    `;
    deckList.appendChild(li);
  });
}

function scoreColorClass(score) {
  if (score >= 80) return "good";
  if (score >= 60) return "ok";
  return "low";
}

deckList.addEventListener("click", async (e) => {
  const openBtn = e.target.closest(".deck-open");
  const deleteBtn = e.target.closest(".deck-delete");

  if (openBtn) {
    const id = openBtn.dataset.id;
    const res = await fetch(`/api/decks/${id}`);
    const deck = await res.json();
    showDeck(deck.id, deck.name, deck.flashcards);
  } else if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    if (!confirm("Delete this deck?")) return;
    await fetch(`/api/decks/${id}`, { method: "DELETE" });
    refreshDeckList();
  }
});

// === Mode toggle ===

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    mode = btn.dataset.mode;
    if (mode === "quiz") startQuiz();
    else startStudy();
  });
});

quizTypeRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    quizType = radio.value;
    if (mode === "quiz") startQuiz();
  });
});

function showDeck(id, name, cards) {
  currentDeckId = id;
  flashcards = cards;
  currentIndex = 0;
  deckTitle.textContent = name;
  section.hidden = false;

  modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === "study"));
  mode = "study";
  startStudy();
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

// === Study mode ===

function startStudy() {
  studyControls.hidden = false;
  statusButtons.hidden = false;
  quizControls.hidden = true;
  quizResults.hidden = true;
  quizTypeSelector.hidden = true;
  mcOptions.hidden = true;
  card.hidden = false;
  studyHint.hidden = false;
  currentIndex = 0;
  renderCard();
  updateMasteryProgress();
}

function renderCard() {
  const fc = flashcards[currentIndex];
  frontFace.textContent = fc.question;
  backFace.textContent = fc.answer;
  card.classList.remove("flipped");
  counter.textContent = `${currentIndex + 1} / ${flashcards.length}`;

  card.classList.remove("status-got_it", "status-review");
  if (fc.status && fc.status !== "unseen") card.classList.add(`status-${fc.status}`);
}

card.addEventListener("click", () => {
  if (mode === "quiz") return; // in quiz mode, card flips are controlled by buttons
  card.classList.toggle("flipped");
});

prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);

function prev() {
  if (currentIndex > 0) {
    currentIndex--;
    renderCard();
  }
}

function next() {
  if (currentIndex < flashcards.length - 1) {
    currentIndex++;
    renderCard();
  }
}

statusButtons.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-status]");
  if (!btn) return;
  const status = btn.dataset.status;
  const fc = flashcards[currentIndex];
  fc.status = status;

  await fetch(`/api/flashcards/${fc.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  updateMasteryProgress();

  if (currentIndex < flashcards.length - 1) {
    next();
  } else {
    renderCard();
  }
});

function updateMasteryProgress() {
  const total = flashcards.length;
  const mastered = flashcards.filter((c) => c.status === "got_it").length;
  const pct = total ? Math.round((mastered / total) * 100) : 0;
  progressText.textContent = `${mastered} / ${total} mastered`;
  progressPct.textContent = `${pct}%`;
  progressFill.style.width = `${pct}%`;
  progressFill.className = "mastery-fill";
}

// === Quiz mode ===

function startQuiz() {
  quizScore = { right: 0, wrong: 0 };
  quizCardResults = [];

  // Shuffle cards (Fisher-Yates)
  flashcards = [...flashcards];
  for (let i = flashcards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flashcards[i], flashcards[j]] = [flashcards[j], flashcards[i]];
  }
  currentIndex = 0;

  studyControls.hidden = true;
  statusButtons.hidden = true;
  quizResults.hidden = true;
  quizTypeSelector.hidden = false;
  studyHint.hidden = true;

  // Show only the UI for the selected quiz type
  const isFlashcard = quizType === "flashcard";
  const isMC = quizType === "multiple-choice";

  card.hidden = false;
  quizControls.hidden = !isFlashcard;
  mcOptions.hidden = !isMC;

  showQuizCard();
}

function showQuizCard() {
  const fc = flashcards[currentIndex];
  counter.textContent = `${currentIndex + 1} / ${flashcards.length}`;
  updateQuizProgress();

  if (quizType === "flashcard") {
    frontFace.textContent = fc.question;
    backFace.textContent = fc.answer;
    card.classList.remove("flipped", "status-got_it", "status-review");
    revealBtn.hidden = false;
    quizGrade.hidden = true;
  } else if (quizType === "multiple-choice") {
    renderMultipleChoice(fc);
  }
}

// Flashcard quiz: reveal then self-grade
revealBtn.addEventListener("click", () => {
  card.classList.add("flipped");
  revealBtn.hidden = true;
  quizGrade.hidden = false;
});

quizGrade.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-grade]");
  if (!btn) return;
  recordAnswer(btn.dataset.grade === "right");
});

// Multiple choice: pick 3 distractors from other cards in the deck + correct answer
function renderMultipleChoice(fc) {
  // Render the question above the options (reuse the card front)
  frontFace.textContent = fc.question;
  card.hidden = false;
  card.classList.remove("flipped", "status-got_it", "status-review");

  // Pool of wrong answers: all answers in the deck except this one
  const distractorPool = flashcards
    .filter((c) => c.id !== fc.id && c.answer !== fc.answer)
    .map((c) => c.answer);

  // Shuffle and take up to 3
  for (let i = distractorPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [distractorPool[i], distractorPool[j]] = [distractorPool[j], distractorPool[i]];
  }
  const distractors = distractorPool.slice(0, 3);

  const options = [...distractors, fc.answer];
  // Shuffle options so the correct one isn't always last
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  mcOptions.innerHTML = "";
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "mc-option";
    btn.textContent = opt;
    btn.addEventListener("click", () => handleMCSelect(btn, opt, fc.answer));
    mcOptions.appendChild(btn);
  });
}

function handleMCSelect(btn, selected, correct) {
  // Disable all buttons, mark correct/wrong, pause briefly, advance
  const allButtons = mcOptions.querySelectorAll(".mc-option");
  allButtons.forEach((b) => {
    b.disabled = true;
    if (b.textContent === correct) b.classList.add("correct");
  });

  const isRight = selected === correct;
  if (!isRight) btn.classList.add("wrong");

  setTimeout(() => recordAnswer(isRight), 900);
}

function recordAnswer(isRight) {
  if (isRight) quizScore.right++;
  else quizScore.wrong++;

  const fc = flashcards[currentIndex];
  quizCardResults.push({ cardId: fc.id, correct: isRight });
  // Update local state too so the mastery bar reflects it when returning to study mode
  fc.status = isRight ? "got_it" : "review";

  if (currentIndex < flashcards.length - 1) {
    currentIndex++;
    showQuizCard();
  } else {
    showQuizResults();
  }
}

function updateQuizProgress() {
  const answered = quizScore.right + quizScore.wrong;
  const total = flashcards.length;
  const pct = answered ? Math.round((quizScore.right / answered) * 100) : 0;
  progressText.textContent = `${answered} / ${total} answered`;
  progressPct.textContent = answered ? `${pct}% correct` : "—";
  progressFill.style.width = `${(answered / total) * 100}%`;
  progressFill.className = "quiz-fill";
}

async function showQuizResults() {
  card.hidden = true;
  quizControls.hidden = true;
  mcOptions.hidden = true;

  const total = quizScore.right + quizScore.wrong;
  const pct = total ? Math.round((quizScore.right / total) * 100) : 0;
  scorePct.textContent = `${pct}%`;
  scoreDetail.textContent = `${quizScore.right} / ${total}`;
  scoreMessage.textContent =
    pct >= 90 ? "Excellent!"
    : pct >= 70 ? "Nice work!"
    : pct >= 50 ? "Keep practicing."
    : "Time to review.";
  quizResults.hidden = false;
  updateQuizProgress();

  // Persist quiz score + per-card statuses to the backend
  if (currentDeckId) {
    try {
      await fetch(`/api/decks/${currentDeckId}/quiz-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: pct, cardResults: quizCardResults }),
      });
      refreshDeckList();
    } catch (err) {
      console.error("Failed to save quiz result:", err);
    }
  }
}

restartQuizBtn.addEventListener("click", startQuiz);

// === Keyboard nav ===

document.addEventListener("keydown", (e) => {
  if (section.hidden) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  if (mode === "study") {
    if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
    else if (e.key === " ") {
      e.preventDefault();
      card.classList.toggle("flipped");
    }
  } else if (mode === "quiz" && quizType === "flashcard") {
    if (e.key === " " && !card.classList.contains("flipped")) {
      e.preventDefault();
      revealBtn.click();
    }
  }
});

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
