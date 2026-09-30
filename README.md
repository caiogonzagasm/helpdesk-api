# Help Desk

Central de atendimento com API Express e banco SQLite. A interface usa HTML, CSS e JavaScript, sem etapa de compilação nem dependências adicionais.

## Executar

Use Node.js 24 ou superior (o banco usa `node:sqlite`). No PowerShell:

```powershell
cd C:\Users\Eu\Desktop\estudos\helpdesk-api
npm install
npm start
```

Abra http://localhost:3000. Para desenvolvimento com reinício automático, use `npm run dev`. Encerre com Ctrl+C. Execute os comandos na raiz do projeto, pois o banco `helpdesk.db` é aberto a partir da pasta atual.

## Interface

- Lista, busca local por título/descrição/número e filtros por status e prioridade enviados à API.
- Indicadores de todos os chamados; filtros afetam somente a lista.
- Criação com título, descrição e prioridade; detalhes com descrição completa.
- Alteração imediata de status e exclusão com confirmação.
- Botão Responder, histórico cronológico e envio de mensagens com nome do autor.
- Validações, mensagens de erro, estados de carregamento e layout adaptável a telas menores.

O nome do autor fica salvo apenas no navegador como conveniência. Ele não representa uma conta autenticada. Datas do SQLite são interpretadas como UTC e exibidas no fuso do navegador. Atualize a lista ou reabra os detalhes para buscar alterações feitas em outra janela.

## Organização

`src/index.js` mantém as rotas existentes e serve a pasta `public/` no mesmo endereço. A exclusão agora remove o chamado e suas mensagens na mesma transação, evitando herança de histórico quando um número é reutilizado. `src/database.js` mantém a lógica original do banco. `public/index.html`, `styles.css` e `app.js` contêm a interface. Não há servidor separado para o front-end.

O `.gitignore` deve ser um arquivo de texto na raiz. `node_modules/` e `helpdesk.db` também ficam na raiz, mas não devem entrar em novos commits. Se já foram rastreados antes, o `.gitignore` não remove esses arquivos do histórico.

## Escopo atual

Aplicação para uso local, sem autenticação ou controle de permissões na API atual. Mensagens órfãs de exclusões anteriores a esta correção não são removidas retroativamente.

## Testar

Execute `npm test`. O teste inicia a API em uma porta livre com um banco temporário e verifica arquivos da interface, criação, detalhes, filtros, validações, mudanças de status, respostas, ordem das mensagens, exclusão e reutilização de número sem histórico anterior. O banco real não é usado nem modificado.
