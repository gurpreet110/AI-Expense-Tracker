import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.Gemini_API_Key });
const MODEL = 'gemini-2.5-flash';

/* ---------------------------- Helpers ---------------------------- */

// Gemini kabhi kabhi ```json ... ``` me wrap karke bhejta hai, usse saaf karta hai
const stripMarkdown = (text) => {
  let clean = (text || '').trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  }
  return clean.trim();
};

// Common function: prompt bhejo -> parsed JSON wapas lo
const askGeminiJSON = async (prompt, label) => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' }, // JSON output force karta hai
    });
    return JSON.parse(stripMarkdown(response.text));
  } catch (error) {
    console.error(`Gemini API error (${label}):`, error);
    throw new Error(`Failed to generate ${label}. Please try again.`);
  }
};

const fmt = (n) => Number(n || 0).toFixed(2);

/* ------------------------ 1. Monthly Insight ------------------------ */

export const generateMonthlyInsight = async ({
  totalIncome,
  totalExpenses,
  savingsRate,
  expenseBreakdown = [],
  previousMonths = [],
  currency = 'USD',
}) => {
  const breakdownText = expenseBreakdown.length > 0
    ? expenseBreakdown.map((c) => `- ${c.category}: ${currency} ${fmt(c.amount)}`).join('\n')
    : '- No expenses recorded yet';

  const trendText = previousMonths.length > 0
    ? previousMonths
        .map((m) => `- ${m.month}: Income ${currency} ${fmt(m.income)}, Expenses ${currency} ${fmt(m.expenses)}`)
        .join('\n')
    : '- No previous month data available';

  const prompt = `Analyze this user's monthly financial data and generate actionable insights.

This month:
- Total income: ${currency} ${fmt(totalIncome)}
- Total expenses: ${currency} ${fmt(totalExpenses)}
- Savings rate: ${fmt(savingsRate)}%

Expense breakdown:
${breakdownText}

Previous months trend:
${trendText}

Return ONLY valid JSON (no markdown, no commentary) in this exact structure:
{
  "summary": "2-3 sentence summary of the user's financial health this month",
  "highlights": ["Positive observation 1", "Positive observation 2"],
  "concerns": ["Concern 1", "Concern 2"],
  "recommendations": [
    {"title": "Short title", "detail": "Actionable suggestion (1-2 sentences)"}
  ],
  "topSpendingCategory": "Category name or null",
  "estimatedMonthlySavings": number,
  "healthScore": number
}

Constraints:
- "healthScore" must be an integer between 0 and 100.
- Provide exactly 3 recommendations.
- Reference actual numbers from the data. Tone: friendly but honest.`;

  return askGeminiJSON(prompt, 'monthly insight');
};

/* ------------------------ 2. Single Budget Alert ------------------------ */

export const generateBudgetAlert = async ({
  categoryName,
  budgetAmount,
  spentAmount,
  daysIntoPeriod,
  totalPeriodDays,
  currency = 'USD',
}) => {
  const percentUsed = budgetAmount > 0 ? ((spentAmount / budgetAmount) * 100).toFixed(1) : '0.0';
  const daysLeft = totalPeriodDays - daysIntoPeriod;

  const prompt = `A user is tracking a budget. Generate a helpful alert.

Category: ${categoryName}
Budget: ${currency} ${fmt(budgetAmount)}
Spent so far: ${currency} ${fmt(spentAmount)} (${percentUsed}% used)
Days into period: ${daysIntoPeriod} of ${totalPeriodDays} (${daysLeft} days remaining)

Return ONLY valid JSON (no markdown):
{
  "severity": "info|warning|critical",
  "title": "Short alert title",
  "message": "1-2 sentence empathetic message referencing actual numbers",
  "suggestions": ["Specific action 1", "Specific action 2", "Specific action 3"]
}

Severity guide:
- info: under 70% spent
- warning: 70-100% spent
- critical: over 100% spent`;

  return askGeminiJSON(prompt, 'budget alert');
};

/* ------------------------ 3. Analyze All Budgets ------------------------ */

