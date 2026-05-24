const STORAGE_KEY = "questionforge-state-v1";
const SUPABASE_CONFIG_KEY = "questionforge-supabase-config-v1";
const LOCAL_SYNC_BACKUP_KEY = "questionforge-local-sync-backup-v1";
const DEFAULT_SUPABASE_URL = "https://nardxqdhsirmadkqfiys.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_jUmQlZ9N6UjvWXEbA65tMQ_-7qNovuN";

const sampleQuestions = [
  {
    id: crypto.randomUUID(),
    stem: "A 64-year-old man has exertional chest pressure that improves with rest. ECG is normal at rest. Which medication is most appropriate for immediate symptom relief during an acute episode?",
    choices: ["Atorvastatin", "Sublingual nitroglycerin", "Lisinopril", "Clopidogrel"],
    answerIndex: 1,
    explanation: "Sublingual nitroglycerin provides rapid venodilation and coronary vasodilation, reducing myocardial oxygen demand during an anginal episode. Statins and ACE inhibitors reduce long-term risk but do not provide immediate relief.",
    tags: ["cardiology", "ischemic heart disease"],
    difficulty: "Easy",
    source: "Starter sample",
    flagged: false,
    attempts: []
  },
  {
    id: crypto.randomUUID(),
    stem: "A 22-year-old woman has episodic wheezing and cough at night. Spirometry shows reduced FEV1/FVC that improves after albuterol. What is the underlying mechanism of the reversible airflow obstruction?",
    choices: ["Loss of alveolar elastic recoil", "IgE-mediated mast cell activation and bronchial hyperresponsiveness", "Pulmonary vascular remodeling", "Defective chloride transport"],
    answerIndex: 1,
    explanation: "Asthma is driven by airway inflammation and bronchial hyperresponsiveness, often involving IgE-mediated mast cell activation. The obstruction is classically reversible with bronchodilator therapy.",
    tags: ["pulmonology", "asthma"],
    difficulty: "Medium",
    source: "Starter sample",
    flagged: false,
    attempts: []
  }
];

let state = loadState();
let activeSession = null;
let selectedAnswer = null;
let answerSubmitted = false;
let supabaseClient = null;
let currentUser = null;
let cloudReady = false;

const views = {
  dashboard: document.querySelector("#dashboardView"),
  practice: document.querySelector("#practiceView"),
  tests: document.querySelector("#testsView"),
  bank: document.querySelector("#bankView"),
  import: document.querySelector("#importView"),
  settings: document.querySelector("#settingsView")
};

const elements = {
  sidebarCount: document.querySelector("#sidebarCount"),
  accuracyMetric: document.querySelector("#accuracyMetric"),
  answeredMetric: document.querySelector("#answeredMetric"),
  flaggedMetric: document.querySelector("#flaggedMetric"),
  unusedMetric: document.querySelector("#unusedMetric"),
  tagPerformance: document.querySelector("#tagPerformance"),
  recentAttempts: document.querySelector("#recentAttempts"),
  practiceStatusFilter: document.querySelector("#practiceStatusFilter"),
  topicFilterList: document.querySelector("#topicFilterList"),
  clearTopics: document.querySelector("#clearTopics"),
  questionLimit: document.querySelector("#questionLimit"),
  practiceMode: document.querySelector("#practiceMode"),
  unusedOnly: document.querySelector("#unusedOnly"),
  sessionSetup: document.querySelector("#sessionSetup"),
  questionStage: document.querySelector("#questionStage"),
  sessionResults: document.querySelector("#sessionResults"),
  sessionProgress: document.querySelector("#sessionProgress"),
  sessionProgressBar: document.querySelector("#sessionProgressBar"),
  questionMeta: document.querySelector("#questionMeta"),
  questionStem: document.querySelector("#questionStem"),
  questionChoices: document.querySelector("#questionChoices"),
  feedbackPanel: document.querySelector("#feedbackPanel"),
  submitAnswer: document.querySelector("#submitAnswer"),
  nextQuestion: document.querySelector("#nextQuestion"),
  flagQuestion: document.querySelector("#flagQuestion"),
  questionForm: document.querySelector("#questionForm"),
  editingId: document.querySelector("#editingId"),
  stemInput: document.querySelector("#stemInput"),
  tagsInput: document.querySelector("#tagsInput"),
  difficultyInput: document.querySelector("#difficultyInput"),
  choiceInputs: document.querySelector("#choiceInputs"),
  explanationInput: document.querySelector("#explanationInput"),
  sourceInput: document.querySelector("#sourceInput"),
  questionList: document.querySelector("#questionList"),
  bankSearch: document.querySelector("#bankSearch"),
  bankStatusFilter: document.querySelector("#bankStatusFilter"),
  testHistoryList: document.querySelector("#testHistoryList"),
  testReviewPanel: document.querySelector("#testReviewPanel"),
  formTitle: document.querySelector("#formTitle"),
  importInput: document.querySelector("#importInput"),
  importMessage: document.querySelector("#importMessage"),
  exportBackup: document.querySelector("#exportBackup"),
  syncStatus: document.querySelector("#syncStatus"),
  supabaseSettingsForm: document.querySelector("#supabaseSettingsForm"),
  supabaseUrlInput: document.querySelector("#supabaseUrlInput"),
  supabaseKeyInput: document.querySelector("#supabaseKeyInput"),
  authForm: document.querySelector("#authForm"),
  authEmailInput: document.querySelector("#authEmailInput"),
  authPasswordInput: document.querySelector("#authPasswordInput"),
  authMessage: document.querySelector("#authMessage"),
  signUpButton: document.querySelector("#signUpButton"),
  signOutButton: document.querySelector("#signOutButton"),
  syncLocalButton: document.querySelector("#syncLocalButton"),
  cloudMessage: document.querySelector("#cloudMessage")
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return ensureStateShape({ questions: sampleQuestions, sessions: [] });
  }

  try {
    const parsed = JSON.parse(saved);
    return ensureStateShape({
      questions: Array.isArray(parsed.questions) ? parsed.questions : sampleQuestions,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    });
  } catch {
    return ensureStateShape({ questions: sampleQuestions, sessions: [] });
  }
}

