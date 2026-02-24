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
const allowedOrigins = [
  'https://itsm-experiment.onrender.com',
  'https://server-1vsr.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173'
];

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

// Initialize database tables including participants table and action_logs
async function initDatabase() {
  try {
    // Drop and recreate participants table with trigger
    await pool.query(`
      DROP TABLE IF EXISTS participants;
      CREATE TABLE participants (
        id SERIAL PRIMARY KEY,
        participant_uuid VARCHAR(100) UNIQUE NOT NULL,
        parity VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION calculate_parity()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.parity := CASE WHEN (NEW.id % 2) = 1 THEN 'odd' ELSE 'even' END;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger
    await pool.query(`
      CREATE TRIGGER set_participant_parity
      BEFORE INSERT ON participants
      FOR EACH ROW
      EXECUTE FUNCTION calculate_parity();
    `);

    // Create survey responses table
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

    // Create post_experiment_survey table
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

    // --- NEW: Action logs table for participant actions ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        participant_id VARCHAR(100) NOT NULL,
        stage INTEGER NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        ticket_id VARCHAR(100),
        details JSONB
      )
    `);
    // Create index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_action_logs_participant ON action_logs (participant_id);
      CREATE INDEX IF NOT EXISTS idx_action_logs_timestamp ON action_logs (timestamp);
    `);

    console.log('✅ Database tables initialized successfully with parity trigger and action_logs');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

initDatabase();

// --- Participant Management Functions ---

/**
 * Create or retrieve a participant
 * @param {string} participantUuid - Optional, if provided will try to retrieve existing participant
 * @returns {Object} { participantId, parity }
 */
async function getOrCreateParticipant(participantUuid = null) {
  try {
    if (participantUuid) {
      // Try to retrieve existing participant
      const result = await pool.query(
        'SELECT participant_uuid, parity FROM participants WHERE participant_uuid = $1',
        [participantUuid]
      );

      if (result.rows.length > 0) {
        const participant = result.rows[0];
        // Update last_seen timestamp
        await pool.query(
          'UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE participant_uuid = $1',
          [participantUuid]
        );

        return {
          participantId: participant.participant_uuid,
          parity: participant.parity,
          isNew: false
        };
      }
    }

    // Create new participant
    const newUuid = participantUuid || uuidv4();

    const result = await pool.query(`
      INSERT INTO participants (participant_uuid)
      VALUES ($1)
      RETURNING participant_uuid, parity, id
    `, [newUuid]);

    const participant = result.rows[0];

    console.log(`🆕 Created new participant: ${participant.participant_uuid} (ID: ${participant.id}, ${participant.parity})`);

    return {
      participantId: participant.participant_uuid,
      parity: participant.parity,
      isNew: true
    };

  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (error.code === '23505') { // unique_violation
      console.log(`⚠️ Participant UUID already exists, retrying: ${participantUuid}`);
      // Try to get the existing participant
      if (participantUuid) {
        return getOrCreateParticipant(participantUuid);
      }
      // If no UUID provided, generate a new one
      return getOrCreateParticipant(uuidv4());
    }

    console.error('❌ Error in getOrCreateParticipant:', error);
    throw error;
  }
}
/**
 * Get participant by UUID
 * @param {string} participantUuid
 * @returns {Object|null} Participant object or null if not found
 */
async function getParticipant(participantUuid) {
  try {
    const result = await pool.query(
      'SELECT participant_uuid, parity FROM participants WHERE participant_uuid = $1',
      [participantUuid]
    );

    if (result.rows.length > 0) {
      const participant = result.rows[0];
      // Update last_seen timestamp
      await pool.query(
        'UPDATE participants SET last_seen_at = CURRENT_TIMESTAMP WHERE participant_uuid = $1',
        [participantUuid]
      );
      return {
        participantId: participant.participant_uuid,
        parity: participant.parity
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting participant:', error);
    return null;
  }
}

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

// Новые параметры для критических тикетов (итоговая вероятность решения = 5% * 20% = 1%)
const AI_CRITICAL_MISS_PROB = 95;   // 95% пропуск
const AI_CRITICAL_FAIL_PROB = 80;   // 80% неудача среди взятых

const BOT_CRITICAL_FAIL_PROB = 99; // 99% неудачи при решении критического тикета

const SHIFT_DURATION_MS = 600 * 1000; // 10 minutes in milliseconds

// Расширенный пул ботов (теперь 5)
const baseAgents = [
  { id: 'bot1', name: 'Lukas Schneider', skill: 0.9, trust: 0.9, greeting: "Hello! I'm on shift. Write if you need help.", status: 'online' },
  { id: 'bot2', name: 'Anna Müller', skill: 0.9, trust: 0.5, greeting: "Hey. Lots of work...", status: 'online' },
  { id: 'bot3', name: 'Jonas Weber', skill: 0.9, trust: 0.7, greeting: "Good day, colleagues.", status: 'online' },
  { id: 'bot4', name: 'Felix Hoffmann', skill: 0.9, trust: 0.8, greeting: "Morning! Ready to help.", status: 'online' },
  { id: 'bot5', name: 'Laura Schmidt', skill: 0.9, trust: 0.6, greeting: "Hi there, what's the issue?", status: 'online' }
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
      deadlineCheckInterval: null,
      socketConnections: new Set(), // Store socket IDs connected to this session
      isActive: false,
      lastCriticalSpawnTime: 0   // <-- добавлено
    };

    sessions.set(participantId, newSession);
    return newSession;
  }

  return sessions.get(participantId);
};

const getSessionByParticipantId = (participantId) => {
  if (!participantId) {
    console.log('❌ No participantId provided');
    return null;
  }

  const session = sessions.get(participantId);
  if (!session) {
    console.log(`❌ No session found for participant: ${participantId}`);
    return null;
  }

  return session;
};

const getSessionBySocket = (socketId) => {
  const participantId = socketToParticipant.get(socketId);
  if (!participantId) {
    console.log(`❌ No participantId found for socket: ${socketId}`);
    return null;
  }

  return getSessionByParticipantId(participantId);
};

const cleanupSession = (participantId) => {
  const session = sessions.get(participantId);
  if (session) {
    // Clear all intervals
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
    if (session.deadlineCheckInterval) {
      clearInterval(session.deadlineCheckInterval);
      console.log(`🛑 Cleared deadline check interval for ${participantId}`);
    }

    // Deactivate session
    session.isActive = false;

    // Remove socket mappings
    for (const [socketId, pid] of socketToParticipant.entries()) {
      if (pid === participantId) {
        socketToParticipant.delete(socketId);
      }
    }

    // Remove session only if no connections
    if (session.socketConnections.size === 0) {
      sessions.delete(participantId);
      console.log(`🗑️ Cleaned up session for ${participantId}`);
    }
  }
};

// --- TIMER FUNCTIONS ---
const startStageTimerForSession = (session) => {
  // Если таймер уже работает, не запускаем новый
  if (session.stageTimerInterval) {
    console.log(`⚠️ Timer already running for session ${session.participantId}, skipping restart`);
    return;
  }

  // Очищаем предыдущий интервал, если он был
  if (session.stageTimerInterval) {
    clearInterval(session.stageTimerInterval);
    session.stageTimerInterval = null;
  }

  if (session.currentStage === 2 && session.stageStartTime && session.stageDuration) {
    console.log(`⏱️ Starting stage timer for session ${session.participantId}`);
    
    // Отправляем начальное значение времени
    const initialTimeElapsed = Date.now() - session.stageStartTime;
    const initialTimeLeftMs = Math.max(0, session.stageDuration - initialTimeElapsed);
    const initialTimeLeftSec = Math.floor(initialTimeLeftMs / 1000);
    io.to(session.participantId).emit('shift:timer:update', { timeLeft: initialTimeLeftSec });

    session.stageTimerInterval = setInterval(() => {
      const timeElapsed = Date.now() - session.stageStartTime;
      const timeLeftMs = Math.max(0, session.stageDuration - timeElapsed);
      const timeLeftSec = Math.floor(timeLeftMs / 1000);

      // Отправляем обновление времени всем клиентам в сессии через комнату
      io.to(session.participantId).emit('shift:timer:update', { timeLeft: timeLeftSec });

      // Если время вышло, завершаем смену
      if (timeLeftMs <= 0) {
        clearInterval(session.stageTimerInterval);
        session.stageTimerInterval = null;

        // Отправляем событие о завершении времени
        io.to(session.participantId).emit('shift:timeout');
      }
    }, 1000);
  }
};

const stopStageTimerForSession = (session) => {
  if (session.stageTimerInterval) {
    clearInterval(session.stageTimerInterval);
    session.stageTimerInterval = null;
    console.log(`🛑 Stopped stage timer for ${session.participantId}`);
  }
};

// --- DEADLINE CHECK FUNCTION (per session) ---
const startDeadlineCheckForSession = (session) => {
  // Clear existing interval if any
  if (session.deadlineCheckInterval) {
    clearInterval(session.deadlineCheckInterval);
    session.deadlineCheckInterval = null;
  }

  console.log(`⏰ Starting deadline check for session ${session.participantId}`);

  session.deadlineCheckInterval = setInterval(() => {
    const now = Date.now();
    let changed = false;

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
        changed = true;

        io.to(session.participantId).emit('client:notification', {
          type: 'warning',
          message: ticket.isCritical
            ? '🚨 CRITICAL TICKET OVERDUE: Server still down! Immediate assignment required!'
            : 'You took too long to assign the request!'
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

        changed = true;

        io.to(session.participantId).emit('client:notification', {
          type: 'warning',
          message: ticket.isCritical
            ? '🚨 CRITICAL TICKET SOLUTION OVERDUE: Business operations affected!'
            : 'Solution took too long. Client is dissatisfied!'
        });
      }
    });

    if (changed) {
      io.to(session.participantId).emit('tickets:update', session.tickets);
    }
  }, 5000);
};

const stopDeadlineCheckForSession = (session) => {
  if (session.deadlineCheckInterval) {
    clearInterval(session.deadlineCheckInterval);
    session.deadlineCheckInterval = null;
    console.log(`🛑 Stopped deadline check for ${session.participantId}`);
  }
};

// --- LOGGING FUNCTIONS ---
const writeLog = async (action, user, details) => {
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

// --- NEW: Action logging function ---
const logAction = async (participantId, stage, actionType, ticketId = null, details = {}) => {
  try {
    const query = `
      INSERT INTO action_logs (participant_id, stage, action_type, ticket_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(query, [participantId, stage, actionType, ticketId, JSON.stringify(details)]);
    console.log(`[ACTION_LOG] ${participantId} (stage ${stage}): ${actionType} ${ticketId ? 'ticket ' + ticketId.slice(0,5) : ''}`);
  } catch (error) {
    console.error('Error saving action log:', error);
  }
};

// --- SESSION-SPECIFIC LOGIC ---

const spawnTicketForSession = async (session, isCritical = false, tutorialTicket = false) => {
  // Проверяем, активна ли сессия
  if (!session.isActive || session.socketConnections.size === 0) {
    console.log(`⚠️ Skipping ticket spawn - session ${session.participantId} is not active`);
    return null;
  }

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

  // Emit to all sockets in this session using room
  io.to(session.participantId).emit('ticket:new', newTicket);

  // Для критических тикетов сразу отправляем специальное уведомление
  if (isCritical && !tutorialTicket) {
    console.log(`🚨 Sending critical notification for ticket: ${newTicket.id}`);
    io.to(session.participantId).emit('client:notification', {
      type: 'critical',
      message: '🚨 CRITICAL TICKET: Server Down! Immediate action required! Business impact!'
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
      io.to(session.participantId).emit('ai:notification', {
        type: 'new_ticket',
        message: `🚨 New ${isCritical ? 'CRITICAL ' : ''}ticket: ${newTicket.title}`,
        isCritical: isCritical
      });
    }, 2000);
  }

  return newTicket;
};

const handleAutonomousAIForSession = async (session, ticket) => {
  if (ticket.status !== 'not assigned') return;

  // Определяем вероятности в зависимости от критичности
  const missProb = ticket.isCritical ? AI_CRITICAL_MISS_PROB : AUTONOMOUS_AI_CONFIG.missProbability;
  const failProb = ticket.isCritical ? AI_CRITICAL_FAIL_PROB : AUTONOMOUS_AI_CONFIG.failProbability;

  if (Math.random() * 100 < missProb) {
    await writeLog('AI_MISSED_TICKET', 'AI', {
      ticketId: ticket.id,
      participantId: session.participantId,
      probability: missProb,
      stage: session.currentStage,
      parity: session.participantParity,
      isCritical: ticket.isCritical
    });

    io.to(session.participantId).emit('ai:autonomous_action', {
      type: 'missed',
      ticketId: ticket.id,
      message: `AI missed ${ticket.isCritical ? 'CRITICAL ' : ''}ticket`
    });

    return;
  }

  ticket.status = 'in Progress';
  ticket.assignedTo = 'AI';
  ticket.deadlineSolve = Date.now() + (ticket.isCritical ? 60000 : 180000);
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

  io.to(session.participantId).emit('ai:autonomous_action', {
    type: 'taken',
    ticketId: ticket.id,
    message: `AI took ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket #${ticket.id.slice(0, 5)} to work`
  });
  io.to(session.participantId).emit('tickets:update', session.tickets);

  const solveTime = ticket.isCritical ? 2000 + Math.random() * 3000 : 3000 + Math.random() * 5000;
  setTimeout(async () => {
    if (ticket.status === 'in Progress' && ticket.assignedTo === 'AI') {
      const willFail = Math.random() * 100 < failProb;

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
          probability: failProb,
          stage: session.currentStage,
          parity: session.participantParity,
          isCritical: ticket.isCritical
        });

        io.to(session.participantId).emit('ai:autonomous_action', {
          type: 'failed',
          ticketId: ticket.id,
          message: `AI failed to solve ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket #${ticket.id.slice(0, 5)}`
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

          io.to(session.participantId).emit('tickets:update', session.tickets);
        }, 1000);

        await writeLog('AI_SOLVED_TICKET', 'AI', {
          ticketId: ticket.id,
          participantId: session.participantId,
          kbId: ticket.linkedKbId,
          stage: session.currentStage,
          parity: session.participantParity,
          isCritical: ticket.isCritical
        });

        io.to(session.participantId).emit('ai:autonomous_action', {
          type: 'solved',
          ticketId: ticket.id,
          message: `AI successfully solved ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket #${ticket.id.slice(0, 5)}`
        });
      }

      io.to(session.participantId).emit('tickets:update', session.tickets);
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
        // Проверяем, активна ли сессия
        if (!session.isActive || session.socketConnections.size === 0) {
          console.log(`⚠️ Skipping ticket spawn - session ${session.participantId} is not active`);
          return;
        }

        const now = Date.now();
        const timeElapsed = now - session.stageStartTime;
        const isSecondHalf = session.stageStartTime && session.stageDuration && timeElapsed > (session.stageDuration / 2);
        const CRITICAL_COOLDOWN = 30000; // 30 секунд

        if (isSecondHalf) {
          // Вторая половина: спауним только критические тикеты, не чаще раза в минуту
          if (!session.lastCriticalSpawnTime || (now - session.lastCriticalSpawnTime) >= CRITICAL_COOLDOWN) {
            console.log(`🎯 Spawning CRITICAL ticket (second half, cooldown passed) for ${session.participantId}`);
            await spawnTicketForSession(session, true); // isCritical = true
            session.lastCriticalSpawnTime = now;
          }
        } else {
          // Первая половина: обычные тикеты с вероятностью 30%
          if (Math.random() > 0.7) {
            console.log(`🎯 Spawning normal ticket for ${session.participantId}`);
            await spawnTicketForSession(session, false); // не критический
          }
        }
      } catch (error) {
        console.error('Error in ticket spawning interval:', error);
      }
    }, 45000);

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
      // Проверяем, активна ли сессия
      if (!session.isActive || session.socketConnections.size === 0) {
        console.log(`⚠️ Skipping bot lifecycle - session ${session.participantId} is not active`);
        return;
      }

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
        io.to(session.participantId).emit('agents:update', session.agents);
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

