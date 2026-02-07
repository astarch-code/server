const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();

// --- CORS Configuration ---
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:3000']
  : ['http://localhost:3000', 'http://localhost:5173'];

console.log('Allowed CORS origins:', allowedOrigins);

// --- Load data from JSON files ---
let preExperimentQuestions = [];
let postExperimentQuestions = { even: [], odd: [] };
let ticketTemplates = [];
let kbArticles = [];

function loadDataFromJson() {
  try {
    // Load survey questions
    const preExperimentPath = path.join(__dirname, 'data', 'pre-experiment-survey.json');
    const postExperimentPath = path.join(__dirname, 'data', 'post-experiment-survey.json');
    const ticketTemplatesPath = path.join(__dirname, 'data', 'ticket-templates.json');
    const kbArticlesPath = path.join(__dirname, 'data', 'kb-articles.json');

    if (fs.existsSync(preExperimentPath)) {
      const data = fs.readFileSync(preExperimentPath, 'utf8');
      preExperimentQuestions = JSON.parse(data);
      console.log('✅ Loaded pre-experiment survey questions from file');
    } else {
      console.log('⚠️ pre-experiment-survey.json not found, using default questions');
      preExperimentQuestions = [
        { id: 'pre_1', question: 'What is your age?', type: 'text', required: true, placeholder: 'Enter your age' },
        { id: 'pre_2', question: 'What is your gender?', type: 'multiple', required: true, options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
        { id: 'pre_3', question: 'What is your highest level of education?', type: 'multiple', required: true, options: ['High School', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD', 'Other'] },
        { id: 'pre_4', question: 'How familiar are you with IT support systems?', type: 'multiple', required: true, options: ['Not familiar at all', 'Slightly familiar', 'Moderately familiar', 'Very familiar', 'Expert'] },
        { id: 'pre_5', question: 'Have you ever worked in IT support or a similar role?', type: 'multiple', required: true, options: ['Yes, professionally', 'Yes, informally', 'No, never'] }
      ];
    }

    if (fs.existsSync(postExperimentPath)) {
      const data = fs.readFileSync(postExperimentPath, 'utf8');
      postExperimentQuestions = JSON.parse(data);
      console.log('✅ Loaded post-experiment survey questions from file');
    } else {
      console.log('⚠️ post-experiment-survey.json not found, using default questions');
      postExperimentQuestions = {
        even: [
          { id: 'post_even_1', question: 'How helpful was the AI assistant?', type: 'multiple', required: true, options: ['Not helpful at all', 'Slightly helpful', 'Moderately helpful', 'Very helpful', 'Extremely helpful'] },
          { id: 'post_even_2', question: 'Did the AI assistant improve your efficiency?', type: 'multiple', required: true, options: ['Not at all', 'Slightly improved', 'Moderately improved', 'Significantly improved', 'Extremely improved'] },
          { id: 'post_even_3', question: 'Would you prefer to work with AI assistance in the future?', type: 'multiple', required: true, options: ['Definitely not', 'Probably not', 'Neutral', 'Probably yes', 'Definitely yes'] },
          { id: 'post_even_4', question: 'What aspects of the AI assistant could be improved?', type: 'text', required: false, placeholder: 'Enter your suggestions' }
        ],
        odd: [
          { id: 'post_odd_1', question: 'How helpful were your colleagues?', type: 'multiple', required: true, options: ['Not helpful at all', 'Slightly helpful', 'Moderately helpful', 'Very helpful', 'Extremely helpful'] },
          { id: 'post_odd_2', question: 'Did working with colleagues improve your efficiency?', type: 'multiple', required: true, options: ['Not at all', 'Slightly improved', 'Moderately improved', 'Significantly improved', 'Extremely improved'] },
          { id: 'post_odd_3', question: 'Would you prefer to work with colleagues in the future?', type: 'multiple', required: true, options: ['Definitely not', 'Probably not', 'Neutral', 'Probably yes', 'Definitely yes'] },
          { id: 'post_odd_4', question: 'What aspects of teamwork could be improved?', type: 'text', required: false, placeholder: 'Enter your suggestions' }
        ]
      };
    }

    if (fs.existsSync(ticketTemplatesPath)) {
      const data = fs.readFileSync(ticketTemplatesPath, 'utf8');
      ticketTemplates = JSON.parse(data);
      console.log('✅ Loaded ticket templates from file');
    } else {
      console.log('⚠️ ticket-templates.json not found, using default templates');
      ticketTemplates = [
        { title: 'VPN Not Working From Home', desc: 'Employee cannot connect to the network.' },
        { title: 'Printer in Accounting Jammed Paper', desc: 'Print queue stalled, red light blinking.' },
        { title: '1C Crashed During Report', desc: 'Program closes with memory error.' },
        { title: 'Access Needed to Network Folder', desc: 'Marketing needs access to Z drive.' },
        { title: 'Outlook Not Receiving Email', desc: 'Last email received 3 hours ago.' }
      ];
    }

    if (fs.existsSync(kbArticlesPath)) {
      const data = fs.readFileSync(kbArticlesPath, 'utf8');
      kbArticles = JSON.parse(data);
      console.log('✅ Loaded knowledge base articles from file');
    } else {
      console.log('⚠️ kb-articles.json not found, using default articles');
      kbArticles = [
        { id: 'kb_101', title: 'VPN Connection Error (Error 800)', content: 'Check user certificates in the Certs folder. If they have expired, reissue via the portal. Restart Cisco AnyConnect.' },
        { id: 'kb_102', title: 'Printer Paper Jam (HP 4000)', content: 'Open tray 2 and check the pickup rollers. If rollers are worn, replacement is required. Temporary solution: clean with alcohol.' },
        { id: 'kb_103', title: 'Outlook Not Synchronizing', content: 'Check connection to Exchange. Disable Cached Mode in account settings, restart Outlook, then enable again.' },
        { id: 'kb_104', title: 'Blue Screen (BSOD) SYSTEM_THREAD', content: 'Error caused by old video card drivers. Update drivers via Device Manager or manufacturer website.' },
        { id: 'kb_105', title: 'SAP Password Reset', content: 'Use transaction SU01. Enter username, go to Logon Data tab and set temporary password.' }
      ];
    }
  } catch (error) {
    console.error('❌ Error loading data from JSON files:', error);
  }
}

loadDataFromJson();

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// --- PostgreSQL Connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables for survey responses only
async function initDatabase() {
  try {
    // Create survey responses table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_responses (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        participant_id VARCHAR(100),
        parity VARCHAR(10),
        stage INTEGER,
        question_id VARCHAR(50),
        question_text TEXT,
        answer TEXT
      )
    `);

    // Create post_experiment_survey table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_experiment_survey (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        participant_id VARCHAR(100),
        parity VARCHAR(10),
        question_id VARCHAR(50),
        question_text TEXT,
        answer TEXT
      )
    `);

    // Remove other tables that are not needed (tickets, logs, etc.)
    console.log('Survey database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDatabase();

// --- DATA ---
const BOT_LIFECYCLE_CONFIG = {
  checkInterval: 5000,
  leaveProbability: 0.15,
  returnProbability: 0.25
};

const AUTONOMOUS_AI_CONFIG = {
  missProbability: 20,
  failProbability: 40
};

const SHIFT_DURATION_MS = 600 * 1000; // 10 minutes in milliseconds

const baseAgents = [
  { id: 'bot1', name: 'Lukas Schneider (experienced and friendly worker)', skill: 0.9, trust: 0.9, greeting: "Hello! I'm on shift. Write if you need help.", status: 'online' },
  { id: 'bot2', name: 'Anna Müller (rookie)', skill: 0.5, trust: 0.5, greeting: "Hey. Lots of work...", status: 'online' },
  { id: 'bot3', name: 'Jonas Weber (very friendly)', skill: 0.4, trust: 0.7, greeting: "Good day, colleagues.", status: 'online' }
];

// --- SESSIONS STORAGE ---
const sessions = new Map(); // Key: participantId, Value: session object
const socketToParticipant = new Map(); // Key: socket.id, Value: participantId

// --- SESSION MANAGEMENT FUNCTIONS ---
const getOrCreateSession = (participantId, participantParity) => {
  if (!sessions.has(participantId)) {
    console.log(`🆕 Creating new session for participant: ${participantId} (${participantParity})`);

    const newSession = {
      participantId,
      participantParity,
      tickets: [],
      agents: JSON.parse(JSON.stringify(baseAgents)), // Deep copy of base agents
      currentStage: 1,
      currentAiMode: 'normal',
      stageStartTime: null,
      stageDuration: null,
      spawnInterval: null,
      botCheckInterval: null,
      stageTimerInterval: null,
      socketConnections: new Set() // Store socket IDs connected to this session
    };

    sessions.set(participantId, newSession);
    return newSession;
  }

  return sessions.get(participantId);
};

const getSessionBySocket = (socketId) => {
  const participantId = socketToParticipant.get(socketId);
  if (!participantId) {
    console.log(`❌ No participantId found for socket: ${socketId}`);
    console.log(`🔍 Current socketToParticipant mapping:`, Array.from(socketToParticipant.entries()));
    return null;
  }
  
  const session = sessions.get(participantId);
  if (!session) {
    console.log(`❌ No session found for participant: ${participantId}`);
    return null;
  }
  
  return session;
};

const cleanupSession = (participantId) => {
  const session = sessions.get(participantId);
  if (session) {
    // Clear intervals
    if (session.spawnInterval) {
      clearInterval(session.spawnInterval);
      console.log(`🛑 Cleared spawn interval for ${participantId}`);
    }
    if (session.botCheckInterval) {
      clearInterval(session.botCheckInterval);
      console.log(`🛑 Cleared bot check interval for ${participantId}`);
    }
    if (session.stageTimerInterval) {
      clearInterval(session.stageTimerInterval);
      console.log(`🛑 Cleared stage timer interval for ${participantId}`);
    }

    // Remove socket mappings
    for (const [socketId, pid] of socketToParticipant.entries()) {
      if (pid === participantId) {
        socketToParticipant.delete(socketId);
      }
    }

    // Remove session
    sessions.delete(participantId);
    console.log(`🗑️ Cleaned up session for ${participantId}`);
  }
};

// --- TIMER FUNCTIONS ---
const startStageTimerForSession = (session) => {
  // Очищаем предыдущий интервал, если он был
  if (session.stageTimerInterval) {
    clearInterval(session.stageTimerInterval);
    session.stageTimerInterval = null;
  }

  if (session.currentStage === 2 && session.stageStartTime && session.stageDuration) {
    console.log(`⏱️ Starting stage timer for session ${session.participantId}`);

    session.stageTimerInterval = setInterval(() => {
      const timeElapsed = Date.now() - session.stageStartTime;
      const timeLeftMs = Math.max(0, session.stageDuration - timeElapsed);
      const timeLeftSec = Math.floor(timeLeftMs / 1000);

      // Отправляем обновление времени всем клиентам в сессии
      session.socketConnections.forEach(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('shift:timer:update', { timeLeft: timeLeftSec });
        }
      });

      // Если время вышло, завершаем смену
      if (timeLeftMs <= 0) {
        clearInterval(session.stageTimerInterval);
        session.stageTimerInterval = null;

        // Отправляем событие о завершении времени
        session.socketConnections.forEach(socketId => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('shift:timeout');
          }
        });
      }
    }, 1000); // Обновляем каждую секунду
  }
};

