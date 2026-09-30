const express = require('express');
const app = express();
const port = 3000;
const db = require('./database');

app.use(express.json());

const statusPermitidos = ['Aberto', 'Em andamento', 'Fechado'];
const prioridadesPermitidas = ['Baixa', 'Média', 'Alta'];

app.get('/chamados', (req, res) => {
    
const status = req.query.status;
const prioridade = req.query.prioridade;

if(status && !statusPermitidos.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
}
if(prioridade && !prioridadesPermitidas.includes(prioridade)) {
    return res.status(400).json({ error: 'Prioridade inválida' });
}
    let listaChamados;

    if(status && prioridade) listaChamados = db.prepare('SELECT * FROM chamados WHERE status = ? AND prioridade = ?').all(status, prioridade);

    else if(status) listaChamados = db.prepare('SELECT * FROM chamados WHERE status = ?').all(status);

    else if(prioridade) listaChamados = db.prepare('SELECT * FROM chamados WHERE prioridade = ?').all(prioridade);

    else listaChamados = db.prepare('SELECT * FROM chamados').all();

    res.json(listaChamados);
});

app.get('/chamados/:id', (req, res) => { 
    const id = parseInt(req.params.id);
    const chamado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(id);
    
    if(!chamado) {
        return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    res.json(chamado);
});

app.patch('/chamados/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const chamado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(id);

    if(!chamado) {
        return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    const { status } = req.body;

    if(!status) {
        return res.status(400).json({ error: 'Status é obrigatório' });
    }


    if(!statusPermitidos.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
    }

    db.prepare('UPDATE chamados SET status = ? WHERE id = ?').run(status, id);
   
    const chamadoAtualizado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(id);

    res.json(chamadoAtualizado);

})

app.post('/chamados', (req, res) => {
    const { titulo, descricao, prioridade } = req.body;

    if(!titulo || !descricao) {
        return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
    } 

    if(typeof titulo !== 'string' || typeof descricao !== 'string') {
        return res.status(400).json({ error: 'Título e descrição devem ser strings' });
    }

    if(titulo.trim() === '' || descricao.trim() === '') {
        return res.status(400).json({ error:
             'Título e descrição não podem ser vazios' });
    }

    if(!prioridadesPermitidas.includes(prioridade)) {
        return res.status(400).json({ error: 'Prioridade inválida' });
    }

    const inserirChamado = db.prepare('INSERT INTO chamados (titulo, descricao, prioridade, status, criado_em) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)');

    inserirChamado.run(titulo.trim(), descricao.trim(), prioridade, 'Aberto');

    const resultado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(db.prepare('SELECT last_insert_rowid() as id').get().id);

    res.status(201).json(resultado);



});

app.delete('/chamados/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const chamado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(id);

    if(!chamado) {
        return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    db.prepare('DELETE FROM chamados WHERE id = ?').run(id);
    res.status(204).send();

});

app.post('/chamados/:id/mensagens', (req, res) => {
    const id = parseInt(req.params.id);
    const chamado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(id);

    if(!chamado) {
        return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    const { autor, mensagem } = req.body;

    if(!autor || !mensagem) {
        return res.status(400).json({ error: 'Autor e mensagem são obrigatórios' });
    }

    db.prepare('INSERT INTO mensagens (chamado_id, autor, mensagem, criado_em) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').run(id, autor, mensagem);

    const resultado = db.prepare('SELECT * FROM mensagens WHERE id = ?').get(db.prepare('SELECT last_insert_rowid() as id').get().id);
    res.status(201).json(resultado);

});

app.get('/chamados/:id/mensagens', (req, res) => {
    const id = parseInt(req.params.id);
    const chamado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(id);

    if(!chamado) {
        return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    const mensagens = db.prepare('SELECT * FROM mensagens WHERE chamado_id = ? ORDER BY criado_em ASC').all(id);
    res.json(mensagens);
});

app.listen(port, () => {
  console.log(`HelpDesk API online na porta ${port}`);
  
});










