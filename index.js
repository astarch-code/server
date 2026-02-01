const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  } 
});

// --- PostgreSQL Connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS experiment_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        stage INTEGER,
        participant_parity VARCHAR(10),
        action VARCHAR(100),
        user_type VARCHAR(100),
        details JSONB
      )
    `);

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ticket_id VARCHAR(100) UNIQUE,
        title TEXT,
        description TEXT,
        status VARCHAR(50),
        severity VARCHAR(50),
        assigned_to VARCHAR(100),
        created_at TIMESTAMP,
        deadline_assign TIMESTAMP,
        deadline_solve TIMESTAMP,
        solution TEXT,
        linked_kb_id VARCHAR(100),
        solution_author VARCHAR(100),
        is_critical BOOLEAN,
        is_tutorial BOOLEAN,
        stage INTEGER,
        participant_parity VARCHAR(10)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id VARCHAR(100),
        message_from VARCHAR(100),
        message_text TEXT,
        timestamp TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id) ON DELETE CASCADE
      )
    `);

    console.log('Database tables initialized successfully');
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

const agents = [
  { id: 'bot1', name: 'Lukas Schneider (experienced and friendly worker)', skill: 0.9, trust: 0.9, greeting: "Hello! I'm on shift. Write if you need help.", status: 'online' },
  { id: 'bot2', name: 'Anna Müller (rookie)', skill: 0.5, trust: 0.5, greeting: "Hey. Lots of work...", status: 'online' },
  { id: 'bot3', name: 'Jonas Weber (very friendly)', skill: 0.4, trust: 0.7, greeting: "Good day, colleagues.", status: 'online' }
];

const kbArticles = [
  { id: 'kb_101', title: 'VPN Connection Error (Error 800)', content: 'Check user certificates in the Certs folder. If they have expired, reissue via the portal. Restart Cisco AnyConnect.' },
  { id: 'kb_102', title: 'Printer Paper Jam (HP 4000)', content: 'Open tray 2 and check the pickup rollers. If rollers are worn, replacement is required. Temporary solution: clean with alcohol.' },
  { id: 'kb_103', title: 'Outlook Not Synchronizing', content: 'Check connection to Exchange. Disable Cached Mode in account settings, restart Outlook, then enable again.' },
  { id: 'kb_104', title: 'Blue Screen (BSOD) SYSTEM_THREAD', content: 'Error caused by old video card drivers. Update drivers via Device Manager or manufacturer website.' },
  { id: 'kb_105', title: 'SAP Password Reset', content: 'Use transaction SU01. Enter username, go to Logon Data tab and set temporary password.' }
];

let tickets = [];
let currentStage = 1; // 1 = tutorial, 2 = experiment
let currentAiMode = 'normal';
let participantParity = null; // 'even' or 'odd'
let stageStartTime = null; // Time when stage 2 started
let stageDuration = null; // Duration of stage 2 in ms

