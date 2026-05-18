const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth'); 
const Submission = require('../models/submission.model');
const VivaSession = require('../models/vivaSession.model');
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage, AIMessage, SystemMessage } = require("@langchain/core/messages");

class VivaService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY; 
    this.modelName = "gemini-3.1-flash-lite";

    if (!this.apiKey) {
      console.error("🚨 CRITICAL: GEMINI_API_KEY is missing or undefined! Check your .env file.");
    }
  }

  async extractTextFromUrl(url) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const lowerUrl = url.toLowerCase();

      if (lowerUrl.endsWith('.pdf')) {
        const pdfData = await pdfParse(response.data);
        return pdfData.text;
      } else if (lowerUrl.endsWith('.docx')) {
        const docxData = await mammoth.extractRawText({ buffer: response.data });
        return docxData.value;
      } else {
        return Buffer.from(response.data, 'binary').toString('utf-8');
      }
    } catch (error) {
      console.error(`Failed to extract text from ${url}:`, error.message);
      return ""; 
    }
  }

  async buildProjectContext(groupId) {
    const submissions = await Submission.find({
      group: groupId,
      status: { $in: ['Graded', 'Approved'] }
    }).populate('phase', 'name');

    let combinedText = "PROJECT DOCUMENTATION CONTEXT:\n\n";

    const extractionPromises = submissions.map(async (sub) => {
      if (sub.attachments && sub.attachments.length > 0) {
        const doc = sub.attachments.find(a => a.url.match(/\.(pdf|txt|md|docx)$/i));
        if (doc) {
          const text = await this.extractTextFromUrl(doc.url);
          return `--- Stage: ${sub.phase?.name || 'Unknown'} ---\n${text}\n\n`;
        }
      }
      return "";
    });

    const results = await Promise.all(extractionPromises);
    combinedText += results.join("");

    if (combinedText.trim().length < 50) {
      combinedText = "The student did not provide readable text documents. Ask them general MERN stack architecture questions based on their project title.";
    }

    return combinedText;
  }

  async startSession(student, group, project, devMode = false) {
    const activeSession = await VivaSession.findOne({ student: student._id, status: 'In Progress' });
    if (activeSession) throw new Error("You already have an active Mock Viva session.");

    if (!devMode && project.status !== 'Approved') {
      throw new Error("Mock Viva is only available for approved projects.");
    }

    const context = await this.buildProjectContext(group._id);

    const systemPrompt = `
You are an experienced University Viva Panel Examiner conducting a professional Final Year Project Mock Viva for a computer science student.

You have already reviewed the student's submitted project documentation.

PROJECT CONTEXT:
${context}

YOUR ROLE:
- Act exactly like a real university examiner.
- Be professional, concise, and academically strict.
- Focus only on the student's actual project.
- Ask technically meaningful questions that test understanding, implementation knowledge, architecture decisions, security, scalability, database design, APIs, deployment, and problem-solving ability.

STRICT RULES:
1. Ask ONLY ONE question at a time.
2. NEVER ask multi-part questions.
3. NEVER provide explanations, hints, teaching, or answers.
4. NEVER praise the student excessively.
5. Keep questions short, natural, and realistic.
6. Questions must sound like a real viva panel discussion.
7. If the project uses MERN stack, ask stack-specific questions naturally.
8. Start with an introduction question about the student's role and contributions.
9. Avoid repeating previous topics unnecessarily.
10. Do not generate bullet points or long paragraphs.

FIRST RESPONSE FORMAT:
- Brief greeting
- Mention you reviewed their project
- Ask what their personal role/contribution was in the project
`;

    const llm = new ChatGoogleGenerativeAI({
      model: this.modelName, 
      apiKey: this.apiKey,
      temperature: 0.7, 
    });

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage("Start the mock viva.")
    ];

    const response = await llm.invoke(messages);
    const firstQuestion = response.content;

    const session = new VivaSession({
      student: student._id,
      group: group._id,
      project: project._id,
      extractedContext: context,
      chatTranscript: [{ role: 'model', text: firstQuestion }]
    });

    await session.save();

    return {
      sessionId: session._id,
      question: firstQuestion
    };
  }

  async handleChatMessage(sessionId, studentId, messageText) {
    const session = await VivaSession.findOne({ _id: sessionId, student: studentId }).select('+extractedContext');
    if (!session) throw new Error("Session not found.");
    if (session.status !== 'In Progress') throw new Error("This viva session has ended.");

    session.chatTranscript.push({ role: 'user', text: messageText });

    const systemPrompt = `
You are acting as a strict and experienced university viva examiner for a Final Year Software Engineering project.

PROJECT KNOWLEDGE BASE:
${session.extractedContext}

YOUR TASK:
Conduct a realistic oral technical viva examination.

EXAMINER BEHAVIOR:
- Ask intelligent, realistic technical questions.
- Evaluate the student's previous answer internally before generating the next question.
- Keep the viva conversational and professional.
- Focus on implementation understanding, not textbook theory.
- Ask questions related to:
  - System architecture
  - Backend logic
  - Database design
  - Authentication & authorization
  - API handling
  - Security
  - Scalability
  - State management
  - Deployment
  - Error handling
  - Performance optimization
  - Real project decisions
  - Team contribution

DECISION LOGIC:
- If the student's previous answer was weak, vague, incorrect, or overly generic:
  -> Ask a deeper follow-up question on the SAME topic.
- If the student's answer was technically strong:
  -> Move naturally to another technical area.
- If the student avoids technical depth:
  -> Ask implementation-specific questions.
- If the student claims they built something:
  -> Ask how exactly they implemented it.

STRICT RULES:
1. Ask ONLY ONE question.
2. NEVER ask multiple questions together.
3. NEVER explain answers.
4. NEVER teach concepts.
5. NEVER compliment excessively.
6. NEVER break character as an examiner.
7. NEVER use bullet points.
8. Keep responses under 50 words.
9. Questions must feel natural and human.
10. Base questions ONLY on the provided project context and conversation history.
`;

    const llm = new ChatGoogleGenerativeAI({
      model: this.modelName, 
      apiKey: this.apiKey,
      temperature: 0.6, 
    });

    const messages = [new SystemMessage(systemPrompt)];
    
    session.chatTranscript.forEach(msg => {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.text));
      } else {
        messages.push(new AIMessage(msg.text));
      }
    });

    const response = await llm.invoke(messages);
    const nextQuestion = response.content;

    session.chatTranscript.push({ role: 'model', text: nextQuestion });
    await session.save();

    return { question: nextQuestion };
  }

  async evaluateSession(sessionId, studentId) {
    const session = await VivaSession.findOne({ _id: sessionId, student: studentId });
    if (!session) throw new Error("Session not found.");
    if (session.status === 'Completed') return session.evaluation;

    const transcriptString = session.chatTranscript.map(msg =>
      `${msg.role === 'model' ? 'EXAMINER' : 'STUDENT'}: ${msg.text}`
    ).join('\n\n');

    const prompt = `
You are a senior university evaluator assessing a Final Year Project Mock Viva.

Analyze the following viva transcript carefully.

TRANSCRIPT:
${transcriptString}

EVALUATION CRITERIA:
- Technical understanding
- Project ownership
- Backend knowledge
- Database understanding
- API knowledge
- Security awareness
- Problem-solving ability
- Communication clarity
- Confidence
- Practical implementation understanding

SCORING RULES:
- 90-100 = Exceptional technical mastery
- 75-89 = Strong understanding with minor weaknesses
- 60-74 = Average understanding with noticeable gaps
- 40-59 = Weak technical depth
- Below 40 = Poor understanding or inability to explain implementation

IMPORTANT:
- Be academically strict and realistic.
- Do not inflate scores.
- Penalize vague, theoretical, or generic answers.
- Reward implementation-level clarity and confidence.
- Evaluate based on BOTH technical depth and communication quality.

You must respond ONLY with valid JSON.

Required JSON schema:
{
  "score": number,
  "strengths": [
    "string",
    "string",
    "string"
  ],
  "weaknesses": [
    "string",
    "string",
    "string"
  ],
  "advice": "string"
}

STRICT OUTPUT RULES:
- No markdown formatting wrappers like \`\`\`json
- No explanations
- No extra text
- Output raw JSON only
`;

    const llm = new ChatGoogleGenerativeAI({
      model: this.modelName, 
      apiKey: this.apiKey,
      temperature: 0.1, 
    });

    const messages = [new HumanMessage(prompt)];

    try {
      const response = await llm.invoke(messages);
      let jsonText = response.content;
      jsonText = jsonText.replace(/```json|```/g, '').trim();

      const evaluationResult = JSON.parse(jsonText);

      session.evaluation = evaluationResult;
      session.status = 'Completed';
      session.completedAt = new Date();
      await session.save();

      return evaluationResult;

    } catch (error) {
      console.error("Evaluation parsing failed:", error);
      session.status = 'Error';
      await session.save();
      throw new Error("Failed to generate AI evaluation report.");
    }
  }
}

module.exports = new VivaService();