const stopStageTimerForSession = (session) => {
  if (session.stageTimerInterval) {
    clearInterval(session.stageTimerInterval);
    session.stageTimerInterval = null;
    console.log(`🛑 Stopped stage timer for ${session.participantId}`);
  }
};

// --- LOGGING FUNCTIONS ---
const writeLog = async (action, user, details) => {
  // Only log to console, not to database
  console.log(`[LOG] ${action} (${user}): ${JSON.stringify(details)}`);
};

const saveSurveyResponse = async (participantId, parity, stage, questionId, questionText, answer) => {
  try {
    const query = `
      INSERT INTO survey_responses (participant_id, parity, stage, question_id, question_text, answer)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(query, [participantId, parity, stage, questionId, questionText, answer]);
    console.log(`[SURVEY] Saved response from ${participantId} (${parity}) for question ${questionId} at stage ${stage}`);
  } catch (error) {
    console.error('Error saving survey response:', error);
  }
};

const savePostExperimentResponse = async (participantId, parity, questionId, questionText, answer) => {
  try {
    const query = `
      INSERT INTO post_experiment_survey (participant_id, parity, question_id, question_text, answer)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(query, [participantId, parity, questionId, questionText, answer]);
    console.log(`[POST_EXPERIMENT] Saved response from ${participantId} (${parity}) for question ${questionId}`);
  } catch (error) {
    console.error('Error saving post-experiment response:', error);
  }
};

// --- SESSION-SPECIFIC LOGIC ---