// --- LOGGING FUNCTIONS WITH POSTGRES ---
const writeLog = async (action, user, details) => {
  try {
    const query = `
      INSERT INTO experiment_logs (stage, participant_parity, action, user_type, details)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pool.query(query, [currentStage, participantParity, action, user, details]);
    console.log(`[LOG] ${action}: ${JSON.stringify(details)}`);
  } catch (error) {
    console.error('Error writing log to database:', error);
  }
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

const saveTicketToDB = async (ticket) => {
  try {
    const query = `
      INSERT INTO tickets (
        ticket_id, title, description, status, severity, assigned_to, 
        created_at, deadline_assign, deadline_solve, solution, linked_kb_id, 
        solution_author, is_critical, is_tutorial, stage, participant_parity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (ticket_id) DO UPDATE SET
        status = EXCLUDED.status,
        assigned_to = EXCLUDED.assigned_to,
        deadline_solve = EXCLUDED.deadline_solve,
        solution = EXCLUDED.solution,
        linked_kb_id = EXCLUDED.linked_kb_id,
        solution_author = EXCLUDED.solution_author
    `;
    
    await pool.query(query, [
      ticket.id,
      ticket.title,
      ticket.description,
      ticket.status,
      ticket.severity,
      ticket.assignedTo,
      new Date(ticket.createdAt),
      ticket.deadlineAssign ? new Date(ticket.deadlineAssign) : null,
      ticket.deadlineSolve ? new Date(ticket.deadlineSolve) : null,
      ticket.solution,
      ticket.linkedKbId,
      ticket.solutionAuthor,
      ticket.isCritical,
      ticket.isTutorial,
      currentStage,
      participantParity
    ]);

    // Save messages
    if (ticket.messages && ticket.messages.length > 0) {
      for (const message of ticket.messages) {
        const msgQuery = `
          INSERT INTO ticket_messages (ticket_id, message_from, message_text, timestamp)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `;
        await pool.query(msgQuery, [
          ticket.id,
          message.from,
          message.text,
          new Date(message.timestamp)
        ]);
      }
    }
  } catch (error) {
    console.error('Error saving ticket to database:', error);
  }
};

// --- LOGIC ---

const spawnTicket = async (isCritical = false, tutorialTicket = false) => {
  const templates = [
    { title: 'VPN Not Working From Home', desc: 'Employee cannot connect to the network.' },
    { title: 'Printer in Accounting Jammed Paper', desc: 'Print queue stalled, red light blinking.' },
    { title: '1C Crashed During Report', desc: 'Program closes with memory error.' },
    { title: 'Access Needed to Network Folder', desc: 'Marketing needs access to Z drive.' },
    { title: 'Outlook Not Receiving Email', desc: 'Last email received 3 hours ago.' }
  ];
  const tmpl = templates[Math.floor(Math.random() * templates.length)];

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

  tickets.push(newTicket);
  io.emit('ticket:new', newTicket);
  
  // Save to database
  await saveTicketToDB(newTicket);
  
  // Для критических тикетов сразу отправляем специальное уведомление
  if (isCritical && !tutorialTicket) {
    io.emit('client:notification', {
      type: 'critical',
      message: '🚨 CRITICAL TICKET: Server Down! Immediate action required! Business impact!'
    });
  }
  
  await writeLog('TICKET_SPAWN', 'System', { 
    ticketId: newTicket.id, 
    aiMode: currentAiMode,
    stage: currentStage,
    parity: participantParity,
    severity: newTicket.severity,
    isCritical: isCritical,
    tutorialTicket: tutorialTicket
  });

  // Autonomous AI works only at stage 2 for even participants
  if (currentStage === 2 && participantParity === 'even' && currentAiMode === 'autonomous' && !tutorialTicket) {
    setTimeout(() => {
      handleAutonomousAI(newTicket);
    }, 1000);
  }

  // Ticket notifications only at stage 2 for even participants in normal mode
  if (currentStage === 2 && participantParity === 'even' && currentAiMode === 'normal' && !tutorialTicket) {
    setTimeout(() => {
      io.emit('ai:notification', {
        type: 'new_ticket',
        message: `🚨 New ${isCritical ? 'CRITICAL ' : ''}ticket: ${newTicket.title}`,
        isCritical: isCritical
      });
    }, 2000);
  }
  
  return newTicket;
};

const handleAutonomousAI = async (ticket) => {
  if (ticket.status !== 'not assigned') return;

  if (Math.random() * 100 < AUTONOMOUS_AI_CONFIG.missProbability) {
    await writeLog('AI_MISSED_TICKET', 'AI', { 
      ticketId: ticket.id, 
      probability: AUTONOMOUS_AI_CONFIG.missProbability,
      stage: currentStage,
      parity: participantParity,
      isCritical: ticket.isCritical
    });
    io.emit('ai:autonomous_action', { 
      type: 'missed', 
      ticketId: ticket.id,
      message: `AI missed ${ticket.isCritical ? 'CRITICAL ' : ''}ticket`
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
    stage: currentStage,
    parity: participantParity,
    isCritical: ticket.isCritical
  });
  
  io.emit('ai:autonomous_action', { 
    type: 'taken', 
    ticketId: ticket.id,
    message: `AI took ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket #${ticket.id.slice(0, 5)} to work`
  });
  io.emit('tickets:update', tickets);
  await saveTicketToDB(ticket);

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
          probability: AUTONOMOUS_AI_CONFIG.failProbability,
          stage: currentStage,
          parity: participantParity,
          isCritical: ticket.isCritical
        });
        
        io.emit('ai:autonomous_action', { 
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
          io.emit('tickets:update', tickets);
          saveTicketToDB(ticket);
        }, 1000);
        
        await writeLog('AI_SOLVED_TICKET', 'AI', { 
          ticketId: ticket.id, 
          kbId: ticket.linkedKbId,
          stage: currentStage,
          parity: participantParity,
          isCritical: ticket.isCritical
        });
        
        io.emit('ai:autonomous_action', { 
          type: 'solved', 
          ticketId: ticket.id,
          message: `AI successfully solved ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket #${ticket.id.slice(0, 5)}`
        });
      }
      
      io.emit('tickets:update', tickets);
      await saveTicketToDB(ticket);
    }
  }, solveTime);
};

