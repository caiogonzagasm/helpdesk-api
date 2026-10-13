# Help Desk

Sistema de gerenciamento de chamados desenvolvido com Node.js, Express e SQLite.

Permite criar, consultar, filtrar, atualizar e excluir chamados, além de manter
um histórico de mensagens dentro de cada atendimento.

## Preview

<img src="docs/images/image.png" width="900" alt="Tela principal">

### Detalhes do chamado

<img src="docs/images/image2.png" width="900" alt="Detalhes do chamado">

### Conversa

<img src="docs/images/image3.png" width="900" alt="Sistema de mensagens">

### Help Desk API

### Tecnologias:
- Node.js
- Express
- SQLite
- JWT
- bcryptjs

### Funcionalidades:
- Cadastro e login
- Autenticação JWT
- Roles user/admin
- CRUD de chamados
- Filtros por status e prioridade
- Controle de acesso por usuário
- Mensagens nos chamados
- Autorização de administrador

## API

### Chamados

GET /chamados

GET /chamados/:id

POST /chamados

PATCH /chamados/:id

DELETE /chamados/:id

### Mensagens

GET /chamados/:id/mensagens

POST /chamados/:id/mensagens

## Executar o projeto

Requer Node.js 24 ou superior.

```bash
git clone LINK_DO_SEU_REPOSITORIO
cd helpdesk-api
npm install
npm start