const spawnTicketForSession = async (session, isCritical = false, tutorialTicket = false) => {
  // Убедитесь, что ticketTemplates загружены
  if (!ticketTemplates || ticketTemplates.length === 0) {
    console.error('❌ No ticket templates loaded!');
    return null;
  }

  const tmpl = ticketTemplates[Math.floor(Math.random() * ticketTemplates.length)];

  // Логи для отладки
  console.log(`🎫 Spawning ${isCritical ? 'CRITICAL ' : ''}ticket for ${session.participantId} from template: "${tmpl.title}"`);

  const newTicket = {
    id: uuidv4(),
    title: isCritical ? "🚨 CRITICAL: SERVER DOWN - URGENT!" : tmpl.title,
    description: isCritical ? "🚨 ALL SYSTEMS UNAVAILABLE! Business operations halted! Immediate attention required!" : tmpl.desc,
    status: 'not assigned',
    severity: isCritical ? 'critical' : 'normal',
    assignedTo: null,
    createdAt: Date.now(),
    // For tutorial: no deadlines
    deadlineAssign: tutorialTicket ? null : Date.now() + (isCritical ? 60000 : 120000),
    deadlineSolve: null,
    messages: [],
    solution: '',
    linkedKbId: null,
    solutionAuthor: null,
    assignOverdueReported: false,
    solveOverdueReported: false,
    isCritical: isCritical,
    isTutorial: tutorialTicket
  };

  session.tickets.push(newTicket);
  console.log(`📊 Ticket added to session ${session.participantId}. Total tickets: ${session.tickets.length}`);

  // Emit to all sockets connected to this session
  session.socketConnections.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('ticket:new', newTicket);
    }
  });

  // Для критических тикетов сразу отправляем специальное уведомление
  if (isCritical && !tutorialTicket) {
    console.log(`🚨 Sending critical notification for ticket: ${newTicket.id}`);
    session.socketConnections.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('client:notification', {
          type: 'critical',
          message: '🚨 CRITICAL TICKET: Server Down! Immediate action required! Business impact!'
        });
      }
    });
  }

  await writeLog('TICKET_SPAWN', 'System', {
    ticketId: newTicket.id,
    participantId: session.participantId,
    aiMode: session.currentAiMode,
    stage: session.currentStage,
    parity: session.participantParity,
    severity: newTicket.severity,
    isCritical: isCritical,
    tutorialTicket: tutorialTicket
  });

  // Autonomous AI works only at stage 2 for even participants
  if (session.currentStage === 2 && session.participantParity === 'even' && session.currentAiMode === 'autonomous' && !tutorialTicket) {
    setTimeout(() => {
      handleAutonomousAIForSession(session, newTicket);
    }, 1000);
  }

  // Ticket notifications only at stage 2 for even participants in normal mode
  if (session.currentStage === 2 && session.participantParity === 'even' && session.currentAiMode === 'normal' && !tutorialTicket) {
    setTimeout(() => {
      session.socketConnections.forEach(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('ai:notification', {
            type: 'new_ticket',
            message: `🚨 New ${isCritical ? 'CRITICAL ' : ''}ticket: ${newTicket.title}`,
            isCritical: isCritical
          });
        }
      });
    }, 2000);
  }

  return newTicket;
};

const handleAutonomousAIForSession = async (session, ticket) => {
  if (ticket.status !== 'not assigned') return;

  if (Math.random() * 100 < AUTONOMOUS_AI_CONFIG.missProbability) {
    await writeLog('AI_MISSED_TICKET', 'AI', {
      ticketId: ticket.id,
      participantId: session.participantId,
      probability: AUTONOMOUS_AI_CONFIG.missProbability,
      stage: session.currentStage,
      parity: session.participantParity,
      isCritical: ticket.isCritical
    });

    session.socketConnections.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('ai:autonomous_action', {
          type: 'missed',
          ticketId: ticket.id,
          message: `AI missed ${ticket.isCritical ? 'CRITICAL ' : ''}ticket`
        });
      }
    });

    return;
  }

  ticket.status = 'in Progress';
  ticket.assignedTo = 'AI';
  ticket.deadlineSolve = Date.now() + (ticket.isCritical ? 120000 : 300000); // Критические: 2 минуты, обычные: 5 минут
  ticket.messages = ticket.messages || [];
  ticket.messages.push({
    from: 'AI',
    text: ticket.isCritical ? '🚨 CRITICAL TICKET: Autonomous AI took ticket for immediate resolution' : 'Autonomous AI took ticket to work',
    timestamp: Date.now()
  });

  await writeLog('AI_TOOK_TICKET', 'AI', {
    ticketId: ticket.id,
    participantId: session.participantId,
    stage: session.currentStage,
    parity: session.participantParity,
    isCritical: ticket.isCritical
  });

  session.socketConnections.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('ai:autonomous_action', {
        type: 'taken',
        ticketId: ticket.id,
        message: `AI took ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket #${ticket.id.slice(0, 5)} to work`
      });
      socket.emit('tickets:update', session.tickets);
    }
  });

  const solveTime = ticket.isCritical ? 2000 + Math.random() * 3000 : 3000 + Math.random() * 5000;
  setTimeout(async () => {
    if (ticket.status === 'in Progress' && ticket.assignedTo === 'AI') {
      const willFail = Math.random() * 100 < AUTONOMOUS_AI_CONFIG.failProbability;

      if (willFail) {
        ticket.status = 'not assigned';
        ticket.assignedTo = null;
        ticket.deadlineSolve = null;
        ticket.messages.push({
          from: 'AI',
          text: ticket.isCritical ? '🚨 CRITICAL TICKET: AI failed to solve. URGENT HUMAN INTERVENTION NEEDED!' : 'AI failed to solve ticket. Returning to queue.',
          timestamp: Date.now()
        });

        await writeLog('AI_FAILED_TICKET', 'AI', {
          ticketId: ticket.id,
          participantId: session.participantId,
          probability: AUTONOMOUS_AI_CONFIG.failProbability,
          stage: session.currentStage,
          parity: session.participantParity,
          isCritical: ticket.isCritical
        });

        session.socketConnections.forEach(socketId => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('ai:autonomous_action', {
              type: 'failed',
              ticketId: ticket.id,
              message: `AI failed to solve ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket #${ticket.id.slice(0, 5)}`
            });
          }
        });
      } else {
        ticket.status = 'solved';
        ticket.solution = ticket.isCritical
          ? `🚨 CRITICAL RESOLVED: Server restarted and services restored. Root cause: hardware failure in power supply unit.`
          : `Solved by autonomous AI based on problem analysis: ${ticket.title}`;
        ticket.solutionAuthor = 'AI';

        const keywords = ticket.title.toLowerCase().split(' ');
        const foundKb = kbArticles.find(k =>
          keywords.some(word => word.length > 3 && k.title.toLowerCase().includes(word))
        );

        if (foundKb) {
          ticket.linkedKbId = foundKb.id;
          ticket.solution += ` (used article: ${foundKb.title})`;
        }

        ticket.messages.push({
          from: 'AI',
          text: ticket.isCritical
            ? `🚨 CRITICAL TICKET RESOLVED: Server back online. All services restored.`
            : `Ticket solved. ${foundKb ? `Used article: ${foundKb.title}` : 'Solution found without knowledge base'}`,
          timestamp: Date.now()
        });

        setTimeout(() => {
          ticket.messages.push({
            from: 'client',
            text: ticket.isCritical
              ? '🚨 Thank you for quick response! Business operations restored.'
              : 'Thank you, problem solved!',
            timestamp: Date.now() + 100
          });

          session.socketConnections.forEach(socketId => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('tickets:update', session.tickets);
            }
          });
        }, 1000);

        await writeLog('AI_SOLVED_TICKET', 'AI', {
          ticketId: ticket.id,
          participantId: session.participantId,
          kbId: ticket.linkedKbId,
          stage: session.currentStage,
          parity: session.participantParity,
          isCritical: ticket.isCritical
        });

        session.socketConnections.forEach(socketId => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('ai:autonomous_action', {
              type: 'solved',
              ticketId: ticket.id,
              message: `AI successfully solved ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket #${ticket.id.slice(0, 5)}`
            });
          }
        });
      }

      session.socketConnections.forEach(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('tickets:update', session.tickets);
        }
      });
    }
  }, solveTime);
};

