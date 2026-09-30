const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('helpdesk.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS chamados (
    id INTEGER PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    prioridade TEXT NOT NULL,
    status TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  
  CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY,
  chamado_id INTEGER NOT NULL,
  autor TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)
  `);


const colunas = db.prepare("PRAGMA table_info(chamados)").all();
const colunasEsperadas = ['id', 'titulo', 'descricao', 'prioridade', 'status', 'criado_em'];
const temCriadoEm = colunas.some(colunas => colunas.name === 'criado_em');

if(!temCriadoEm) {
  db.exec('ALTER TABLE chamados ADD COLUMN criado_em DATETIMEP');
  console.log('Coluna "criado_em" adicionada à tabela "chamados".');
};

console.log(colunas);

module.exports = db;


