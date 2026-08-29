export const FEEDBACK_CATEGORIES = ["Bug", "Feature request", "Usability", "Data / calculation issue", "Other"];
export const FEEDBACK_STATUSES = ["New", "Reviewing", "Planned", "Resolved", "Closed"];
export const FEEDBACK_PRIORITIES = ["Low", "Normal", "High", "Critical"];
export const FEEDBACK_MAX_MESSAGE = 4000;

export function validateFeedbackInput(input = {}) {
  const category = String(input.category || "").trim();
  const message = String(input.message || "").trim();
  if (!FEEDBACK_CATEGORIES.includes(category)) throw new Error("Choose a valid feedback category.");
  if (!message) throw new Error("Feedback message is required.");
  if (message.length > FEEDBACK_MAX_MESSAGE) throw new Error(`Feedback message must be ${FEEDBACK_MAX_MESSAGE} characters or fewer.`);
  return { category, message };
}

export function feedbackMetadata({ version, buildId, page, userAgent } = {}) {
  return {
    app_version: String(version || "").slice(0, 32),
    build_id: String(buildId || "").slice(0, 64),
    page: String(page || "").slice(0, 120),
    browser: String(userAgent || "").slice(0, 160),
  };
}

export function feedbackPayload(input, context = {}) {
  const { category, message } = validateFeedbackInput(input);
  return { category, message, ...feedbackMetadata(context) };
}

export function normalizeFeedback(value = {}) {
  return {
    id: String(value.id || ""),
    user_id: String(value.user_id || ""),
    category: FEEDBACK_CATEGORIES.includes(value.category) ? value.category : "Other",
    message: String(value.message || ""),
    page: String(value.page || ""),
    app_version: String(value.app_version || ""),
    build_id: String(value.build_id || ""),
    status: FEEDBACK_STATUSES.includes(value.status) ? value.status : "New",
    priority: FEEDBACK_PRIORITIES.includes(value.priority) ? value.priority : "Normal",
    admin_note: String(value.admin_note || ""),
    created_at: value.created_at || null,
    updated_at: value.updated_at || null,
    user_email: String(value.user_email || ""),
  };
}

export function normalizeFeedbackList(value) {
  if (!Array.isArray(value)) throw new Error("Feedback API returned an invalid response.");
  return value.map(normalizeFeedback);
}

export function isSafeFeedbackPayload(payload) {
  const allowed = new Set(["category", "message", "app_version", "build_id", "page", "browser"]);
  return payload && Object.keys(payload).every(key => allowed.has(key));
}
