export function agentLocale(value = "en") {
  if (!["en", "zh-CN"].includes(value)) {
    const error = new Error("Unsupported language. Use en or zh-CN.");
    error.status = 400;
    throw error;
  }
  return value;
}
export const responseLanguage = (locale) =>
  locale === "zh-CN"
    ? "Simplified Chinese (简体中文), including findings, explanation and next checks"
    : "British English";
export const incompleteReport = (locale) =>
  locale === "zh-CN"
    ? "AI 解释尚未完成。已保留下方数值依据，未应用任何控制。请查看工具结果后重试。"
    : "The AI explanation is incomplete. Completed numerical evidence has been preserved below. No controls were applied. Review the tool results before retrying.";
export const withheldReport = (locale) =>
  locale === "zh-CN"
    ? "AI 解释包含未经核查的数值，因此未予显示。请查看下方权威工具依据，或重新请求定性说明。"
    : "The AI explanation was withheld because it included unchecked numerical claims. Inspect the authoritative tool evidence below, or ask a qualitative follow-up.";
export const matchesLanguage = (answer, locale) =>
  locale !== "zh-CN" || /[\u3400-\u9fff]/u.test(answer);