function saveState() {
  state = ensureStateShape(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveLocalSyncBackup() {
  if (!state.questions.length) return;
  localStorage.setItem(LOCAL_SYNC_BACKUP_KEY, JSON.stringify(ensureStateShape(state)));
}

function loadLocalSyncBackup() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SYNC_BACKUP_KEY) || "{}");
    return ensureStateShape({
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    });
  } catch {
    return { questions: [], sessions: [] };
  }
}

function ensureStateShape(nextState) {
  const questions = (nextState.questions || []).map((question) => ({
      ...question,
      id: question.id || crypto.randomUUID(),
      questionNumber: Number(question.questionNumber || question.question_number || 0),
      answerIndex: Number(question.answerIndex),
      choices: Array.isArray(question.choices) ? question.choices : [],
      tags: Array.isArray(question.tags) ? question.tags : [],
      flagged: Boolean(question.flagged),
      attempts: (question.attempts || []).map((attempt) => ({
        id: attempt.id || crypto.randomUUID(),
        selectedAnswer: Number(attempt.selectedAnswer),
        correct: Boolean(attempt.correct),
        timestamp: Number(attempt.timestamp) || Date.now()
      }))
    }));
  assignQuestionNumbers(questions);

  return {
    questions,
    sessions: (nextState.sessions || []).map((session) => ({
      id: session.id || crypto.randomUUID(),
      title: session.title || "Practice block",
      mode: session.mode || "tutor",
      createdAt: Number(session.createdAt || session.created_at || Date.now()),
      questionIds: session.questionIds || session.question_ids || [],
      results: (session.results || []).map((result) => ({
        questionId: result.questionId || result.question_id,
        selectedAnswer: Number(result.selectedAnswer),
        correct: Boolean(result.correct),
        timestamp: Number(result.timestamp) || Date.now()
      })),
      filters: session.filters || {}
    }))
  };
}

function assignQuestionNumbers(questions) {
  let maxNumber = questions.reduce((max, question) => Math.max(max, Number(question.questionNumber) || 0), 0);
  [...questions].reverse().forEach((question) => {
    if (!question.questionNumber) {
      maxNumber += 1;
      question.questionNumber = maxNumber;
    }
  });
}

function getNextQuestionNumber() {
  return state.questions.reduce((max, question) => Math.max(max, Number(question.questionNumber) || 0), 0) + 1;
}

function loadSupabaseConfig() {
  try {
    const config = JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || "{}");
    return {
      url: config.url || DEFAULT_SUPABASE_URL,
      key: config.key || DEFAULT_SUPABASE_KEY
    };
  } catch {
    return { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY };
  }
}

function saveSupabaseConfig(url, key) {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, key }));
}

function renderAll() {
  renderDashboard();
  renderTopicFilter();
  renderQuestionList();
  renderTestHistory();
  renderCloudStatus();
}

function switchView(viewName) {
  Object.entries(views).forEach(([name, node]) => node.classList.toggle("active", name === viewName));
  document.querySelectorAll(".nav-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
}

function renderCloudStatus() {
  if (!elements.syncStatus) return;
  if (!supabaseClient) {
    elements.syncStatus.textContent = "Local only";
    if (elements.authMessage) elements.authMessage.textContent = "Save your Supabase connection before signing in.";
    return;
  }
  if (!currentUser) {
    elements.syncStatus.textContent = "Supabase ready - signed out";
    if (elements.authMessage) elements.authMessage.textContent = "Supabase is connected. Sign in or create an account.";
    return;
  }
  elements.syncStatus.textContent = `Cloud sync on: ${currentUser.email}`;
  if (elements.authMessage) elements.authMessage.textContent = `Signed in as ${currentUser.email}.`;
}

function setCloudMessage(message) {
  if (elements.cloudMessage) elements.cloudMessage.textContent = message;
}

function setAuthMessage(message) {
  if (elements.authMessage) elements.authMessage.textContent = message;
  setCloudMessage(message);
}

function readAuthCredentials() {
  const email = elements.authEmailInput.value.trim();
  const password = elements.authPasswordInput.value;
  if (!email) throw new Error("Enter your email address.");
  if (!password) throw new Error("Enter your password.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");
  return { email, password };
}

function normalizeSupabaseUrl(value) {
  const rawValue = value.trim();
  if (!rawValue) throw new Error("Paste your Supabase Project URL.");

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error("Project URL must look like https://your-project.supabase.co");
  }

  if (parsed.hostname === "supabase.com" || parsed.hostname === "app.supabase.com") {
    throw new Error("That is a Supabase dashboard link. Use the Project URL from Project Settings > API. It should look like https://your-project.supabase.co");
  }

  if (!parsed.hostname.endsWith(".supabase.co")) {
    throw new Error("Project URL must end with .supabase.co");
  }

  return `https://${parsed.hostname}`;
}

function allAttempts() {
  return state.questions.flatMap((question) =>
    (question.attempts || []).map((attempt) => ({
      ...attempt,
      questionId: question.id,
      stem: question.stem,
      tags: question.tags || []
    }))
  );
}

function getLatestAttempt(question) {
  return [...(question.attempts || [])].sort((a, b) => b.timestamp - a.timestamp)[0] || null;
}

