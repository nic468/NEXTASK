# Sistema de Gestão de Tarefas — Kanban

Quadro Kanban simples, para uso local/pessoal (sem login), em **PHP 8.2 + PDO + MySQL + Bootstrap 5.3**.

## Funcionalidades

- Colunas customizáveis (crie quantas quiser, com cor própria)
- Cards de tarefa com título, descrição, prioridade (baixa/média/alta) e data de vencimento
- **Checklist (subtarefas)** em cada tarefa, com barra de progresso no card (ex: 3/5)
- **Etiquetas coloridas** reutilizáveis (ex: Urgente, Bloqueado, Aguardando terceiros), criadas na hora
- **Busca e filtros** por título, prioridade e etiqueta
- **Dashboard** com KPIs (total, concluídas, em aberto, vencidas) e gráficos: tarefas por coluna, por prioridade, e concluídas nas últimas 8 semanas
- **Registro de tarefas** com histórico de tarefas concluídas e canceladas
- Cancelamento com **motivo obrigatório**, preservado no registro da tarefa
- Conclusão automática: mover uma tarefa para a última coluna do quadro marca a data de conclusão (usada no dashboard)
- Arrastar e soltar (drag-and-drop) tarefas entre colunas e reordenar dentro da coluna
- Indicador visual de tarefa vencida
- Interface 100% responsiva (Bootstrap 5.3)

## Estrutura do projeto

```
kanban/
├── api/
│   ├── tasks.php        # CRUD de tarefas (inclui progresso de checklist e ids de etiquetas)
│   ├── columns.php      # CRUD de colunas
│   ├── subtasks.php     # CRUD de checklist (subtarefas)
│   └── tags.php         # CRUD de etiquetas + vínculo com tarefas
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── kanban.js     # renderização + drag-and-drop + checklist + etiquetas + filtros
│       └── dashboard.js  # gráficos do dashboard (Chart.js)
├── config/
│   └── database.php      # conexão PDO
├── database.sql                       # script de criação do banco (instalação nova)
├── migration_checklist_etiquetas.sql  # migração para quem já tinha instalado antes
├── index.php              # página principal do quadro
├── dashboard.php           # página de KPIs e gráficos
├── registro.php            # registro de tarefas encerradas
└── README.md
```

## Instalação (XAMPP)

### Instalação nova
1. Copie a pasta `kanban` inteira para `C:\xampp\htdocs\kanban`
2. Abra o **phpMyAdmin** e importe o arquivo `database.sql`
   — isso cria o banco `kanban_tasks`, todas as tabelas (incluindo checklist e etiquetas) e dados de exemplo.
3. Se seu MySQL tiver usuário/senha diferentes do padrão do XAMPP (`root` sem senha),
   ajuste as constantes em `config/database.php`.
4. Inicie o Apache e o MySQL no painel do XAMPP.
5. Acesse: `http://localhost/kanban/`

### Já tinha instalado a versão anterior?
Basta importar o `migration_checklist_etiquetas.sql` no phpMyAdmin (ele só adiciona o que falta,
sem apagar suas tarefas existentes) e substituir os arquivos do projeto pelos desta versão.

## Como usar

- **Nova tarefa**: botão no topo, ou clique em "Adicionar coluna" para criar uma nova etapa do fluxo.
- **Editar tarefa**: clique no card.
- **Checklist**: dentro do card (após salvo), adicione itens e marque conforme for concluindo — o progresso aparece direto no card do quadro.
- **Etiquetas**: dentro do card, clique para ativar/desativar uma etiqueta existente, ou crie uma nova com nome + cor.
- **Buscar/filtrar**: use a barra acima do quadro para filtrar por texto, prioridade ou etiqueta.
- **Mover tarefa**: arraste o card para outra coluna, ou reordene dentro da mesma coluna. Mover para a última coluna marca a tarefa como concluída automaticamente.
- **Dashboard**: clique em "Dashboard" no topo para ver KPIs e gráficos.
- **Registro**: clique em "Registro" para consultar tarefas concluídas ou canceladas e os motivos informados.
- **Cancelar tarefa**: abra uma tarefa salva, clique em "Cancelar tarefa" e informe o motivo obrigatório.
- **Excluir tarefa**: abra o card e clique em "Excluir".