// Auto-spawn tickets only during experiment stage (stage 2)
setInterval(async () => { 
  if (currentStage === 2 && Math.random() > 0.7) {
    // Проверяем, прошла ли половина времени смены
    const timeElapsed = Date.now() - stageStartTime;
    const isSecondHalf = stageStartTime && stageDuration && timeElapsed > (stageDuration / 2);
    
    // Критические тикеты спаунятся только во второй половине времени смены
    const isCritical = isSecondHalf && Math.random() < 0.1;
    await spawnTicket(isCritical);
  }
}, 8000);

setInterval(async () => {
  // Bots active only at stage 2 for odd participants
  if (currentStage !== 2 || participantParity !== 'odd') return;

  let changed = false;

  agents.forEach(agent => {
    if (agent.status === 'online') {
      if (Math.random() < BOT_LIFECYCLE_CONFIG.leaveProbability) {
        agent.status = 'away';
        writeLog('BOT_STATUS_CHANGE', agent.name, { 
          status: 'away',
          stage: currentStage,
          parity: participantParity
        });
        changed = true;
      }
    } else if (agent.status === 'away') {
      if (Math.random() < BOT_LIFECYCLE_CONFIG.returnProbability) {
        agent.status = 'online';
        writeLog('BOT_STATUS_CHANGE', agent.name, { 
          status: 'online',
          stage: currentStage,
          parity: participantParity
        });
        changed = true;
      }
    }
  });

  if (changed) {
    io.emit('agents:update', agents);
  }
}, BOT_LIFECYCLE_CONFIG.checkInterval);

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
  socket.on('request:init', (data) => {
    if (data && data.participantParity) {
      participantParity = data.participantParity;
    }
    socket.emit('init', { 
      tickets, 
      kbArticles, 
      agents, 
      currentStage, 
      aiMode: currentAiMode,
      participantParity
    });
  });

  socket.on('ticket:status:update', async ({ ticketId, newStatus }) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

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
        aiMode: currentAiMode,
        stage: currentStage,
        parity: participantParity,
        isCritical: ticket.isCritical,
        tutorialTicket: ticket.isTutorial
      });
    } else if (newStatus === 'not assigned') {
      ticket.assignedTo = null;
      ticket.deadlineSolve = null;
    }
    io.emit('tickets:update', tickets);
    await saveTicketToDB(ticket);
  });

  socket.on('ticket:solve', async (data) => {
    const t = tickets.find(x => x.id === data.ticketId);
    if (!t) return;

    t.status = 'solved';
    t.solution = data.solution;
    t.linkedKbId = data.linkedKbId;
    t.solutionAuthor = 'participant';

    await writeLog('TICKET_SOLVE', 'participant', { 
      ticketId: t.id, 
      kb: data.linkedKbId, 
      aiMode: currentAiMode,
      stage: currentStage,
      parity: participantParity,
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

    io.emit('tickets:update', tickets);
    await saveTicketToDB(t);

    // For tutorial tickets, always show success
    if (t.isTutorial) {
      t.messages.push({
        from: 'client',
        text: 'Thank you! The problem is solved!',
        timestamp: Date.now() + 100
      });
      io.emit('tickets:update', tickets);
      await saveTicketToDB(t);
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
        io.emit('client:notification', {
          type: 'success',
          message: `Client confirmed solution for ${t.isCritical ? '🚨 CRITICAL ' : ''}ticket #${t.id.slice(0, 5)}`
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

        io.emit('client:notification', {
          type: 'error',
          message: `Error! ${t.isCritical ? '🚨 CRITICAL ' : ''}Ticket #${t.id.slice(0, 5)} returned to work.`
        });
      }

      io.emit('tickets:update', tickets);
      await saveTicketToDB(t);

    }, 1500);
  });

  socket.on('ai:ask', ({ ticketId }) => {
    // AI available only at stage 2 for even participants
    if (currentStage !== 2 || participantParity !== 'even') return;
    
    const ticket = tickets.find(t => t.id === ticketId);
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
      found: !!foundKb, 
      aiMode: currentAiMode,
      stage: currentStage,
      parity: participantParity,
      isCritical: ticket.isCritical
    });
  });

  socket.on('bot:delegate', async ({ ticketId, botId }) => {
    // Delegation available only at stage 2 for odd participants
    if (currentStage !== 2 || participantParity !== 'odd') return;
    
    const ticket = tickets.find(t => t.id === ticketId);
    const agent = agents.find(a => a.id === botId);

    if (!ticket || !agent) return;

    if (agent.status === 'away') {
      socket.emit('bot:notification', { botName: agent.name, message: "is not at the place.", type: 'warning' });
      return;
    }

    await writeLog('DELEGATE_REQUEST', 'participant', { 
      ticketId, 
      bot: agent.name, 
      aiMode: currentAiMode,
      stage: currentStage,
      parity: participantParity,
      isCritical: ticket.isCritical
    });

    if (Math.random() > agent.trust) {
      setTimeout(() => {
        const isIgnore = Math.random() > 0.5;
        if (isIgnore) {
          socket.emit('bot:notification', { botName: agent.name, message: "read, but didn't respond.", type: 'warning' });
          writeLog('BOT_IGNORE', agent.name, { 
            ticketId,
            stage: currentStage,
            parity: participantParity
          });
        } else {
          socket.emit('bot:notification', { botName: agent.name, message: "refused: «I'm busy»", type: 'error' });
          writeLog('BOT_REFUSAL', agent.name, { 
            ticketId,
            stage: currentStage,
            parity: participantParity
          });
        }
      }, 3000 + Math.random() * 2000);
      return;
    }

    setTimeout(async () => {
      ticket.status = 'in Progress';
      ticket.assignedTo = agent.name;
      ticket.deadlineSolve = Date.now() + (ticket.isCritical ? 120000 : 300000);
      io.emit('tickets:update', tickets);
      await writeLog('BOT_ACCEPT', agent.name, { 
        ticketId,
        stage: currentStage,
        parity: participantParity
      });
      await saveTicketToDB(ticket);

      setTimeout(async () => {
        if (ticket.status === 'in Progress' && ticket.assignedTo === agent.name) {
          ticket.status = 'solved';
          ticket.solution = ticket.isCritical 
            ? `🚨 CRITICAL TICKET RESOLVED by ${agent.name}: Emergency server restart performed` 
            : `Solved by ${agent.name}`;
          ticket.solutionAuthor = agent.name;
          ticket.linkedKbId = 'bot_auto';

          io.emit('tickets:update', tickets);
          io.emit('bot:notification', {
            botName: agent.name,
            message: `solved ${ticket.isCritical ? '🚨 CRITICAL ' : ''}ticket "${ticket.title}"`,
            type: 'success'
          });
          await writeLog('BOT_SOLVE', agent.name, { 
            ticketId,
            stage: currentStage,
            parity: participantParity
          });
          await saveTicketToDB(ticket);
        }
      }, (ticket.isCritical ? 5000 : 10000) + Math.random() * 5000);

    }, 3000);
  });
});