function getQuestionStatus(question) {
  if (question.flagged) return "flagged";
  const latest = getLatestAttempt(question);
  if (!latest) return "unused";
  return latest.correct ? "correct" : "incorrect";
}

function questionMatchesStatus(question, status) {
  if (status === "all") return true;
  if (status === "flagged") return question.flagged;
  const latest = getLatestAttempt(question);
  if (status === "unused") return !latest;
  if (status === "correct") return Boolean(latest?.correct);
  if (status === "incorrect") return latest ? !latest.correct : false;
  return true;
}

function getSelectedTopics() {
  return [...elements.topicFilterList.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value);
}

function questionSearchText(question) {
  const correctAnswer = question.choices[question.answerIndex] || "";
  return [
    `q${question.questionNumber}`,
    String(question.questionNumber),
    question.stem,
    question.explanation,
    correctAnswer,
    ...(question.choices || []),
    ...(question.tags || [])
  ]
    .join(" ")
    .toLowerCase();
}

function getTestDisplayId(session) {
  return `T-${String(session.id).slice(0, 8).toUpperCase()}`;
}

function configureSupabase(url, key) {
  if (!url || !key) return false;
  if (!window.supabase) {
    setCloudMessage("Supabase library did not load. Check your internet connection and refresh.");
    return false;
  }
  supabaseClient = window.supabase.createClient(url, key);
  return true;
}

async function initializeSupabase() {
  const config = loadSupabaseConfig();
  elements.supabaseUrlInput.value = config.url;
  elements.supabaseKeyInput.value = config.key;
  if (!configureSupabase(config.url, config.key)) {
    renderCloudStatus();
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setCloudMessage(error.message);
    renderCloudStatus();
    return;
  }
  currentUser = data.session?.user || null;
  cloudReady = Boolean(currentUser);
  if (currentUser) await loadCloudData();
  renderCloudStatus();
}

async function signIn(email, password) {
  if (!supabaseClient) throw new Error("Save your Supabase connection first.");
  setAuthMessage("Signing in...");
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = data.user;
  cloudReady = true;
  await loadCloudData();
  setAuthMessage("Signed in. Cloud questions loaded.");
  renderAll();
}

async function signUp(email, password) {
  if (!supabaseClient) throw new Error("Save your Supabase connection first.");
  setAuthMessage("Creating account...");
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  currentUser = data.session?.user || null;
  cloudReady = Boolean(currentUser);
  if (currentUser) await loadCloudData();
  if (currentUser) {
    setAuthMessage("Account created and signed in. Cloud sync is on.");
  } else if (data.user) {
    setAuthMessage("Account created. Check your email for a confirmation link, then come back and sign in.");
  } else {
    setAuthMessage("Create account request sent. Check your email, then sign in.");
  }
  renderAll();
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  currentUser = null;
  cloudReady = false;
  setAuthMessage("Signed out. This device is using local questions until you sign in again.");
  renderAll();
}

function questionToDb(question) {
  return {
    id: question.id,
    user_id: currentUser.id,
    stem: question.stem,
    choices: question.choices,
    answer_index: question.answerIndex,
    explanation: question.explanation,
    tags: question.tags || [],
    difficulty: question.difficulty || "Medium",
    source: question.source || "",
    flagged: Boolean(question.flagged)
  };
}

function questionFromDb(row) {
  return {
    id: row.id,
    stem: row.stem,
    choices: row.choices || [],
    answerIndex: row.answer_index,
    explanation: row.explanation,
    tags: row.tags || [],
    difficulty: row.difficulty || "Medium",
    source: row.source || "",
    flagged: Boolean(row.flagged),
    attempts: []
  };
}

function attemptToDb(questionId, attempt) {
  return {
    id: attempt.id,
    user_id: currentUser.id,
    question_id: questionId,
    selected_answer: attempt.selectedAnswer,
    correct: attempt.correct,
    created_at: new Date(attempt.timestamp).toISOString()
  };
}

function attemptFromDb(row) {
  return {
    id: row.id,
    selectedAnswer: row.selected_answer,
    correct: Boolean(row.correct),
    timestamp: new Date(row.created_at).getTime()
  };
}

function sessionToDb(session) {
  return {
    id: session.id,
    user_id: currentUser.id,
    title: session.title,
    mode: session.mode,
    question_ids: session.questionIds,
    results: session.results,
    filters: session.filters || {},
    created_at: new Date(session.createdAt).toISOString()
  };
}

function sessionFromDb(row) {
  return {
    id: row.id,
    title: row.title || "Practice block",
    mode: row.mode || "tutor",
    questionIds: row.question_ids || [],
    results: row.results || [],
    filters: row.filters || {},
    createdAt: new Date(row.created_at).getTime()
  };
}