// budgets: [{ category, limit, spent }]
export const analyzeBudgetList = async ({ budgets = [], currency = 'USD' }) => {
  if (budgets.length === 0) {
    return {
      overallStatus: 'no_data',
      summary: 'No budgets found. Create a budget to get insights.',
      overspentCategories: [],
      atRiskCategories: [],
      wellManagedCategories: [],
      recommendations: [],
    };
  }

  const budgetText = budgets
    .map((b) => {
      const pct = b.limit > 0 ? ((b.spent / b.limit) * 100).toFixed(1) : '0.0';
      return `- ${b.category}: Budget ${currency} ${fmt(b.limit)}, Spent ${currency} ${fmt(b.spent)} (${pct}% used)`;
    })
    .join('\n');

  const prompt = `Analyze all of this user's budgets and find overspending.

Budgets:
${budgetText}

Return ONLY valid JSON (no markdown) in this exact structure:
{
  "overallStatus": "healthy|caution|critical",
  "summary": "2-3 sentence overview referencing actual numbers",
  "overspentCategories": [{"category": "name", "overBy": number, "advice": "short advice"}],
  "atRiskCategories": [{"category": "name", "percentUsed": number, "advice": "short advice"}],
  "wellManagedCategories": ["category name"],
  "recommendations": [{"title": "Short title", "detail": "1-2 sentence actionable step"}]
}

Rules:
- overspent = over 100% used, at risk = 70-100% used, well managed = under 70%.
- Provide 3 recommendations. Tone: friendly but honest.`;

  return askGeminiJSON(prompt, 'budget analysis');
};

/* ------------------------ 4. Savings Tips ------------------------ */

export const generateSavingsTips = async ({
  totalIncome,
  totalExpenses,
  savingsRate,
  expenseBreakdown = [],
  savingsGoal = null, // optional: { name, targetAmount, currentAmount }
  currency = 'USD',
}) => {
  const breakdownText = expenseBreakdown.length > 0
    ? expenseBreakdown.map((c) => `- ${c.category}: ${currency} ${fmt(c.amount)}`).join('\n')
    : '- No expenses recorded yet';

  const goalText = savingsGoal
    ? `Savings goal: ${savingsGoal.name}, target ${currency} ${fmt(savingsGoal.targetAmount)}, saved so far ${currency} ${fmt(savingsGoal.currentAmount)}`
    : 'No specific savings goal set.';

  const prompt = `Generate personalised savings tips for this user.

Monthly income: ${currency} ${fmt(totalIncome)}
Monthly expenses: ${currency} ${fmt(totalExpenses)}
Savings rate: ${fmt(savingsRate)}%
${goalText}

Expense breakdown:
${breakdownText}

Return ONLY valid JSON (no markdown) in this exact structure:
{
  "tips": [
    {
      "title": "Short title",
      "detail": "Practical 1-2 sentence tip tied to the user's real numbers",
      "category": "Related expense category or General",
      "potentialMonthlySaving": number,
      "difficulty": "easy|medium|hard"
    }
  ],
  "totalPotentialSavings": number,
  "motivation": "One short encouraging sentence"
}

Rules:
- Provide 4-5 tips, sorted by biggest saving first.
- Focus on the highest-spending categories.
- Keep suggestions realistic, not extreme.`;

  return askGeminiJSON(prompt, 'savings tips');
};

/* ------------------------ 5. Transaction Patterns ------------------------ */

// transactions: [{ date, category, amount, type: 'income'|'expense', description }]
export const analyzeTransactionList = async ({ transactions = [], currency = 'USD' }) => {
  if (transactions.length === 0) {
    return {
      summary: 'No transactions to analyze.',
      patterns: [],
      unusualTransactions: [],
      recurringExpenses: [],
      recommendations: [],
    };
  }

  // Token bachane ke liye sirf latest 100 transactions bhejo
  const recent = transactions.slice(0, 100);
  const txText = recent
    .map((t) => {
      const d = t.date ? new Date(t.date).toISOString().split('T')[0] : 'unknown-date';
      return `- ${d} | ${t.type} | ${t.category} | ${currency} ${fmt(t.amount)} | ${t.description || 'n/a'}`;
    })
    .join('\n');

  const prompt = `Analyze these transactions for spending patterns and unusual activity.

Transactions (date | type | category | amount | description):
${txText}

Return ONLY valid JSON (no markdown) in this exact structure:
{
  "summary": "2-3 sentence overview of spending behaviour",
  "patterns": [{"title": "Pattern name", "detail": "What you noticed (e.g. weekend spikes, frequent small purchases)"}],
  "unusualTransactions": [{"date": "YYYY-MM-DD", "category": "name", "amount": number, "reason": "Why it looks unusual"}],
  "recurringExpenses": [{"description": "name", "approxAmount": number, "frequency": "weekly|monthly|other"}],
  "recommendations": [{"title": "Short title", "detail": "1-2 sentence actionable suggestion"}]
}

Rules:
- Only flag a transaction as unusual if it is clearly larger or different from the user's normal behaviour.
- Reference actual numbers. Provide 3 recommendations.
- If nothing is unusual, return an empty array for "unusualTransactions".`;

  return askGeminiJSON(prompt, 'transaction analysis');
};


export default{
    generateBudgetAlert,
    generateMonthlyInsight,
    generateSavingsTips,
    analyzeTransactionList,
    analyzeBudgetList
}