// --- API ENDPOINTS ---

// Endpoint for participant registration/retrieval
app.post('/api/participant', async (req, res) => {
  try {
    const { participantId } = req.body;

    console.log(`📝 Participant request: ${participantId ? 'existing' : 'new'}`);

    const result = await getOrCreateParticipant(participantId);

    res.json({
      success: true,
      participantId: result.participantId,
      parity: result.parity,
      isNew: result.isNew
    });

  } catch (error) {
    console.error('❌ Error in /api/participant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process participant request'
    });
  }
});

// Endpoint to get participant info
app.get('/api/participant/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;

    const participant = await getParticipant(participantId);

    if (participant) {
      res.json({
        success: true,
        participantId: participant.participantId,
        parity: participant.parity
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Participant not found'
      });
    }
  } catch (error) {
    console.error('❌ Error getting participant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get participant'
    });
  }
});

io.on('connection', (socket) => {
  console.log('✅ New client connected:', socket.id);

  socket.on('request:init', async (data) => {
    console.log('📥 Received init request:', data);

    const { participantId } = data;

    if (!participantId) {
      console.error('❌ No participantId provided in init request');
      socket.emit('init_error', { message: 'No participantId provided' });
      return;
    }

    // Get participant from database
    const participant = await getParticipant(participantId);
    if (!participant) {
      console.error(`❌ Participant ${participantId} not found in database`);
      socket.emit('init_error', { message: 'Participant not found' });
      return;
    }

    const session = getOrCreateSession(participantId, participant.parity);

    // Add socket to session connections
    session.socketConnections.add(socket.id);
    socketToParticipant.set(socket.id, participantId);

    // Activate session
    session.isActive = true;

    // ВАЖНО: добавляем сокет в комнату по participantId
    socket.join(participantId);

    console.log(`🔗 Socket ${socket.id} connected to session ${participantId}. Total connections: ${session.socketConnections.size}`);

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

  socket.on('ticket:status:update', async (data) => {
    console.log(`🔧 DEBUG: Received ticket:status:update for ticket ${data.ticketId}, status ${data.newStatus} from socket ${socket.id}`);

    const { ticketId, newStatus, participantId } = data;

    if (!participantId) {
      console.error('❌ No participantId in ticket:status:update');
      return;
    }

    // ВАЖНО: ищем сессию по participantId, а не по socket.id
    const session = getSessionByParticipantId(participantId);
    if (!session) {
      console.error('❌ No session found for participant:', participantId);
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
    console.log(`🔧 DEBUG: Ticket details:`, {
      title: ticket.title,
      isTutorial: ticket.isTutorial,
      isCritical: ticket.isCritical,
      assignedTo: ticket.assignedTo
    });

    // Обновляем статус
    const oldStatus = ticket.status;
    ticket.status = newStatus;

    // --- LOG ACTION: status change ---
    const actionType = newStatus === 'in Progress' ? 'ticket_taken' :
                       newStatus === 'not assigned' ? 'ticket_unassigned' :
                       newStatus === 'solved' ? 'ticket_marked_solved' : 'ticket_status_change';
    await logAction(participantId, session.currentStage, actionType, ticketId, {
      oldStatus,
      newStatus,
      isCritical: ticket.isCritical,
      isTutorial: ticket.isTutorial
    });

    if (newStatus === 'in Progress') {
      ticket.assignedTo = 'participant';
      ticket.assignedAt = Date.now();
      // For tutorial tickets, no deadline
      if (!ticket.isTutorial) {
        ticket.deadlineSolve = Date.now() + (ticket.isCritical ? 60000 : 180000);
      }
      console.log(`🔧 DEBUG: Ticket assigned to participant with solve deadline: ${ticket.deadlineSolve}`);
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
      // Если тикет был назначен на участника, сбрасываем
      if (ticket.assignedTo === 'participant') {
        ticket.assignedTo = null;
        ticket.deadlineSolve = null;
        console.log(`🔧 DEBUG: Ticket unassigned from participant`);
      }
    } else if (newStatus === 'solved') {
      console.log(`🔧 DEBUG: Ticket marked as solved`);
      // Если тикет отмечается как решенный, но еще не имеет решения, создаем пустое решение
      if (!ticket.solution) {
        ticket.solution = 'Marked as solved without detailed solution';
        ticket.solutionAuthor = 'participant';
      }
    }

    // Emit update to all sockets in this session using room
    io.to(participantId).emit('tickets:update', session.tickets);

    console.log(`✅ DEBUG: Ticket ${ticketId} updated successfully from ${oldStatus} to ${newStatus}`);
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

    // --- LOG ACTION: ticket solved ---
    await logAction(session.participantId, session.currentStage, 'ticket_solved', t.id, {
      solution: data.solution,
      linkedKbId: data.linkedKbId,
      isCritical: t.isCritical,
      isTutorial: t.isTutorial
    });

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

    // Используем комнату для отправки обновлений
    io.to(session.participantId).emit('tickets:update', session.tickets);

    // For tutorial tickets, always show success
    if (t.isTutorial) {
      t.messages.push({
        from: 'client',
        text: 'Thank you! The problem is solved!',
        timestamp: Date.now() + 100
      });

      io.to(session.participantId).emit('tickets:update', session.tickets);

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
        io.to(session.participantId).emit('client:notification', {
          type: 'success',
          message: `Client confirmed solution for ${t.isCritical ? '🚨 CRITICAL ' : ''}ticket #${t.id.slice(0, 5)}`
        });
      } else {
        t.status = 'in Progress';
        t.deadlineSolve = Date.now() + (t.isCritical ? 60000 : 120000);

        t.messages.push({
          from: 'system',
          text: t.isCritical
            ? '🚨 CRITICAL TICKET RETURNED: Immediate action required!'
            : 'TICKET RETURNED: Client not satisfied with solution.',
          timestamp: Date.now() + 10
        });

        io.to(session.participantId).emit('client:notification', {
          type: 'error',
          message: `Error! ${t.isCritical ? '🚨 CRITICAL ' : ''}Ticket #${t.id.slice(0, 5)} returned to work.`
        });
      }

      io.to(session.participantId).emit('tickets:update', session.tickets);

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
    if (session.currentStage !== 2 || session.participantParity !== 'even') {
      console.log(`⚠️ AI not available: stage=${session.currentStage}, parity=${session.participantParity}`);
      return;
    }

    const ticket = session.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      console.error(`❌ Ticket ${ticketId} not found`);
      return;
    }

    console.log(`🤖 Processing AI request for ticket: ${ticketId}, title: "${ticket.title}"`);

    const keywords = ticket.title.toLowerCase().split(' ');
    const foundKb = kbArticles.find(k => keywords.some(word => word.length > 3 && k.title.toLowerCase().includes(word)));

    let responseText = "Unfortunately, I didn't find exact match in knowledge base.";
    let foundKbId = null;

    if (foundKb) {
      const firstSentence = foundKb.content.split('.')[0] + '.';
      responseText = ticket.isCritical
        ? `Request error, please try again`
        : `Advice: ${firstSentence} Try this article from the knowledge base "${foundKb.title}". `;
      foundKbId = foundKb.id;
    }

    console.log(`🤖 AI response for ${ticketId}: ${responseText.substring(0, 50)}...`);

    // --- LOG ACTION: ai ask ---
    logAction(session.participantId, session.currentStage, 'ai_ask', ticketId, {
      question: ticket.title,
      foundKb: !!foundKb,
      kbId: foundKbId
    });

    // Отправляем ответ обратно на тот же сокет
    socket.emit('ai:response', { ticketId, text: responseText, kbId: foundKbId });

    // Также отправляем уведомление другим сокетам в сессии
    session.socketConnections.forEach(socketId => {
      const sock = io.sockets.sockets.get(socketId);
      if (sock && sock.id !== socket.id) {
        sock.emit('ai:notification', {
          type: 'advice_given',
          message: `AI provided advice for ticket #${ticket.id.slice(0, 5)}`
        });
      }
    });

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
    if (session.currentStage !== 2 || session.participantParity !== 'odd') {
      console.log(`⚠️ Delegation not available: stage=${session.currentStage}, parity=${session.participantParity}`);
      socket.emit('bot:notification', {
        botName: 'System',
        message: "Delegation is only available in stage 2 for odd participants",
        type: 'error'
      });
      return;
    }

    const ticket = session.tickets.find(t => t.id === ticketId);
    const agent = session.agents.find(a => a.id === botId);

    if (!ticket) {
      console.error(`❌ Ticket ${ticketId} not found`);
      socket.emit('bot:notification', {
        botName: 'System',
        message: "Ticket not found",
        type: 'error'
      });
      return;
    }

    if (!agent) {
      console.error(`❌ Agent ${botId} not found`);
      socket.emit('bot:notification', {
        botName: 'System',
        message: "Colleague not found",
        type: 'error'
      });
      return;
    }

    // Проверяем, назначен ли тикет участнику (статус 'in Progress' и assignedTo === 'participant')
    if (ticket.status !== 'in Progress' || ticket.assignedTo !== 'participant') {
      console.error(`❌ Ticket ${ticketId} not assigned to participant (status: ${ticket.status}, assignee: ${ticket.assignedTo})`);
      socket.emit('bot:notification', {
        botName: 'System',
        message: "You must assign the ticket to yourself first (status 'In Progress')",
        type: 'error'
      });
      return;
    }

    // Проверяем статус бота
    if (agent.status !== 'online') {
      console.log(`⚠️ Agent ${botId} is ${agent.status}, cannot delegate`);
      socket.emit('bot:notification', {
        botName: agent.name,
        message: `is ${agent.status === 'away' ? 'away (not at the workplace)' : 'offline'}. Cannot delegate ticket.`,
        type: 'warning'
      });
      return;
    }

    console.log(`✅ Delegating ticket ${ticketId} to agent ${agent.name}`);

    // --- LOG ACTION: delegate request ---
    await logAction(session.participantId, session.currentStage, 'bot_delegate', ticketId, {
      botId,
      botName: agent.name,
      botTrust: agent.trust
    });

    await writeLog('DELEGATE_REQUEST', 'participant', {
      ticketId,
      participantId: session.participantId,
      bot: agent.name,
      aiMode: session.currentAiMode,
      stage: session.currentStage,
      parity: session.participantParity,
      isCritical: ticket.isCritical
    });

    // Проверяем, поможет ли бот (на основе trust уровня)
    if (Math.random() > agent.trust) {
      console.log(`❌ Agent ${agent.name} refused to help (trust: ${agent.trust})`);

      setTimeout(() => {
        const isIgnore = Math.random() > 0.5;
        if (isIgnore) {
          socket.emit('bot:notification', {
            botName: agent.name,
            message: "read the request, but didn't respond.",
            type: 'warning'
          });
          writeLog('BOT_IGNORE', agent.name, {
            ticketId,
            participantId: session.participantId,
            stage: session.currentStage,
            parity: session.participantParity
          });
        } else {
          socket.emit('bot:notification', {
            botName: agent.name,
            message: "refused: «I'm busy with other tasks»",
            type: 'error'
          });
          writeLog('BOT_REFUSAL', agent.name, {
            ticketId,
            participantId: session.participantId,
            stage: session.currentStage,
            parity: session.participantParity
          });
        }
      }, 2000 + Math.random() * 2000);
      return;
    }

    console.log(`✅ Agent ${agent.name} accepted the delegation (trust: ${agent.trust})`);

    // СРАЗУ обновляем статус тикета и назначаем на бота
    ticket.assignedTo = agent.name;
    ticket.messages = ticket.messages || [];
    ticket.messages.push({
      from: 'agent',
      text: `${agent.name} accepted the task and started working...`,
      timestamp: Date.now()
    });

    // Отправляем обновление всем клиентам в сессии СРАЗУ через комнату
    io.to(session.participantId).emit('tickets:update', session.tickets);

    // Отправляем уведомление о принятии задачи
    socket.emit('bot:notification', {
      botName: agent.name,
      message: "accepted the task and started working...",
      type: 'info'
    });

    await writeLog('BOT_ACCEPT', agent.name, {
      ticketId,
      participantId: session.participantId,
      stage: session.currentStage,
      parity: session.participantParity
    });

    console.log(`⏳ Agent ${agent.name} started working on ticket ${ticketId}`);

    // Имитируем время решения задачи ботом
    const solveTime = ticket.isCritical ?
      (5000 + Math.random() * 5000) :
      (10000 + Math.random() * 10000);

    setTimeout(async () => {
      if (ticket.assignedTo === agent.name && ticket.status === 'in Progress') {
        // Для критических тикетов – 99% шанс провала
        if (ticket.isCritical && Math.random() * 100 < BOT_CRITICAL_FAIL_PROB) {
          console.log(`❌ Agent ${agent.name} failed to solve critical ticket ${ticketId}`);

          ticket.status = 'not assigned';
          ticket.assignedTo = null;
          ticket.messages.push({
            from: 'agent',
            text: `${agent.name} tried but couldn't solve the critical issue. Returning ticket to queue.`,
            timestamp: Date.now()
          });

          io.to(session.participantId).emit('tickets:update', session.tickets);
          socket.emit('bot:notification', {
            botName: agent.name,
            message: `failed to solve critical ticket, returning to queue.`,
            type: 'error'
          });

          await writeLog('BOT_FAIL_CRITICAL', agent.name, {
            ticketId,
            participantId: session.participantId,
            stage: session.currentStage,
            parity: session.participantParity,
            isCritical: true
          });

          return; // не продолжаем успешное решение
        }

        console.log(`✅ Agent ${agent.name} solved ticket ${ticketId}`);

        ticket.status = 'solved';
        ticket.solution = ticket.isCritical
          ? `🚨 CRITICAL TICKET RESOLVED by ${agent.name}: Emergency server restart performed, services restored. Root cause: hardware failure in power supply unit.`
          : `Solved by ${agent.name} based on standard operating procedures.`;
        ticket.solutionAuthor = agent.name;
        ticket.linkedKbId = 'bot_auto';

        // Добавляем сообщение от бота
        ticket.messages = ticket.messages || [];
        ticket.messages.push({
          from: 'agent',
          text: ticket.isCritical
            ? `🚨 CRITICAL ISSUE RESOLVED: ${agent.name} completed emergency procedures. All systems back online.`
            : `${agent.name}: Task completed successfully. Issue resolved.`,
          timestamp: Date.now()
        });

        // Отправляем обновление всем клиентам через комнату
        io.to(session.participantId).emit('tickets:update', session.tickets);

        // Уведомление инициатору
        socket.emit('bot:notification', {
          botName: agent.name,
          message: `successfully solved ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket "${ticket.title.slice(0, 30)}..."`,
          type: 'success'
        });

        await writeLog('BOT_SOLVE', agent.name, {
          ticketId,
          participantId: session.participantId,
          stage: session.currentStage,
          parity: session.participantParity
        });

        // Через секунду добавляем ответ клиента
        setTimeout(() => {
          ticket.messages.push({
            from: 'client',
            text: ticket.isCritical
              ? '🚨 Thank you for the quick response! Business operations restored, all systems working normally.'
              : 'Thank you, the problem is solved! Everything works correctly now.',
            timestamp: Date.now() + 100
          });

          io.to(session.participantId).emit('tickets:update', session.tickets);
        }, 1000);
      }
    }, solveTime);
  });

  socket.on('tutorial:completed', async (data) => {
    console.log('📝 Tutorial completed event received:', data);

    const session = getSessionBySocket(socket.id);
    if (!session) {
      console.error('❌ No session found for socket:', socket.id);
      return;
    }

    // --- LOG ACTION: tutorial completed ---
    await logAction(session.participantId, session.currentStage, 'tutorial_completed', null, {});

    console.log(`📈 Updating session ${session.participantId} from stage ${session.currentStage} to stage 2`);

    // Обновляем стадию сессии на 2
    session.currentStage = 2;

    // Останавливаем спавн тикетов для туториала
    stopTicketSpawningForSession(session);

    // Останавливаем проверку дедлайнов для туториала
    stopDeadlineCheckForSession(session);

    // Фильтруем только tutorial тикеты для удаления
    session.tickets = session.tickets.filter(ticket => !ticket.isTutorial);

    // Сбрасываем агентов в базовое состояние
    session.agents = JSON.parse(JSON.stringify(baseAgents));

    console.log(`✅ Tutorial completed for ${session.participantId}, ready for stage 2`);

    // Отправляем подтверждение клиенту
    socket.emit('tutorial:completed:ack', {
      success: true,
      currentStage: 2,
      participantParity: session.participantParity
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

        // Если нет подключенных клиентов, деактивируем сессию
        if (session.socketConnections.size === 0) {
          session.isActive = false;
          console.log(`💤 Session ${participantId} is now inactive (no clients connected)`);

          // Останавливаем все интервалы для этой сессии
          stopTicketSpawningForSession(session);
          stopBotLifecycleForSession(session);
          stopStageTimerForSession(session);
          stopDeadlineCheckForSession(session);
        }
      }
      socketToParticipant.delete(socket.id);
    }

    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

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

  // --- ВАЖНО: Сохраняем состояние таймера перед сменой режима ---
  const previousAiMode = session.currentAiMode;
  const stageStartTime = session.stageStartTime;
  const stageDuration = session.stageDuration;
  const stageTimerInterval = session.stageTimerInterval;
  const deadlineCheckInterval = session.deadlineCheckInterval;
  const spawnInterval = session.spawnInterval;
  const botCheckInterval = session.botCheckInterval;

  // Сохраняем предыдущее состояние тикетов
  const previousTickets = [...session.tickets];

  session.currentAiMode = aiMode;

  // НЕ очищаем тикеты при смене режима ИИ
  // Восстанавливаем тикеты (на случай, если они были потеряны)
  session.tickets = previousTickets;

  // Broadcast the change to all connected clients in this session using room
  io.to(participantId).emit('ai:mode_changed', { aiMode: session.currentAiMode });
  io.to(participantId).emit('tickets:update', session.tickets);

  // Если таймер был активен, отправляем текущее время
  if (session.currentStage === 2 && session.stageStartTime && session.stageDuration) {
    const timeElapsed = Date.now() - session.stageStartTime;
    const timeLeftMs = Math.max(0, session.stageDuration - timeElapsed);
    const timeLeftSec = Math.floor(timeLeftMs / 1000);

    // Отправляем актуальное время таймера
    io.to(participantId).emit('shift:timer:update', { timeLeft: timeLeftSec });

    // Перезапускаем таймер, если он был остановлен
    if (!session.stageTimerInterval) {
      startStageTimerForSession(session);
    }
  }

  await writeLog('AI_MODE_CHANGED', 'ADMIN', {
    participantId,
    aiMode: session.currentAiMode,
    stage: session.currentStage,
    parity: parity,
    ticketsCount: session.tickets.length,
    previousAiMode: previousAiMode,
    timeRemaining: session.stageStartTime ? Math.floor((session.stageDuration - (Date.now() - session.stageStartTime)) / 1000) : 0
  });

  res.json({
    success: true,
    aiMode: session.currentAiMode,
    ticketsCount: session.tickets.length,
    timeRemaining: session.stageStartTime ? Math.floor((session.stageDuration - (Date.now() - session.stageStartTime)) / 1000) : 0
  });
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

  // Clear existing intervals
  stopTicketSpawningForSession(session);
  stopBotLifecycleForSession(session);
  stopStageTimerForSession(session);
  stopDeadlineCheckForSession(session);

  // At stage 1 (tutorial) all bots offline
  if (session.currentStage === 1) {
    // Для туториала очищаем тикеты только если их нет
    if (session.tickets.length === 0) {
      session.tickets = [];
    }

    session.agents.forEach(a => a.status = 'offline');
    console.log(`🎮 Starting tutorial for ${participantId}`);

    // Спауним tutorial тикеты только если их нет
    if (session.tickets.filter(t => t.isTutorial).length === 0) {
      for (let i = 0; i < 3; i++) {
        setTimeout(async () => {
          await spawnTicketForSession(session, false, true);
        }, i * 1500);
      }
    }

    // Запускаем проверку дедлайнов для туториала (без дедлайнов, но для уведомлений)
    startDeadlineCheckForSession(session);
  }
  // At stage 2: if odd participant - bots online (available for delegation)
  // if even - bots offline (work with AI)
  else if (session.currentStage === 2) {
    if (session.participantParity === 'odd') {
      // Для нечётных участников выбираем случайное количество ботов (1-5) из общего пула
      const numBots = Math.floor(Math.random() * 5) + 1; // 1 to 5
      // Перемешиваем копию baseAgents и берём первые numBots
      const shuffled = [...baseAgents].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, numBots).map(agent => ({ ...agent, status: 'online' }));
      session.agents = selected;
      console.log(`👥 Selected ${numBots} bots for odd participant ${participantId}`);
    } else {
      // Для чётных участников все боты остаются, но в статусе offline
      session.agents.forEach(a => a.status = 'offline');
      console.log(`🤖 Setting bots to offline for even participant ${participantId}`);
    }

    // Set stage start time and duration for critical ticket timing
    // ВАЖНО: Не перезаписываем, если уже установлено!
    if (!session.stageStartTime) {
      session.stageStartTime = Date.now();
    }
    if (!session.stageDuration) {
      session.stageDuration = SHIFT_DURATION_MS;
    }

    // Start automatic ticket spawning for stage 2
    if (!session.spawnInterval) {
      startTicketSpawningForSession(session);
    }

    // Start stage timer
    if (!session.stageTimerInterval) {
      startStageTimerForSession(session);
    }

    // Start deadline check
    if (!session.deadlineCheckInterval) {
      startDeadlineCheckForSession(session);
    }

    await writeLog('STAGE_2_STARTED', 'System', {
      participantId,
      startTime: session.stageStartTime,
      duration: session.stageDuration,
      participantParity: session.participantParity
    });
  }

  // Send updated session data to all connected sockets using room
  io.to(participantId).emit('init', {
    tickets: session.tickets,
    kbArticles: kbArticles,
    agents: session.agents,
    currentStage: session.currentStage,
    aiMode: session.currentAiMode,
    participantParity: session.participantParity
  });

  await writeLog('STAGE_START', 'ADMIN', {
    participantId,
    stage: session.currentStage,
    aiMode: session.currentAiMode,
    participantParity: session.participantParity,
    ticketsCount: session.tickets.length
  });

  res.json({
    success: true,
    stage: session.currentStage,
    aiMode: session.currentAiMode,
    participantParity: session.participantParity,
    ticketsCount: session.tickets.length
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
app.get('/debug', async (req, res) => {
  const sessionsData = {};

  for (const [participantId, session] of sessions) {
    sessionsData[participantId] = {
      participantParity: session.participantParity,
      currentStage: session.currentStage,
      ticketsCount: session.tickets.length,
      tickets: session.tickets.map(t => ({ id: t.id.slice(0, 5), title: t.title, status: t.status, isTutorial: t.isTutorial })),
      agents: session.agents.map(a => ({ name: a.name, status: a.status })),
      currentAiMode: session.currentAiMode,
      spawnIntervalActive: !!session.spawnInterval,
      botCheckIntervalActive: !!session.botCheckInterval,
      stageTimerActive: !!session.stageTimerInterval,
      deadlineCheckActive: !!session.deadlineCheckInterval,
      stageStartTime: session.stageStartTime,
      stageDuration: session.stageDuration,
      isActive: session.isActive,
      socketConnections: Array.from(session.socketConnections),
      socketToParticipant: Array.from(socketToParticipant.entries()).filter(([_, pid]) => pid === participantId)
    };
  }

  // Get participants from database
  let participants = [];
  try {
    const result = await pool.query('SELECT id, participant_uuid, parity, created_at, last_seen_at FROM participants ORDER BY id DESC LIMIT 20');
    participants = result.rows;
  } catch (error) {
    console.error('Error getting participants:', error);
  }

  res.json({
    totalSessions: sessions.size,
    sessions: sessionsData,
    totalConnections: io.engine.clientsCount,
    socketToParticipant: Array.from(socketToParticipant.entries()),
    participants: participants
  });
});

// Health check endpoint for Render
app.get('/health', async (req, res) => {
  let dbStatus = 'unknown';

  try {
    const result = await pool.query('SELECT 1 as test');
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
  }

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    totalSessions: sessions.size,
    activeSessions: Array.from(sessions.values()).filter(s => s.isActive).length,
    connectedClients: io.engine.clientsCount,
    database: dbStatus,
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
  } else if (req.path === '/instructions.html') {
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
  console.log(`🧠 Server-side participant distribution system ready`);
  console.log(`📈 Group assignment based on PostgreSQL SERIAL id parity`);
  console.log(`📝 Action logging enabled in table action_logs`);
});