async function fetchAllRows(tableName, orderColumn = "created_at") {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseClient
      .from(tableName)
      .select("*")
      .order(orderColumn, { ascending: false })
      .range(from, to);
    if (error) throw error;

    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function loadCloudData() {
  if (!cloudReady) return;
  const localBeforeCloudLoad = ensureStateShape(state);
  if (localBeforeCloudLoad.questions.length) saveLocalSyncBackup();

  const questions = await fetchAllRows("questions");
  const attempts = await fetchAllRows("attempts");
  let sessions = [];
  try {
    sessions = await fetchAllRows("test_sessions");
  } catch (error) {
    setCloudMessage("Question sync is working. Run the updated Supabase SQL to enable saved test history.");
  }

  const byId = new Map((questions || []).map((row) => [row.id, questionFromDb(row)]));
  (attempts || []).forEach((row) => {
    const question = byId.get(row.question_id);
    if (question) question.attempts.push(attemptFromDb(row));
  });

  if (!byId.size && localBeforeCloudLoad.questions.length) {
    state = localBeforeCloudLoad;
    saveState();
    setCloudMessage("Supabase is empty. Your local questions are still here; click Sync local questions to Supabase.");
    renderAll();
    return;
  }

  state = ensureStateShape({ questions: [...byId.values()], sessions: sessions.map(sessionFromDb) });
  saveState();
  renderAll();
}

async function saveCloudQuestion(question) {
  if (!cloudReady) return;
  const { error } = await supabaseClient.from("questions").upsert(questionToDb(question), { onConflict: "id" });
  if (error) throw error;
}

async function deleteCloudQuestion(id) {
  if (!cloudReady) return;
  const { error } = await supabaseClient.from("questions").delete().eq("id", id);
  if (error) throw error;
}

async function saveCloudAttempt(questionId, attempt) {
  if (!cloudReady) return;
  const { error } = await supabaseClient.from("attempts").upsert(attemptToDb(questionId, attempt), { onConflict: "id" });
  if (error) throw error;
}

async function saveCloudSession(session) {
  if (!cloudReady) return;
  const { error } = await supabaseClient.from("test_sessions").upsert(sessionToDb(session), { onConflict: "id" });
  if (error) throw error;
}

async function syncLocalToCloud() {
  if (!cloudReady) throw new Error("Sign in before syncing.");
  let syncState = ensureStateShape(state);
  if (!syncState.questions.length) syncState = loadLocalSyncBackup();
  if (!syncState.questions.length) throw new Error("There are no local questions in this app location. If your questions are in the old file version, open that old app and download a backup JSON, then import it here while signed in.");

  const questions = syncState.questions.map(questionToDb);
  const { error: questionError } = await supabaseClient.from("questions").upsert(questions, { onConflict: "id" });
  if (questionError) throw questionError;

  const attempts = syncState.questions.flatMap((question) => (question.attempts || []).map((attempt) => attemptToDb(question.id, attempt)));
  if (attempts.length) {
    const { error: attemptError } = await supabaseClient.from("attempts").upsert(attempts, { onConflict: "id" });
    if (attemptError) throw attemptError;
  }

  if (syncState.sessions.length) {
    const { error: sessionError } = await supabaseClient.from("test_sessions").upsert(syncState.sessions.map(sessionToDb), { onConflict: "id" });
    if (sessionError) setCloudMessage("Questions synced. Run the updated Supabase SQL to enable saved test history sync.");
  }

  await loadCloudData();
  setCloudMessage(`Synced ${questions.length} question${questions.length === 1 ? "" : "s"} to Supabase.`);
}

function renderDashboard() {
  const attempts = allAttempts();
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const answeredIds = new Set(attempts.map((attempt) => attempt.questionId));
  const accuracy = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;

  elements.sidebarCount.textContent = state.questions.length;
  elements.accuracyMetric.textContent = `${accuracy}%`;
  elements.answeredMetric.textContent = attempts.length;
  elements.flaggedMetric.textContent = state.questions.filter((question) => question.flagged).length;
  elements.unusedMetric.textContent = state.questions.filter((question) => !answeredIds.has(question.id)).length;
  renderTagPerformance(attempts);
  renderRecentAttempts(attempts);
}

function renderTagPerformance(attempts) {
  const byTag = new Map();
  attempts.forEach((attempt) => {
    attempt.tags.forEach((tag) => {
      if (!byTag.has(tag)) byTag.set(tag, { total: 0, correct: 0 });
      const row = byTag.get(tag);
      row.total += 1;
      if (attempt.correct) row.correct += 1;
    });
  });

  if (!byTag.size) {
    elements.tagPerformance.className = "tag-performance empty-state";
    elements.tagPerformance.textContent = "Add questions to see topic-level performance.";
    return;
  }

  elements.tagPerformance.className = "tag-performance";
  elements.tagPerformance.innerHTML = [...byTag.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([tag, stats]) => {
      const pct = Math.round((stats.correct / stats.total) * 100);
      return `<div class="tag-row"><strong>${escapeHtml(tag)}</strong><div class="bar"><span style="width:${pct}%"></span></div><span>${pct}%</span></div>`;
    })
    .join("");
}

function renderRecentAttempts(attempts) {
  const recent = attempts.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  if (!recent.length) {
    elements.recentAttempts.className = "attempt-list empty-state";
    elements.recentAttempts.textContent = "No attempts yet.";
    return;
  }

  elements.recentAttempts.className = "attempt-list";
  elements.recentAttempts.innerHTML = recent
    .map(
      (attempt) => `<div class="attempt-item">
        <span>${escapeHtml(truncate(attempt.stem, 78))}</span>
        <strong class="${attempt.correct ? "good-text" : "bad-text"}">${attempt.correct ? "Correct" : "Missed"}</strong>
      </div>`
    )
    .join("");
}

function renderTestHistory() {
  const sessions = [...(state.sessions || [])].sort((a, b) => b.createdAt - a.createdAt);
  if (!sessions.length) {
    elements.testHistoryList.className = "test-history-list empty-state";
    elements.testHistoryList.textContent = "No completed tests yet.";
    elements.testReviewPanel.className = "empty-state";
    elements.testReviewPanel.textContent = "Select a test to review it.";
    return;
  }

  elements.testHistoryList.className = "test-history-list";
  elements.testHistoryList.innerHTML = sessions
    .map((session) => {
      const correct = session.results.filter((result) => result.correct).length;
      const answered = session.results.length;
      const score = answered ? Math.round((correct / answered) * 100) : 0;
      return `<button class="test-history-item" data-session="${session.id}">
        <span>${escapeHtml(getTestDisplayId(session))}</span>
        <strong>${score}%</strong>
        <small>${escapeHtml(new Date(session.createdAt).toLocaleString())}</small>
        <small>${answered}/${session.questionIds.length} answered - ${escapeHtml(session.mode)}</small>
      </button>`;
    })
    .join("");
}

function renderTestReview(sessionId) {
  const session = (state.sessions || []).find((item) => item.id === sessionId);
  if (!session) return;
  const correct = session.results.filter((result) => result.correct).length;
  const answered = session.results.length;
  const score = answered ? Math.round((correct / answered) * 100) : 0;

  elements.testReviewPanel.className = "";
  elements.testReviewPanel.innerHTML = `<div class="test-review-header">
      <div>
        <strong>${escapeHtml(getTestDisplayId(session))}</strong>
        <small>${escapeHtml(session.id)}</small>
      </div>
      <button class="primary-action" data-retake="${session.id}">Retake test</button>
    </div>
    <div class="review-summary">
      <article class="metric"><span>Score</span><strong>${score}%</strong></article>
      <article class="metric"><span>Correct</span><strong>${correct}</strong></article>
      <article class="metric"><span>Answered</span><strong>${answered}/${session.questionIds.length}</strong></article>
    </div>
    <div class="review-list">
      ${session.questionIds
        .map((questionId) => {
          const question = state.questions.find((item) => item.id === questionId);
          if (!question) return "";
          const result = session.results.find((item) => item.questionId === questionId);
          const selected = result ? question.choices[result.selectedAnswer] || "No answer" : "No answer";
          return `<article class="review-item">
            <strong class="${result?.correct ? "good-text" : "bad-text"}">${result?.correct ? "Correct" : "Missed or unanswered"}</strong>
            <p><b>Q${question.questionNumber}</b> ${escapeHtml(question.stem)}</p>
            <p><b>Your answer:</b> ${escapeHtml(selected)}</p>
            <p><b>Correct answer:</b> ${escapeHtml(question.choices[question.answerIndex])}</p>
            <p>${escapeHtml(question.explanation)}</p>
          </article>`;
        })
        .join("")}
    </div>`;
}

function renderTopicFilter() {
  const tags = [...new Set(state.questions.flatMap((question) => question.tags || []))].sort();
  const selected = new Set(getSelectedTopics());
  if (!tags.length) {
    elements.topicFilterList.innerHTML = `<div class="empty-state">No subjects yet.</div>`;
    return;
  }
  elements.topicFilterList.innerHTML = tags
    .map(
      (tag) => `<label class="topic-check">
        <input type="checkbox" value="${escapeAttribute(tag)}" ${selected.has(tag) ? "checked" : ""} />
        <span>${escapeHtml(tag)}</span>
      </label>`
    )
    .join("");
}

function renderQuestionList() {
  const query = elements.bankSearch.value.trim().toLowerCase();
  const status = elements.bankStatusFilter.value;
  const questions = state.questions.filter((question) => {
    return questionMatchesStatus(question, status) && questionSearchText(question).includes(query);
  });

  if (!questions.length) {
    elements.questionList.innerHTML = `<div class="empty-state">No questions match this view.</div>`;
    return;
  }

  elements.questionList.innerHTML = questions
    .map((question) => {
      const attempts = question.attempts || [];
      const correct = attempts.filter((attempt) => attempt.correct).length;
      const accuracy = attempts.length ? `${Math.round((correct / attempts.length) * 100)}%` : "Unused";
      return `<article class="bank-item">
        <h4><span class="question-number">Q${question.questionNumber}</span>${escapeHtml(truncate(question.stem, 130))}</h4>
        <div class="question-meta">
          <span class="pill">${escapeHtml(getQuestionStatus(question))}</span>
          ${(question.tags || []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
          <span class="pill">${escapeHtml(question.difficulty || "Medium")}</span>
          ${question.flagged ? `<span class="pill">Flagged</span>` : ""}
        </div>
        <div class="bank-item-footer">
          <span>${attempts.length} attempts - ${accuracy}</span>
          <div class="button-row">
            <button class="small-button" data-edit="${question.id}">Edit</button>
            <button class="small-button danger" data-delete="${question.id}">Delete</button>
          </div>
        </div>
      </article>`;
    })
    .join("");
}

function addChoiceInput(value = "", checked = false) {
  const template = document.querySelector("#choiceTemplate");
  const row = template.content.firstElementChild.cloneNode(true);
  const radio = row.querySelector("input[type='radio']");
  const input = row.querySelector(".choice-text");
  radio.value = String(elements.choiceInputs.children.length);
  radio.checked = checked;
  input.value = value;
  row.querySelector(".remove-choice").addEventListener("click", () => {
    if (elements.choiceInputs.children.length <= 2) return;
    row.remove();
    refreshChoiceRadioValues();
  });
  elements.choiceInputs.append(row);
  refreshChoiceRadioValues();
}

function refreshChoiceRadioValues() {
  [...elements.choiceInputs.children].forEach((row, index) => {
    row.querySelector("input[type='radio']").value = String(index);
  });
}

function clearForm() {
  elements.editingId.value = "";
  elements.formTitle.textContent = "New question";
  elements.questionForm.reset();
  elements.choiceInputs.innerHTML = "";
  ["", "", "", ""].forEach((value, index) => addChoiceInput(value, index === 0));
}

function fillForm(question) {
  elements.editingId.value = question.id;
  elements.formTitle.textContent = "Edit question";
  elements.stemInput.value = question.stem;
  elements.tagsInput.value = (question.tags || []).join(", ");
  elements.difficultyInput.value = question.difficulty || "Medium";
  elements.explanationInput.value = question.explanation;
  elements.sourceInput.value = question.source || "";
  elements.choiceInputs.innerHTML = "";
  question.choices.forEach((choice, index) => addChoiceInput(choice, index === question.answerIndex));
  switchView("bank");
  elements.stemInput.focus();
}

function readFormQuestion() {
  const rows = [...elements.choiceInputs.children];
  const choices = rows.map((row) => row.querySelector(".choice-text").value.trim());
  const selectedRow = rows.findIndex((row) => row.querySelector("input[type='radio']").checked);
  const answerIndex = selectedRow >= 0 ? selectedRow : 0;
  if (choices.length < 2) throw new Error("Add at least two answer choices.");
  if (choices.some((choice) => !choice)) throw new Error("Fill in every answer choice, or remove blank choices.");
  if (answerIndex >= choices.length) throw new Error("Mark the correct answer.");

  return {
    stem: elements.stemInput.value.trim(),
    choices,
    answerIndex,
    explanation: elements.explanationInput.value.trim(),
    tags: splitTags(elements.tagsInput.value),
    difficulty: elements.difficultyInput.value,
    source: elements.sourceInput.value.trim(),
    flagged: false,
    attempts: []
  };
}

function startSession() {
  const topics = getSelectedTopics();
  const status = elements.practiceStatusFilter.value;
  const limit = Math.max(1, Number(elements.questionLimit.value) || 10);
  const unusedOnly = elements.unusedOnly.checked;
  let pool = [...state.questions];
  if (topics.length) pool = pool.filter((question) => topics.some((topic) => (question.tags || []).includes(topic)));
  if (status !== "all") pool = pool.filter((question) => questionMatchesStatus(question, status));
  if (unusedOnly) pool = pool.filter((question) => !(question.attempts || []).length);

  pool = shuffle(pool).slice(0, limit);
  if (!pool.length) {
    elements.sessionResults.classList.remove("hidden");
    elements.sessionResults.innerHTML = `<h3>No questions found</h3><p>Try a broader topic filter or turn off unused-only.</p>`;
    return;
  }

  activeSession = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    mode: elements.practiceMode.value,
    questions: pool.map((question) => question.id),
    index: 0,
    results: [],
    filters: { topics, status, unusedOnly }
  };
  selectedAnswer = null;
  answerSubmitted = false;
  elements.sessionSetup.classList.add("hidden");
  elements.sessionResults.classList.add("hidden");
  elements.questionStage.classList.remove("hidden");
  renderCurrentQuestion();
}

