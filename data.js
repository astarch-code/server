// server/data.js
module.exports.agents = [
    { id: 'bot1', name: 'Alice', skill: 0.9, trust: 0.8 }, // Умная, надежная
    { id: 'bot2', name: 'Bob', skill: 0.4, trust: 0.5 },   // Глуповатый
];

module.exports.kbArticles = [
    { id: 'kb_1', title: 'Printer Paper Jam', content: 'Open tray 1, remove paper, restart.' },
    { id: 'kb_2', title: 'VPN Connection Error', content: 'Check certificates and restart VPN client.' },
    { id: 'kb_3', title: 'Outlook Not Syncing', content: 'Clear cache in settings and restart app.' },
    { id: 'kb_4', title: 'Blue Screen (BSOD)', content: 'Check RAM drivers and reboot.' },
];

// Шаблоны тикетов для генерации
module.exports.ticketTemplates = [
    { title: 'Printer stuck', description: 'Cannot print payroll', correctKbId: 'kb_1' },
    { title: 'VPN failing', description: 'Cannot connect from home', correctKbId: 'kb_2' },
    { title: 'Email delay', description: 'Mails not coming through', correctKbId: 'kb_3' },
];