setInterval(async () => {
  const now = Date.now();

  tickets.forEach(ticket => {
    // Skip tutorial tickets for overdue checks
    if (ticket.isTutorial) return;

    if (
      ticket.status === 'not assigned' &&
      ticket.deadlineAssign &&
      now > ticket.deadlineAssign &&
      !ticket.assignOverdueReported
    ) {
      ticket.assignOverdueReported = true;
      io.emit('client:notification', {
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
      io.emit('client:notification', {
        type: 'warning',
        message: ticket.isCritical 
          ? '🚨 CRITICAL TICKET SOLUTION OVERDUE: Business operations affected!' 
          : 'Solution took too long. Client is dissatisfied!'
      });
      
      saveTicketToDB(ticket);
    }
  });
}, 5000);

// Endpoint for pre-experiment survey questions
app.get('/api/survey/pre-experiment', (req, res) => {
  try {
    const questions = [
      { id: 'pre_1', question: 'What is your age?', type: 'text', required: true, placeholder: 'Enter your age' },
      { id: 'pre_2', question: 'What is your gender?', type: 'multiple', required: true, options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
      { id: 'pre_3', question: 'What is your highest level of education?', type: 'multiple', required: true, options: ['High School', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD', 'Other'] },
      { id: 'pre_4', question: 'How familiar are you with IT support systems?', type: 'multiple', required: true, options: ['Not familiar at all', 'Slightly familiar', 'Moderately familiar', 'Very familiar', 'Expert'] },
      { id: 'pre_5', question: 'Have you ever worked in IT support or a similar role?', type: 'multiple', required: true, options: ['Yes, professionally', 'Yes, informally', 'No, never'] }
    ];
    res.json({ questions });
  } catch (error) {
    console.error('Error loading pre-experiment survey questions:', error);
    res.status(500).json({ error: 'Failed to load survey questions' });
  }
});

// Endpoint for post-experiment survey questions (depending on parity)
app.get('/api/survey/post-experiment', (req, res) => {
  try {
    const { parity } = req.query;
    
    let questions = [];
    
    if (parity === 'even') {
      questions = [
        { id: 'post_even_1', question: 'How helpful was the AI assistant?', type: 'multiple', required: true, options: ['Not helpful at all', 'Slightly helpful', 'Moderately helpful', 'Very helpful', 'Extremely helpful'] },
        { id: 'post_even_2', question: 'Did the AI assistant improve your efficiency?', type: 'multiple', required: true, options: ['Not at all', 'Slightly improved', 'Moderately improved', 'Significantly improved', 'Extremely improved'] },
        { id: 'post_even_3', question: 'Would you prefer to work with AI assistance in the future?', type: 'multiple', required: true, options: ['Definitely not', 'Probably not', 'Neutral', 'Probably yes', 'Definitely yes'] },
        { id: 'post_even_4', question: 'What aspects of the AI assistant could be improved?', type: 'text', required: false, placeholder: 'Enter your suggestions' }
      ];
    } else if (parity === 'odd') {
      questions = [
        { id: 'post_odd_1', question: 'How helpful were your colleagues?', type: 'multiple', required: true, options: ['Not helpful at all', 'Slightly helpful', 'Moderately helpful', 'Very helpful', 'Extremely helpful'] },
        { id: 'post_odd_2', question: 'Did working with colleagues improve your efficiency?', type: 'multiple', required: true, options: ['Not at all', 'Slightly improved', 'Moderately improved', 'Significantly improved', 'Extremely improved'] },
        { id: 'post_odd_3', question: 'Would you prefer to work with colleagues in the future?', type: 'multiple', required: true, options: ['Definitely not', 'Probably not', 'Neutral', 'Probably yes', 'Definitely yes'] },
        { id: 'post_odd_4', question: 'What aspects of teamwork could be improved?', type: 'text', required: false, placeholder: 'Enter your suggestions' }
      ];
    } else {
      return res.status(400).json({ error: 'Missing or invalid parity parameter' });
    }
    
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
  const { aiMode, participantParity: parity } = req.body;
  
  if (!aiMode || !parity) {
    return res.status(400).json({ error: 'Missing aiMode or participantParity' });
  }
  
  // Only allow change for even participants during stage 2
  if (parity !== 'even' || currentStage !== 2) {
    return res.status(403).json({ error: 'AI mode can only be changed by even participants during experiment stage' });
  }
  
  currentAiMode = aiMode;
  
  // Broadcast the change to all connected clients
  io.emit('ai:mode_changed', { aiMode: currentAiMode });
  
  await writeLog('AI_MODE_CHANGED', 'ADMIN', { 
    aiMode: currentAiMode,
    stage: currentStage,
    parity: parity
  });
  
  res.json({ success: true, aiMode: currentAiMode });
});

app.post('/admin/start', async (req, res) => {
  currentStage = req.body.stage;
  currentAiMode = req.body.aiMode || 'normal';
  participantParity = req.body.participantParity || null;
  
  tickets = [];
  
  // At stage 1 (tutorial) all bots offline
  if (currentStage === 1) {
    agents.forEach(a => a.status = 'offline');
    // Spawn 3 tutorial tickets
    for (let i = 0; i < 3; i++) {
      setTimeout(async () => {
        await spawnTicket(false, true);
      }, i * 1000);
    }
  } 
  // At stage 2: if odd participant - bots online (available for delegation)
  // if even - bots offline (work with AI)
  else if (currentStage === 2) {
    if (participantParity === 'odd') {
      // For odd participants (work with colleagues) bots should be online
      agents.forEach(a => a.status = 'online');
    } else {
      // For even participants (work with AI) bots should be offline
      agents.forEach(a => a.status = 'offline');
    }
    
    // Set stage start time and duration for critical ticket timing
    stageStartTime = Date.now();
    stageDuration = SHIFT_DURATION_MS;
    
    await writeLog('STAGE_2_STARTED', 'System', { 
      startTime: stageStartTime, 
      duration: stageDuration,
      participantParity
    });
  }
  
  io.emit('init', { 
    tickets, 
    kbArticles, 
    agents, 
    currentStage, 
    aiMode: currentAiMode,
    participantParity
  });
  await writeLog('STAGE_START', 'ADMIN', { 
    stage: currentStage, 
    aiMode: currentAiMode,
    participantParity
  });
  res.json({ success: true });
});

// Endpoint to spawn tutorial ticket
app.post('/admin/tutorial/ticket', async (req, res) => {
  const tutorialTicket = await spawnTicket(false, true);
  res.json({ 
    success: true, 
    message: 'Tutorial ticket created',
    ticket: tutorialTicket
  });
});

app.post('/admin/critical', async (req, res) => {
  const criticalTicket = await spawnTicket(true);
  res.json({ 
    success: true, 
    message: 'Critical ticket created',
    ticket: criticalTicket
  });
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));