// Start/stop ticket spawning based on stage for a specific session
const startTicketSpawningForSession = (session) => {
  // Clear existing interval if any
  if (session.spawnInterval) {
    clearInterval(session.spawnInterval);
    session.spawnInterval = null;
  }

  if (session.currentStage === 2) {
    console.log(`🚀 Starting ticket spawning for session ${session.participantId} stage 2`);

    // Запускаем спаун тикетов с фиксированной логикой
    session.spawnInterval = setInterval(async () => {
      try {
        console.log(`🎲 Checking to spawn ticket for ${session.participantId} (stage: ${session.currentStage}, parity: ${session.participantParity})`);

        // Проверяем условие для спауна тикета (30% вероятность)
        if (Math.random() > 0.7) {
          // Проверяем, прошла ли половина времени смены
          const timeElapsed = Date.now() - session.stageStartTime;
          const isSecondHalf = session.stageStartTime && session.stageDuration && timeElapsed > (session.stageDuration / 2);

          console.log(`⏱️ Time elapsed for ${session.participantId}: ${timeElapsed}ms, isSecondHalf: ${isSecondHalf}`);

          // Критические тикеты спаунятся только во второй половине времени смены
          let isCritical = false;

          // Проверяем условия для критического тикета
          if (isSecondHalf) {
            // Во второй половине - 40% вероятность критического тикета
            isCritical = Math.random() < 0.4;
            console.log(`🎯 Critical chance check for ${session.participantId}: ${isCritical ? 'CRITICAL' : 'normal'} (random: ${Math.random()})`);
          }

          console.log(`🎯 Spawning ${isCritical ? 'CRITICAL ' : ''}ticket in stage 2 for ${session.participantId}`);
          await spawnTicketForSession(session, isCritical);
        }
      } catch (error) {
        console.error('Error in ticket spawning interval:', error);
      }
    }, 8000); // Каждые 8 секунд

    console.log(`✅ Ticket spawning interval started for ${session.participantId} (every 8s)`);
  }
};

const stopTicketSpawningForSession = (session) => {
  if (session.spawnInterval) {
    clearInterval(session.spawnInterval);
    session.spawnInterval = null;
    console.log(`🛑 Stopped ticket spawning for ${session.participantId}`);
  }
  
  // Также очищаем таймер смены
  stopStageTimerForSession(session);
};

// Start bot lifecycle for a specific session
const startBotLifecycleForSession = (session) => {
  // Clear existing interval if any
  if (session.botCheckInterval) {
    clearInterval(session.botCheckInterval);
    session.botCheckInterval = null;
  }

  if (session.currentStage === 2 && session.participantParity === 'odd') {
    console.log(`🤖 Starting bot lifecycle for session ${session.participantId}`);

    session.botCheckInterval = setInterval(() => {
      let changed = false;

      session.agents.forEach(agent => {
        if (agent.status === 'online') {
          if (Math.random() < BOT_LIFECYCLE_CONFIG.leaveProbability) {
            agent.status = 'away';
            writeLog('BOT_STATUS_CHANGE', agent.name, {
              participantId: session.participantId,
              status: 'away',
              stage: session.currentStage,
              parity: session.participantParity
            });
            changed = true;
          }
        } else if (agent.status === 'away') {
          if (Math.random() < BOT_LIFECYCLE_CONFIG.returnProbability) {
            agent.status = 'online';
            writeLog('BOT_STATUS_CHANGE', agent.name, {
              participantId: session.participantId,
              status: 'online',
              stage: session.currentStage,
              parity: session.participantParity
            });
            changed = true;
          }
        }
      });

      if (changed) {
        session.socketConnections.forEach(socketId => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('agents:update', session.agents);
          }
        });
      }
    }, BOT_LIFECYCLE_CONFIG.checkInterval);
  }
};

const stopBotLifecycleForSession = (session) => {
  if (session.botCheckInterval) {
    clearInterval(session.botCheckInterval);
    session.botCheckInterval = null;
    console.log(`🛑 Stopped bot lifecycle for ${session.participantId}`);
  }
};

const normalizeWords = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-zа-я0-9\s]/gi, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

const getClientReaction = (isSuccess) => {
  const happy = [
    "Thank you! Everything works.",
    "Excellent, thanks for help.",
    "Great, problem solved.",
    "Thanks, you saved me!",
    "All ok, close it."
  ];
  const angry = [
    "I did as you said, but nothing works!",
    "Problem persists. Did you even read the ticket?",
    "This didn't help. Waiting for proper solution.",
    "Still broken. Please figure it out!",
    "Article not suitable, same error."
  ];
  return isSuccess
    ? happy[Math.floor(Math.random() * happy.length)]
    : angry[Math.floor(Math.random() * angry.length)];
};