function retakeSession(sessionId) {
  const session = (state.sessions || []).find((item) => item.id === sessionId);
  if (!session) return;
  const questionIds = session.questionIds.filter((id) => state.questions.some((question) => question.id === id));
  if (!questionIds.length) {
    elements.testReviewPanel.innerHTML = `<div class="empty-state">None of the questions from this test are available anymore.</div>`;
    return;
  }

  activeSession = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    mode: session.mode || "tutor",
    questions: questionIds,
    index: 0,
    results: [],
    filters: { ...(session.filters || {}), retakeOf: session.id }
  };
  selectedAnswer = null;
  answerSubmitted = false;
  switchView("practice");
  elements.sessionSetup.classList.add("hidden");
  elements.sessionResults.classList.add("hidden");
  elements.questionStage.classList.remove("hidden");
  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  const question = getCurrentQuestion();
  const index = activeSession.index;
  selectedAnswer = null;
  answerSubmitted = false;
  elements.sessionProgress.textContent = `Question ${index + 1} of ${activeSession.questions.length}`;
  elements.sessionProgressBar.style.width = `${((index + 1) / activeSession.questions.length) * 100}%`;
  elements.questionMeta.innerHTML = `<span class="pill">Q${question.questionNumber}</span>${(question.tags || []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}<span class="pill">${escapeHtml(question.difficulty || "Medium")}</span>`;
  elements.questionStem.textContent = question.stem;
  elements.feedbackPanel.className = "feedback hidden";
  elements.feedbackPanel.textContent = "";
  elements.submitAnswer.classList.remove("hidden");
  elements.submitAnswer.disabled = true;
  elements.nextQuestion.classList.add("hidden");
  elements.flagQuestion.textContent = question.flagged ? "Unflag" : "Flag";

  elements.questionChoices.innerHTML = question.choices
    .map(
      (choice, choiceIndex) => `<button class="choice-button" data-choice="${choiceIndex}">
        <span class="choice-letter">${String.fromCharCode(65 + choiceIndex)}</span>
        <span>${escapeHtml(choice)}</span>
      </button>`
    )
    .join("");
}

