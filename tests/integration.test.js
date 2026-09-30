const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

test('Interface e API completas, usando banco temporário', { timeout: 30000 }, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'helpdesk-integration-'));
    const previousDirectory = process.cwd();
    let server, db;
    try {
        process.chdir(directory);
        const app = require('../src/index');
        db = require('../src/database');
        server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const origin = `http://127.0.0.1:${server.address().port}`;
        const request = async (route, method = 'GET', data) => {
            const response = await fetch(origin + route, {
                method, headers: { 'Content-Type': 'application/json' },
                body: data && JSON.stringify(data), signal: AbortSignal.timeout(5000)
            });
            return { status: response.status, body: response.status === 204 ? null : await response.json() };
        };
        for (const file of ['/', '/app.js', '/styles.css']) {
            assert.equal((await fetch(origin + file)).status, 200);
        }
        assert.deepEqual((await request('/chamados')).body, []);
        assert.equal((await request('/chamados', 'POST', { titulo: ' ', descricao: 'Teste', prioridade: 'Alta' })).status, 400);
        assert.equal((await request('/chamados?status=invalido')).status, 400);
        assert.equal((await request('/chamados?prioridade=invalida')).status, 400);
        const created = await request('/chamados', 'POST', { titulo: ' Teste de integração ', descricao: 'Descrição', prioridade: 'Alta' });
        assert.equal(created.status, 201);
        assert.equal(created.body.status, 'Aberto');
        const id = created.body.id;
        assert.equal((await request(`/chamados/${id}`)).body.titulo, 'Teste de integração');
        assert.equal((await request(`/chamados/${id}`, 'PATCH', { status: 'invalido' })).status, 400);
        for (const status of ['Em andamento', 'Fechado', 'Aberto']) {
            assert.equal((await request(`/chamados/${id}`, 'PATCH', { status })).body.status, status);
        }
        for (const query of ['status=Aberto', 'prioridade=Alta', 'status=Aberto&prioridade=Alta']) {
            assert.deepEqual((await request('/chamados?' + query)).body.map(t => t.id), [id]);
        }
        assert.deepEqual((await request('/chamados?prioridade=Baixa')).body, []);
        for (const mensagem of ['Primeira mensagem', 'Segunda mensagem']) {
            assert.equal((await request(`/chamados/${id}/mensagens`, 'POST', { autor: 'Teste', mensagem })).status, 201);
        }
        const messages = (await request(`/chamados/${id}/mensagens`)).body;
        assert.deepEqual(messages.map(m => m.mensagem), ['Primeira mensagem', 'Segunda mensagem']);
        assert(messages.every((m, i) => !i || m.criado_em >= messages[i-1].criado_em));
        assert.equal((await request(`/chamados/${id}`, 'DELETE')).status, 204);
        assert.equal((await request(`/chamados/${id}`)).status, 404);
        assert.equal((await request(`/chamados/${id}/mensagens`)).status, 404);
        assert.equal((await request(`/chamados/${id}/mensagens`, 'POST', { autor: 'Teste', mensagem: 'Não deve salvar' })).status, 404);
        assert.equal((await request(`/chamados/${id}`, 'DELETE')).status, 404);
        const recreated = await request('/chamados', 'POST', { titulo: 'Outro chamado', descricao: 'Sem histórico anterior', prioridade: 'Baixa' });
        assert.equal(recreated.status, 201);
        assert.equal(recreated.body.id, id, 'Exercita a reutilização do ID pelo SQLite');
        assert.deepEqual((await request(`/chamados/${id}/mensagens`)).body, [], 'Novo chamado não herda mensagens do anterior');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        db?.close();
        process.chdir(previousDirectory);
        const parent = path.resolve(tmpdir()) + path.sep;
        assert(path.resolve(directory).startsWith(parent));
        assert(path.basename(directory).startsWith('helpdesk-integration-'));
        await rm(directory, { recursive: true, force: true });
    }
});