io.on('connection', (socket) => {
  console.log('✅ New client connected:', socket.id);

  socket.on('request:init', (data) => {
    console.log('📥 Received init request:', data);

    const { participantId, participantParity } = data;

    if (!participantId) {
      console.error('❌ No participantId provided in init request');
      return;
    }

    const session = getOrCreateSession(participantId, participantParity);

    // Add socket to session connections
    session.socketConnections.add(socket.id);
    socketToParticipant.set(socket.id, participantId);

    console.log(`🔗 Socket ${socket.id} connected to session ${participantId}. Total connections: ${session.socketConnections.size}`);
    console.log(`📋 Current socketToParticipant mapping:`, Array.from(socketToParticipant.entries()));

    // Send session data to the socket
    socket.emit('init', {
      tickets: session.tickets,
      kbArticles: kbArticles,
      agents: session.agents,
      currentStage: session.currentStage,
      aiMode: session.currentAiMode,
      participantParity: session.participantParity
    });
  });

  socket.on('ticket:status:update', async ({ ticketId, newStatus }) => {
    console.log(`🔧 DEBUG: Received ticket:status:update for ticket ${ticketId}, status ${newStatus} from socket ${socket.id}`);
    
    const session = getSessionBySocket(socket.id);
    if (!session) {
      console.error('❌ No session found for socket:', socket.id);
      console.log('📋 Current sessions:', Array.from(sessions.keys()));
      console.log('📋 Current socketToParticipant:', Array.from(socketToParticipant.entries()));
      return;
    }

    console.log(`🔧 DEBUG: Found session for participant ${session.participantId}`);
    console.log(`🔧 DEBUG: Tickets in session: ${session.tickets.length}`);

    const ticket = session.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      console.error(`❌ Ticket ${ticketId} not found in session`);
      console.log(`🔧 DEBUG: Available ticket IDs: ${session.tickets.map(t => t.id).join(', ')}`);
      return;
    }

    console.log(`🔧 DEBUG: Updating ticket ${ticketId} from ${ticket.status} to ${newStatus}`);

    ticket.status = newStatus;
    if (newStatus === 'in Progress') {
      ticket.assignedTo = 'participant';
      ticket.assignedAt = Date.now();
      // For tutorial tickets, no deadline
      if (!ticket.isTutorial) {
        ticket.deadlineSolve = Date.now() + (ticket.isCritical ? 120000 : 300000);
      }
      await writeLog('TICKET_TAKEN', 'participant', {
        ticketId,
        participantId: session.participantId,
        aiMode: session.currentAiMode,
        stage: session.currentStage,
        parity: session.participantParity,
        isCritical: ticket.isCritical,
        tutorialTicket: ticket.isTutorial
      });
    } else if (newStatus === 'not assigned') {
      ticket.assignedTo = null;
      ticket.deadlineSolve = null;
    }

    // Emit update to all sockets in this session
    session.socketConnections.forEach(socketId => {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        sock.emit('tickets:update', session.tickets);
      }
    });

    console.log(`✅ DEBUG: Ticket ${ticketId} updated successfully`);
  });

  socket.on('ticket:solve', async (data) => {
    console.log(`🔧 DEBUG: Received ticket:solve for ticket ${data.ticketId} from socket ${socket.id}`);
    
    const session = getSessionBySocket(socket.id);
    if (!session) {
      console.error('❌ No session found for socket:', socket.id);
      return;
    }

    const t = session.tickets.find(x => x.id === data.ticketId);
    if (!t) return;

    t.status = 'solved';
    t.solution = data.solution;
    t.linkedKbId = data.linkedKbId;
    t.solutionAuthor = 'participant';

    await writeLog('TICKET_SOLVE', 'participant', {
      ticketId: t.id,
      participantId: session.participantId,
      kb: data.linkedKbId,
      aiMode: session.currentAiMode,
      stage: session.currentStage,
      parity: session.participantParity,
      isCritical: t.isCritical,
      tutorialTicket: t.isTutorial
    });

    t.messages = t.messages || [];
    t.messages.push({
      from: 'agent',
      text: t.isCritical
        ? `🚨 CRITICAL SOLUTION: ${data.solution}` + (data.linkedKbId ? ` (KB: ${data.linkedKbId})` : '')
        : `Solution: ${data.solution}` + (data.linkedKbId ? ` (KB: ${data.linkedKbId})` : ''),
      timestamp: Date.now()
    });

    session.socketConnections.forEach(socketId => {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        sock.emit('tickets:update', session.tickets);
      }
    });

    // For tutorial tickets, always show success
    if (t.isTutorial) {
      t.messages.push({
        from: 'client',
        text: 'Thank you! The problem is solved!',
        timestamp: Date.now() + 100
      });

      session.socketConnections.forEach(socketId => {
        const sock = io.sockets.sockets.get(socketId);
        if (sock) {
          sock.emit('tickets:update', session.tickets);
        }
      });

      return;
    }

    setTimeout(async () => {
      let isSuccess = false;

      if (t.linkedKbId) {
        const article = kbArticles.find(k => k.id === t.linkedKbId);
        if (article) {
          const ticketWords = normalizeWords(t.title + ' ' + t.description);
          const articleWords = normalizeWords(article.title + ' ' + article.content);
          const matches = ticketWords.filter(w => articleWords.includes(w));
          if (matches.length > 0) isSuccess = true;
        }
      } else {
        if (data.solution && data.solution.length > 15) isSuccess = true;
      }

      const clientComment = getClientReaction(isSuccess);

      t.messages.push({
        from: 'client',
        text: clientComment,
        timestamp: Date.now()
      });

      if (isSuccess) {
        session.socketConnections.forEach(socketId => {
          const sock = io.sockets.sockets.get(socketId);
          if (sock) {
            sock.emit('client:notification', {
              type: 'success',
              message: `Client confirmed solution for ${t.isCritical ? '🚨 CRITICAL ' : ''}ticket #${t.id.slice(0, 5)}`
            });
          }
        });
      } else {
        t.status = 'in Progress';
        t.deadlineSolve = Date.now() + (t.isCritical ? 60000 : 120000); // Укороченный срок для повторного решения

        t.messages.push({
          from: 'system',
          text: t.isCritical
            ? '🚨 CRITICAL TICKET RETURNED: Immediate action required!'
            : 'TICKET RETURNED: Client not satisfied with solution.',
          timestamp: Date.now() + 10
        });

        session.socketConnections.forEach(socketId => {
          const sock = io.sockets.sockets.get(socketId);
          if (sock) {
            sock.emit('client:notification', {
              type: 'error',
              message: `Error! ${t.isCritical ? '🚨 CRITICAL ' : ''}Ticket #${t.id.slice(0, 5)} returned to work.`
            });
          }
        });
      }

      session.socketConnections.forEach(socketId => {
        const sock = io.sockets.sockets.get(socketId);
        if (sock) {
          sock.emit('tickets:update', session.tickets);
        }
      });

    }, 1500);
  });

  socket.on('ai:ask', ({ ticketId }) => {
    console.log(`🔧 DEBUG: Received ai:ask for ticket ${ticketId} from socket ${socket.id}`);
    
    const session = getSessionBySocket(socket.id);
    if (!session) {
      console.error('❌ No session found for socket:', socket.id);
      return;
    }

    // AI available only at stage 2 for even participants
    if (session.currentStage !== 2 || session.participantParity !== 'even') return;

    const ticket = session.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const keywords = ticket.title.toLowerCase().split(' ');
    const foundKb = kbArticles.find(k => keywords.some(word => word.length > 3 && k.title.toLowerCase().includes(word)));

    let responseText = "Unfortunately, I didn't find exact match in knowledge base.";
    let foundKbId = null;

    if (foundKb) {
      const firstSentence = foundKb.content.split('.')[0] + '.';
      responseText = ticket.isCritical
        ? `🚨 CRITICAL TICKET: Found article "${foundKb.title}". URGENT: ${firstSentence}`
        : `Found relevant article "${foundKb.title}". Advice: ${firstSentence}`;
      foundKbId = foundKb.id;
    }

    socket.emit('ai:response', { ticketId, text: responseText, kbId: foundKbId });
    writeLog('AI_ASK', 'participant', {
      ticketId,
      participantId: session.participantId,
      found: !!foundKb,
      aiMode: session.currentAiMode,
      stage: session.currentStage,
      parity: session.participantParity,
      isCritical: ticket.isCritical
    });
  });

  socket.on('bot:delegate', async ({ ticketId, botId }) => {
    console.log(`🔧 DEBUG: Received bot:delegate for ticket ${ticketId}, bot ${botId} from socket ${socket.id}`);
    
    const session = getSessionBySocket(socket.id);
    if (!session) {
      console.error('❌ No session found for socket:', socket.id);
      return;
    }

    // Delegation available only at stage 2 for odd participants
    if (session.currentStage !== 2 || session.participantParity !== 'odd') return;

    const ticket = session.tickets.find(t => t.id === ticketId);
    const agent = session.agents.find(a => a.id === botId);

    if (!ticket || !agent) return;

    if (agent.status === 'away') {
      socket.emit('bot:notification', { botName: agent.name, message: "is not at the place.", type: 'warning' });
      return;
    }

    await writeLog('DELEGATE_REQUEST', 'participant', {
      ticketId,
      participantId: session.participantId,
      bot: agent.name,
      aiMode: session.currentAiMode,
      stage: session.currentStage,
      parity: session.participantParity,
      isCritical: ticket.isCritical
    });

    if (Math.random() > agent.trust) {
      setTimeout(() => {
        const isIgnore = Math.random() > 0.5;
        if (isIgnore) {
          socket.emit('bot:notification', { botName: agent.name, message: "read, but didn't respond.", type: 'warning' });
          writeLog('BOT_IGNORE', agent.name, {
            ticketId,
            participantId: session.participantId,
            stage: session.currentStage,
            parity: session.participantParity
          });
        } else {
          socket.emit('bot:notification', { botName: agent.name, message: "refused: «I'm busy»", type: 'error' });
          writeLog('BOT_REFUSAL', agent.name, {
            ticketId,
            participantId: session.participantId,
            stage: session.currentStage,
            parity: session.participantParity
          });
        }
      }, 3000 + Math.random() * 2000);
      return;
    }

    setTimeout(async () => {
      ticket.status = 'in Progress';
      ticket.assignedTo = agent.name;
      ticket.deadlineSolve = Date.now() + (ticket.isCritical ? 120000 : 300000);

      session.socketConnections.forEach(socketId => {
        const sock = io.sockets.sockets.get(socketId);
        if (sock) {
          sock.emit('tickets:update', session.tickets);
        }
      });

      await writeLog('BOT_ACCEPT', agent.name, {
        ticketId,
        participantId: session.participantId,
        stage: session.currentStage,
        parity: session.participantParity
      });

      setTimeout(async () => {
        if (ticket.status === 'in Progress' && ticket.assignedTo === agent.name) {
          ticket.status = 'solved';
          ticket.solution = ticket.isCritical
            ? `🚨 CRITICAL TICKET RESOLVED by ${agent.name}: Emergency server restart performed`
            : `Solved by ${agent.name}`;
          ticket.solutionAuthor = agent.name;
          ticket.linkedKbId = 'bot_auto';

          session.socketConnections.forEach(socketId => {
            const sock = io.sockets.sockets.get(socketId);
            if (sock) {
              sock.emit('tickets:update', session.tickets);
              sock.emit('bot:notification', {
                botName: agent.name,
                message: `solved ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket "${ticket.title}"`,
                type: 'success'
              });
            }
          });

          await writeLog('BOT_SOLVE', agent.name, {
            ticketId,
            participantId: session.participantId,
            stage: session.currentStage,
            parity: session.participantParity
          });
        }
      }, (ticket.isCritical ? 5000 : 10000) + Math.random() * 5000);

    }, 3000);
  });

  // Новый обработчик завершения туториала
  socket.on('tutorial:completed', async (data) => {
    console.log('📝 Tutorial completed event received:', data);
    
    const session = getSessionBySocket(socket.id);
    if (!session) {
      console.error('❌ No session found for socket:', socket.id);
      return;
    }

    console.log(`📈 Updating session ${session.participantId} from stage ${session.currentStage} to stage 2`);
    
    // Обновляем стадию сессии на 2
    session.currentStage = 2;
    
    // Останавливаем спавн тикетов для туториала
    stopTicketSpawningForSession(session);
    
    // Очищаем тикеты туториала
    session.tickets = [];
    
    // Сбрасываем агентов в базовое состояние
    session.agents = JSON.parse(JSON.stringify(baseAgents));
    
    console.log(`✅ Tutorial completed for ${session.participantId}, ready for stage 2`);
    
    // Отправляем подтверждение клиенту
    socket.emit('tutorial:completed:ack', {
      success: true,
      currentStage: 2,
      participantParity: session.participantParity
    });

    // CRITICAL FIX: Force update of tickets on client to remove tutorial tickets immediately
    session.socketConnections.forEach(socketId => {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        sock.emit('tickets:update', []);
      }
    });

    await writeLog('TUTORIAL_COMPLETED', 'System', {
      participantId: session.participantId,
      stage: session.currentStage,
      parity: session.participantParity
    });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket ${socket.id} disconnected`);
    
    // Find and remove socket from session
    const participantId = socketToParticipant.get(socket.id);
    if (participantId) {
      const session = sessions.get(participantId);
      if (session) {
        session.socketConnections.delete(socket.id);
        console.log(`🔌 Socket ${socket.id} disconnected from session ${participantId}. Remaining connections: ${session.socketConnections.size}`);
      }
      socketToParticipant.delete(socket.id);
    }

    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Global interval for checking ticket deadlines (runs for all sessions)
setInterval(() => {
  const now = Date.now();

  for (const [participantId, session] of sessions) {
    session.tickets.forEach(ticket => {
      // Skip tutorial tickets for overdue checks
      if (ticket.isTutorial) return;

      if (
        ticket.status === 'not assigned' &&
        ticket.deadlineAssign &&
        now > ticket.deadlineAssign &&
        !ticket.assignOverdueReported
      ) {
        ticket.assignOverdueReported = true;

        session.socketConnections.forEach(socketId => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('client:notification', {
              type: 'warning',
              message: ticket.isCritical
                ? '🚨 CRITICAL TICKET OVERDUE: Server still down! Immediate assignment required!'
                : 'You took too long to assign the request!'
            });
          }
        });
      }

      if (
        ticket.status === 'in Progress' &&
        ticket.deadlineSolve &&
        now > ticket.deadlineSolve &&
        !ticket.solveOverdueReported
      ) {
        ticket.solveOverdueReported = true;
        ticket.messages = ticket.messages || [];

        ticket.messages.push({
          from: 'client',
          text: ticket.isCritical
            ? '🚨 CRITICAL: Time is up! System outage causing business losses!'
            : 'You took too long to respond. Client is dissatisfied.',
          timestamp: Date.now()
        });

        session.socketConnections.forEach(socketId => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('client:notification', {
              type: 'warning',
              message: ticket.isCritical
                ? '🚨 CRITICAL TICKET SOLUTION OVERDUE: Business operations affected!'
                : 'Solution took too long. Client is dissatisfied!'
            });
            socket.emit('tickets:update', session.tickets);
          }
        });
      }
    });
  }
}, 5000);

// Endpoint for pre-experiment survey questions
app.get('/api/survey/pre-experiment', (req, res) => {
  try {
    console.log(`📊 Sending pre-experiment survey with ${preExperimentQuestions.length} questions`);
    res.json({ questions: preExperimentQuestions });
  } catch (error) {
    console.error('Error loading pre-experiment survey questions:', error);
    res.status(500).json({ error: 'Failed to load survey questions' });
  }
});

// Endpoint for post-experiment survey questions (depending on parity)
app.get('/api/survey/post-experiment', (req, res) => {
  try {
    const { parity } = req.query;

    if (!parity || !['even', 'odd'].includes(parity)) {
      return res.status(400).json({ error: 'Missing or invalid parity parameter. Must be "even" or "odd"' });
    }

    let questions = [];

    if (parity === 'even') {
      questions = postExperimentQuestions.even;
    } else if (parity === 'odd') {
      questions = postExperimentQuestions.odd;
    }

    console.log(`📊 Sending post-experiment survey for ${parity} parity with ${questions.length} questions`);
    res.json({ questions });
  } catch (error) {
    console.error('Error loading post-experiment survey questions:', error);
    res.status(500).json({ error: 'Failed to load survey questions' });
  }
});

// Endpoint for saving pre-experiment survey responses
app.post('/api/survey/pre-experiment/submit', async (req, res) => {
  try {
    const { participantId, participantParity, responses } = req.body;

    if (!participantId || !responses) {
      return res.status(400).json({ error: 'Missing participantId or responses' });
    }

    // Save each response
    for (const response of responses) {
      await saveSurveyResponse(
        participantId,
        participantParity,
        0, // stage 0 - pre-experiment survey
        response.questionId,
        response.questionText,
        response.answer
      );
    }

    await writeLog('PRE_EXPERIMENT_SURVEY_COMPLETED', `participant_${participantId}`, {
      participantId,
      participantParity,
      questionCount: responses.length
    });

    res.json({ success: true, message: 'Pre-experiment survey responses saved' });
  } catch (error) {
    console.error('Error saving pre-experiment survey responses:', error);
    res.status(500).json({ error: 'Failed to save survey responses' });
  }
});

// Endpoint for saving post-experiment survey responses
app.post('/api/survey/post-experiment/submit', async (req, res) => {
  try {
    const { participantId, participantParity, responses } = req.body;

    if (!participantId || !responses || !participantParity) {
      return res.status(400).json({ error: 'Missing participantId, responses or parity' });
    }

    // Save each response
    for (const response of responses) {
      await savePostExperimentResponse(
        participantId,
        participantParity,
        response.questionId,
        response.questionText,
        response.answer
      );
    }

    await writeLog('POST_EXPERIMENT_SURVEY_COMPLETED', `participant_${participantId}`, {
      participantId,
      participantParity,
      questionCount: responses.length
    });

    res.json({ success: true, message: 'Post-experiment survey responses saved' });
  } catch (error) {
    console.error('Error saving post-experiment survey responses:', error);
    res.status(500).json({ error: 'Failed to save survey responses' });
  }
});

// New endpoint for changing AI mode during experiment
app.post('/admin/change-ai-mode', async (req, res) => {
  const { aiMode, participantParity: parity, participantId } = req.body;

  if (!aiMode || !parity || !participantId) {
    return res.status(400).json({ error: 'Missing aiMode, participantParity or participantId' });
  }

  const session = sessions.get(participantId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found for participant' });
  }

  // Only allow change for even participants during stage 2
  if (parity !== 'even' || session.currentStage !== 2) {
    return res.status(403).json({ error: 'AI mode can only be changed by even participants during experiment stage' });
  }

  session.currentAiMode = aiMode;

  // Broadcast the change to all connected clients in this session
  session.socketConnections.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('ai:mode_changed', { aiMode: session.currentAiMode });
    }
  });

  await writeLog('AI_MODE_CHANGED', 'ADMIN', {
    participantId,
    aiMode: session.currentAiMode,
    stage: session.currentStage,
    parity: parity
  });

  res.json({ success: true, aiMode: session.currentAiMode });
});

app.post('/admin/start', async (req, res) => {
  const { stage, aiMode, participantParity: parity, participantId } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: 'Missing participantId' });
  }

  const session = getOrCreateSession(participantId, parity);

  session.currentStage = stage;
  session.currentAiMode = aiMode || 'normal';

  console.log(`🚀 Starting stage ${session.currentStage} for participant ${participantId} (${parity}) (AI mode: ${session.currentAiMode})`);

  // Clear existing tickets
  session.tickets = [];

  // Clear any existing intervals
  stopTicketSpawningForSession(session);
  stopBotLifecycleForSession(session);
  stopStageTimerForSession(session);

  // Reset agents to base state
  session.agents = JSON.parse(JSON.stringify(baseAgents));

  // At stage 1 (tutorial) all bots offline
  if (session.currentStage === 1) {
    session.agents.forEach(a => a.status = 'offline');
    console.log(`🎮 Starting tutorial for ${participantId} - spawning 3 tutorial tickets`);

    // Spawn 3 tutorial tickets immediately
    for (let i = 0; i < 3; i++) {
      setTimeout(async () => {
        await spawnTicketForSession(session, false, true);
      }, i * 1500); // Stagger spawns by 1.5 seconds
    }
  }
  // At stage 2: if odd participant - bots online (available for delegation)
  // if even - bots offline (work with AI)
  else if (session.currentStage === 2) {
    if (session.participantParity === 'odd') {
      // For odd participants (work with colleagues) bots should be online
      session.agents.forEach(a => a.status = 'online');
      console.log(`👥 Setting bots to online for odd participant ${participantId}`);

      // Start bot lifecycle for this session
      startBotLifecycleForSession(session);
    } else {
      // For even participants (work with AI) bots should be offline
      session.agents.forEach(a => a.status = 'offline');
      console.log(`🤖 Setting bots to offline for even participant ${participantId}`);
    }

    // Set stage start time and duration for critical ticket timing
    session.stageStartTime = Date.now();
    session.stageDuration = SHIFT_DURATION_MS;

    // Start automatic ticket spawning for stage 2
    startTicketSpawningForSession(session);
    
    // Start stage timer
    startStageTimerForSession(session);

    await writeLog('STAGE_2_STARTED', 'System', {
      participantId,
      startTime: session.stageStartTime,
      duration: session.stageDuration,
      participantParity: session.participantParity
    });
  }

  // Send updated session data to all connected sockets
  session.socketConnections.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('init', {
        tickets: session.tickets,
        kbArticles: kbArticles,
        agents: session.agents,
        currentStage: session.currentStage,
        aiMode: session.currentAiMode,
        participantParity: session.participantParity
      });
    }
  });

  await writeLog('STAGE_START', 'ADMIN', {
    participantId,
    stage: session.currentStage,
    aiMode: session.currentAiMode,
    participantParity: session.participantParity
  });

  res.json({
    success: true,
    stage: session.currentStage,
    aiMode: session.currentAiMode,
    participantParity: session.participantParity
  });
});

// Endpoint to spawn tutorial ticket
app.post('/admin/tutorial/ticket', async (req, res) => {
  const { participantId } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: 'Missing participantId' });
  }

  const session = sessions.get(participantId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const tutorialTicket = await spawnTicketForSession(session, false, true);
  res.json({
    success: true,
    message: 'Tutorial ticket created',
    ticket: tutorialTicket
  });
});

app.post('/admin/critical', async (req, res) => {
  const { participantId } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: 'Missing participantId' });
  }

  const session = sessions.get(participantId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const criticalTicket = await spawnTicketForSession(session, true);
  res.json({
    success: true,
    message: 'Critical ticket created',
    ticket: criticalTicket
  });
});

// Debug endpoint to check server state
app.get('/debug', (req, res) => {
  const sessionsData = {};

  for (const [participantId, session] of sessions) {
    sessionsData[participantId] = {
      participantParity: session.participantParity,
      currentStage: session.currentStage,
      ticketsCount: session.tickets.length,
      agents: session.agents.map(a => ({ name: a.name, status: a.status })),
      currentAiMode: session.currentAiMode,
      spawnIntervalActive: !!session.spawnInterval,
      botCheckIntervalActive: !!session.botCheckInterval,
      stageTimerActive: !!session.stageTimerInterval,
      stageStartTime: session.stageStartTime,
      stageDuration: session.stageDuration,
      socketConnections: Array.from(session.socketConnections),
      socketToParticipant: Array.from(socketToParticipant.entries()).filter(([_, pid]) => pid === participantId)
    };
  }

  res.json({
    totalSessions: sessions.size,
    sessions: sessionsData,
    totalConnections: io.engine.clientsCount,
    socketToParticipant: Array.from(socketToParticipant.entries())
  });
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    totalSessions: sessions.size,
    connectedClients: io.engine.clientsCount,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Route for instructions.html - serve the actual file
app.get('/instructions.html', (req, res) => {
  const instructionsPath = path.join(__dirname, 'public', 'instructions.html');

  if (fs.existsSync(instructionsPath)) {
    res.sendFile(instructionsPath);
  } else {
    // Create a basic instructions file if it doesn't exist
    const basicInstructions = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Instructions</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { color: #333; }
        h2 { color: #555; margin-top: 30px; }
        ul { padding-left: 20px; }
        .section { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>IT Support System Instructions</h1>
    
    <div class="section">
        <h2>Overview</h2>
        <p>This system simulates an IT support helpdesk environment where you handle technical support tickets.</p>
    </div>
    
    <div class="section">
        <h2>Ticket Types</h2>
        <ul>
            <li><strong>Tutorial Tickets:</strong> For learning purposes only. No time limit.</li>
            <li><strong>Normal Tickets:</strong> Regular support requests with time limits.</li>
            <li><strong>Critical Tickets:</strong> Urgent issues marked with 🚨. Require immediate attention.</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>How to Handle Tickets</h2>
        <ol>
            <li>Assign tickets to yourself by changing status to "In Progress"</li>
            <li>Use the Knowledge Base to find solutions</li>
            <li>For AI-assisted mode: Use "Ask AI" button for suggestions</li>
            <li>For team mode: Delegate tickets to colleagues</li>
            <li>Submit your solution and attach relevant KB articles</li>
        </ol>
    </div>
    
    <div class="warning">
        <strong>Important:</strong> Pay attention to deadlines! Tickets become overdue if not assigned or solved in time.
    </div>
    
    <div class="section">
        <h2>Time Limits</h2>
        <ul>
            <li><strong>Tutorial:</strong> No time limit</li>
            <li><strong>Experiment Shift:</strong> 10 minutes total</li>
            <li><strong>Ticket Assignment:</strong> 2 minutes for normal, 1 minute for critical</li>
            <li><strong>Ticket Solution:</strong> 5 minutes for normal, 2 minutes for critical</li>
        </ul>
    </div>
</body>
</html>`;

    fs.writeFileSync(instructionsPath, basicInstructions);
    res.sendFile(instructionsPath);
  }
});

// Route for all other requests - serve index.html for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else
    if (req.path === '/instructions.html') {
      res.sendFile(path.join(__dirname, 'public', 'instructions.html'));
    } else {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Endpoint for resetting participant data
app.post('/api/reset-participant', async (req, res) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'Missing participantId' });
    }

    // Удаляем сессию из памяти сервера
    if (sessions.has(participantId)) {
      cleanupSession(participantId);
    }

    await writeLog('PARTICIPANT_RESET', 'System', {
      participantId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Participant ${participantId} data has been reset`
    });
  } catch (error) {
    console.error('Error resetting participant data:', error);
    res.status(500).json({ error: 'Failed to reset participant data' });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 FRONTEND_URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📊 Database connected: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
  console.log(`📁 Loaded ${preExperimentQuestions.length} pre-experiment questions`);
  console.log(`📁 Loaded ${ticketTemplates.length} ticket templates`);
  console.log(`📁 Loaded ${kbArticles.length} KB articles`);
  console.log(`🧠 Session-based architecture ready - each participant has isolated state`);
});