async function submitCurrentAnswer() {
  if (selectedAnswer === null || answerSubmitted) return;
  const question = getCurrentQuestion();
  const correct = selectedAnswer === question.answerIndex;
  const attempt = {
    id: crypto.randomUUID(),
    selectedAnswer,
    correct,
    timestamp: Date.now()
  };
  question.attempts = [...(question.attempts || []), attempt];
  activeSession.results.push({ questionId: question.id, ...attempt });
  saveState();
  try {
    await saveCloudAttempt(question.id, attempt);
  } catch (error) {
    setCloudMessage(`Attempt saved locally, but Supabase did not save it: ${error.message}`);
  }
  answerSubmitted = true;
  showFeedback(question, correct);

  if (activeSession.mode === "exam") {
    moveNextOrFinish();
  } else {
    elements.submitAnswer.classList.add("hidden");
    elements.nextQuestion.classList.remove("hidden");
  }
  renderAll();
}

function showFeedback(question, correct) {
  [...elements.questionChoices.children].forEach((button, index) => {
    button.disabled = true;
    if (index === question.answerIndex) button.classList.add("correct");
    if (index === selectedAnswer && !correct) button.classList.add("incorrect");
  });
  elements.feedbackPanel.className = `feedback ${correct ? "good" : "bad"}`;
  elements.feedbackPanel.textContent = `${correct ? "Correct." : "Not quite."}\n\n${question.explanation}`;
}

