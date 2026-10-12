const express = require('express');
const app = express();
const port = 3000;
const db = require('./database');
const bcryptjs = require('bcryptjs');
const jsonwebtoken = require('jsonwebtoken');

const path = require('path');
require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});


app.use(express.json());
app.use(express.static(require('node:path').join(__dirname, '..', 'public')));

const statusPermitidos = ['Aberto', 'Em andamento', 'Fechado'];
const prioridadesPermitidas = ['Baixa', 'Média', 'Alta'];

function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    jsonwebtoken.verify(token, process.env.JWT_SECRET, (err, usuario) => {
        if(err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.usuario = usuario;
        next();
    });
}

app.get('/chamados', autenticarToken, (req, res) => { 
    
const status = req.query.status;
const prioridade = req.query.prioridade;
const usuarioId = req.usuario.id;
let listaChamados;

if(status && !statusPermitidos.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
}
if(prioridade && !prioridadesPermitidas.includes(prioridade)) {
    return res.status(400).json({ error: 'Prioridade inválida' });
}

if(req.usuario.role === 'admin') {
    listaChamados = db.prepare('SELECT * FROM chamados').all();
}

else {
    listaChamados = db.prepare('SELECT * FROM chamados WHERE usuario_id = ?').all(usuarioId);

    if(status && prioridade) listaChamados = db.prepare('SELECT * FROM chamados WHERE status = ? AND prioridade = ? AND usuario_id = ?').all(status, prioridade, usuarioId);

    else if(status) listaChamados = db.prepare('SELECT * FROM chamados WHERE status = ? AND usuario_id = ?').all(status, usuarioId);

    else if(prioridade) listaChamados = db.prepare('SELECT * FROM chamados WHERE prioridade = ? AND usuario_id = ?').all(prioridade, usuarioId);

    else listaChamados = db.prepare('SELECT * FROM chamados WHERE usuario_id = ?').all(usuarioId);

    res.json(listaChamados);
});

app.get('/chamados/:id', autenticarToken, (req, res) => { 
    const id = parseInt(req.params.id);
    const chamado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(id);
    
    if(!chamado) {
        return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    res.json(chamado);
});

app.patch('/chamados/:id', autenticarToken, (req, res) => {
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

app.post('/chamados', autenticarToken, (req, res) => {
    const { titulo, descricao, prioridade } = req.body;
    const usuarioId = req.usuario.id;

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

    const inserirChamado = db.prepare('INSERT INTO chamados (titulo, descricao, prioridade, status, usuario_id, criado_em) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)');

    inserirChamado.run(titulo.trim(), descricao.trim(), prioridade, 'Aberto', usuarioId);

    const resultado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(db.prepare('SELECT last_insert_rowid() as id').get().id);

    res.status(201).json(resultado); 



});

app.delete('/chamados/:id', autenticarToken, (req, res) => {
    const id = parseInt(req.params.id);
    const chamado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(id);

    if(!chamado) {
        return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    db.exec('BEGIN');
    try {
        db.prepare('DELETE FROM mensagens WHERE chamado_id = ?').run(id);
        db.prepare('DELETE FROM chamados WHERE id = ?').run(id);
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    res.status(204).send();

});

app.post('/chamados/:id/mensagens', autenticarToken, (req, res) => {
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

app.get('/chamados/:id/mensagens', autenticarToken, (req, res) => {
    const id = parseInt(req.params.id);
    const chamado = db.prepare('SELECT * FROM chamados WHERE id = ?').get(id);

    if(!chamado) {
        return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    const mensagens = db.prepare('SELECT * FROM mensagens WHERE chamado_id = ? ORDER BY criado_em ASC').all(id);
    res.json(mensagens);
});

async function hashPassword(senha) {
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(senha, salt);
    return hashedPassword;
}

app.post('/usuarios', async (req, res) => {
    const { nome, username, email, senha } = req.body;

    if(!nome || !username || !email || !senha) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const emailExistente = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if(emailExistente) {
        return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const usernameExistente = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
    if(usernameExistente) {
        return res.status(400).json({ error: 'Username já cadastrado' });
    }

    const senhaHash = await hashPassword(senha);
    
    db.prepare('INSERT INTO usuarios (nome, username, email, senha, criado_em) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)').run(nome, username, email, senhaHash);

    const resultado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(db.prepare('SELECT last_insert_rowid() as id').get().id);
    res.status(201).json(resultado);

   
});

app.post('/login', async (req, res) => {
    const { username, senha } = req.body;

    if(!username || !senha) {
        return res.status(400).json({ error: 'Username e senha são obrigatórios' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);

    if(!usuario) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
    }


    const senhaValida = await bcryptjs.compare(senha, usuario.senha);

    if(!senhaValida) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jsonwebtoken.sign({ id: usuario.id, username: usuario.username, role: usuario.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });

    


});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`HelpDesk API online na porta ${port}`);
    });
}

module.exports = app;