function moveNextOrFinish() {
  if (!activeSession) return;
  if (activeSession.index < activeSession.questions.length - 1) {
    activeSession.index += 1;
    renderCurrentQuestion();
  } else {
    finishSession();
  }
}

async function finishSession() {
  if (!activeSession) return;
  const results = activeSession.results;
  const total = activeSession.questions.length;
  const correct = results.filter((result) => result.correct).length;
  const answered = results.length;
  const pct = answered ? Math.round((correct / answered) * 100) : 0;
  const completedSession = {
    id: activeSession.id,
    title: activeSession.filters?.retakeOf ? `Retake ${getTestDisplayId({ id: activeSession.filters.retakeOf })}` : `Practice block ${new Date(activeSession.createdAt).toLocaleDateString()}`,
    mode: activeSession.mode,
    createdAt: activeSession.createdAt,
    questionIds: activeSession.questions,
    results: activeSession.results,
    filters: activeSession.filters || {}
  };

  if (answered || total) {
    state.sessions = [completedSession, ...(state.sessions || []).filter((session) => session.id !== completedSession.id)];
    saveState();
    try {
      await saveCloudSession(completedSession);
    } catch (error) {
      setCloudMessage(`Test saved locally. Run the updated Supabase SQL if cloud test history does not save: ${error.message}`);
    }
  }

  elements.questionStage.classList.add("hidden");
  elements.sessionSetup.classList.remove("hidden");
  elements.sessionResults.classList.remove("hidden");
  elements.sessionResults.innerHTML = `<h3>Block complete</h3>
    <div class="results-grid">
      <article class="metric"><span>Score</span><strong>${pct}%</strong></article>
      <article class="metric"><span>Correct</span><strong>${correct}</strong></article>
      <article class="metric"><span>Answered</span><strong>${answered}/${total}</strong></article>
    </div>
    <h3>Review</h3>
    ${results
      .map((result) => {
        const question = state.questions.find((item) => item.id === result.questionId);
        return `<div class="review-item">
          <strong>${result.correct ? "Correct" : "Missed"}</strong>
          <p><b>Q${question.questionNumber}</b> ${escapeHtml(truncate(question.stem, 180))}</p>
          <p><b>Your answer:</b> ${escapeHtml(question.choices[result.selectedAnswer] || "No answer")}</p>
          <p><b>Correct answer:</b> ${escapeHtml(question.choices[question.answerIndex])}</p>
        </div>`;
      })
      .join("")}`;
  activeSession = null;
  renderAll();
}

function getCurrentQuestion() {
  return state.questions.find((question) => question.id === activeSession.questions[activeSession.index]);
}

async function importQuestions() {
  elements.importMessage.textContent = "";
  try {
    const parsed = JSON.parse(elements.importInput.value);
    const incoming = Array.isArray(parsed) ? parsed : parsed.questions || [parsed];
    const normalized = incoming.map(normalizeImportedQuestion);
    const importedSessions = Array.isArray(parsed.sessions) ? ensureStateShape({ questions: [], sessions: parsed.sessions }).sessions : [];
    state.questions = [...normalized, ...state.questions];
    state.sessions = [...importedSessions, ...(state.sessions || [])];
    saveState();
    if (cloudReady) {
      const { error: questionError } = await supabaseClient.from("questions").upsert(normalized.map(questionToDb), { onConflict: "id" });
      if (questionError) throw questionError;
      const attempts = normalized.flatMap((question) => (question.attempts || []).map((attempt) => attemptToDb(question.id, attempt)));
      if (attempts.length) {
        const { error: attemptError } = await supabaseClient.from("attempts").upsert(attempts, { onConflict: "id" });
        if (attemptError) throw attemptError;
      }
      if (importedSessions.length) {
        const { error: sessionError } = await supabaseClient.from("test_sessions").upsert(importedSessions.map(sessionToDb), { onConflict: "id" });
        if (sessionError) setCloudMessage("Questions imported. Run the updated Supabase SQL to enable saved test history sync.");
      }
    }
    renderAll();
    elements.importInput.value = "";
    elements.importMessage.textContent = `Imported ${normalized.length} question${normalized.length === 1 ? "" : "s"}${importedSessions.length ? ` and ${importedSessions.length} test${importedSessions.length === 1 ? "" : "s"}` : ""}${cloudReady ? " to Supabase" : " locally"}.`;
  } catch (error) {
    elements.importMessage.textContent = error.message;
  }
}

function exportBackup() {
  const backup = {
    app: "QuestionForge",
    exportedAt: new Date().toISOString(),
    questions: state.questions,
    sessions: state.sessions || []
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `questionforge-backup-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  elements.importMessage.textContent = "Backup downloaded. Keep that JSON file somewhere safe.";
}

function normalizeImportedQuestion(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Each item must be a question object.");
  const choices = Array.isArray(raw.choices) ? raw.choices.map(String).filter(Boolean) : [];
  if (!raw.stem || choices.length < 2 || raw.answerIndex === undefined || !raw.explanation) {
    throw new Error("Each question needs stem, choices, answerIndex, and explanation.");
  }
  const answerIndex = Number(raw.answerIndex);
  if (Number.isNaN(answerIndex) || answerIndex < 0 || answerIndex >= choices.length) {
    throw new Error("answerIndex must point to one of the choices, starting at 0.");
  }

  return {
    id: raw.id || crypto.randomUUID(),
    stem: String(raw.stem),
    choices,
    answerIndex,
    explanation: String(raw.explanation),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).filter(Boolean) : splitTags(String(raw.tags || "")),
    difficulty: raw.difficulty || "Medium",
    source: raw.source || "",
    flagged: Boolean(raw.flagged),
    attempts: Array.isArray(raw.attempts) ? raw.attempts : []
  };
}

function splitTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function shuffle(items) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function truncate(value, limit) {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.jump));
});

document.querySelector("#beginSession").addEventListener("click", startSession);
document.querySelector("#endSession").addEventListener("click", finishSession);
elements.submitAnswer.addEventListener("click", submitCurrentAnswer);
elements.nextQuestion.addEventListener("click", moveNextOrFinish);

elements.questionChoices.addEventListener("click", (event) => {
  const button = event.target.closest(".choice-button");
  if (!button || answerSubmitted) return;
  selectedAnswer = Number(button.dataset.choice);
  [...elements.questionChoices.children].forEach((choiceButton) => choiceButton.classList.remove("selected"));
  button.classList.add("selected");
  elements.submitAnswer.disabled = false;
});

elements.flagQuestion.addEventListener("click", async () => {
  const question = getCurrentQuestion();
  question.flagged = !question.flagged;
  saveState();
  try {
    await saveCloudQuestion(question);
  } catch (error) {
    setCloudMessage(`Flag saved locally, but Supabase did not save it: ${error.message}`);
  }
  renderCurrentQuestion();
  renderAll();
});

elements.questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formQuestion = readFormQuestion();
    const editingId = elements.editingId.value;
    let savedQuestion;
    if (editingId) {
      const existing = state.questions.find((question) => question.id === editingId);
      const wasFlagged = existing.flagged;
      const priorAttempts = existing.attempts || [];
      Object.assign(existing, formQuestion, {
        id: existing.id,
        flagged: wasFlagged,
        attempts: priorAttempts
      });
      savedQuestion = existing;
    } else {
      savedQuestion = { id: crypto.randomUUID(), ...formQuestion };
      state.questions.unshift(savedQuestion);
    }
    saveState();
    await saveCloudQuestion(savedQuestion);
    clearForm();
    renderAll();
  } catch (error) {
    alert(error.message);
  }
});

document.querySelector("#addChoice").addEventListener("click", () => addChoiceInput());
document.querySelector("#clearForm").addEventListener("click", clearForm);
document.querySelector("#newQuestionButton").addEventListener("click", clearForm);
elements.bankSearch.addEventListener("input", renderQuestionList);
elements.bankStatusFilter.addEventListener("change", renderQuestionList);
elements.topicFilterList.addEventListener("change", () => {});
elements.clearTopics.addEventListener("click", () => {
  elements.topicFilterList.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.checked = false;
  });
});

elements.testHistoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-session]");
  if (!button) return;
  renderTestReview(button.dataset.session);
});

elements.testReviewPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-retake]");
  if (!button) return;
  retakeSession(button.dataset.retake);
});

elements.questionList.addEventListener("click", async (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) {
    const question = state.questions.find((item) => item.id === editId);
    if (question) fillForm(question);
  }
  if (deleteId && confirm("Delete this question?")) {
    state.questions = state.questions.filter((question) => question.id !== deleteId);
    saveState();
    try {
      await deleteCloudQuestion(deleteId);
    } catch (error) {
      setCloudMessage(`Question deleted locally, but Supabase did not delete it: ${error.message}`);
    }
    renderAll();
  }
});

elements.supabaseSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  let url = elements.supabaseUrlInput.value.trim();
  const key = elements.supabaseKeyInput.value.trim();
  try {
    if (!url || !key) throw new Error("Paste both your Supabase project URL and public anon key.");
    url = normalizeSupabaseUrl(url);
    elements.supabaseUrlInput.value = url;
    saveSupabaseConfig(url, key);
    configureSupabase(url, key);
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    currentUser = data.session?.user || null;
    cloudReady = Boolean(currentUser);
    if (currentUser) await loadCloudData();
    setCloudMessage("Supabase connection saved.");
    renderAll();
  } catch (error) {
    setCloudMessage(error.message);
  }
});

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const { email, password } = readAuthCredentials();
    await signIn(email, password);
  } catch (error) {
    setAuthMessage(error.message);
  }
});

elements.signUpButton.addEventListener("click", async () => {
  try {
    const { email, password } = readAuthCredentials();
    await signUp(email, password);
  } catch (error) {
    setAuthMessage(error.message);
  }
});

elements.signOutButton.addEventListener("click", async () => {
  try {
    await signOut();
  } catch (error) {
    setAuthMessage(error.message);
  }
});

elements.syncLocalButton.addEventListener("click", async () => {
  try {
    await syncLocalToCloud();
  } catch (error) {
    setCloudMessage(error.message);
  }
});

document.querySelector("#importQuestions").addEventListener("click", importQuestions);
elements.exportBackup.addEventListener("click", exportBackup);
document.querySelector("#loadSample").addEventListener("click", () => {
  elements.importInput.value = JSON.stringify(
    [
      {
        stem: "A 47-year-old has fatigue, constipation, and cold intolerance. TSH is elevated and free T4 is low. What is the most likely diagnosis?",
        choices: ["Primary hypothyroidism", "Secondary hyperthyroidism", "Graves disease", "Subacute thyroiditis"],
        answerIndex: 0,
        explanation: "Elevated TSH with low free T4 indicates primary hypothyroidism because the thyroid gland is underproducing hormone despite pituitary stimulation.",
        tags: ["endocrinology", "thyroid"],
        difficulty: "Easy",
        source: "Example AI import"
      }
    ],
    null,
    2
  );
});

clearForm();
renderAll();
initializeSupabase();
