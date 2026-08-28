// ============================================================
// Kanban - lógica de front-end
// ============================================================

const API_TAREFAS   = 'api/tasks.php';
const API_COLUNAS   = 'api/columns.php';
const API_SUBTASKS  = 'api/subtasks.php';
const API_TAGS      = 'api/tags.php';

let colunas = [];
let tarefas = [];
let todasEtiquetas = [];
let etiquetasDaTarefaAtual = []; // ids das etiquetas já vinculadas à tarefa aberta no modal
let tarefaArrastada = null;

const filtros = { busca: '', prioridade: '', etiqueta: '' };

const modalTarefa = new bootstrap.Modal(document.getElementById('modalTarefa'));
const modalColuna = new bootstrap.Modal(document.getElementById('modalColuna'));
const modalCancelamento = new bootstrap.Modal(document.getElementById('modalCancelamento'));

// ------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', carregarQuadro);

document.getElementById('btn-nova-tarefa').addEventListener('click', () => abrirModalTarefa());
document.getElementById('btn-nova-coluna').addEventListener('click', () => abrirModalColuna());

document.getElementById('form-tarefa').addEventListener('submit', salvarTarefa);
document.getElementById('form-coluna').addEventListener('submit', salvarColuna);
document.getElementById('btn-excluir-tarefa').addEventListener('click', excluirTarefa);
document.getElementById('btn-cancelar-tarefa').addEventListener('click', () => {
    document.getElementById('form-cancelamento').reset();
    modalCancelamento.show();
});
document.getElementById('form-cancelamento').addEventListener('submit', cancelarTarefa);

document.getElementById('btn-add-checklist').addEventListener('click', adicionarItemChecklist);
document.getElementById('novo-item-checklist').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); adicionarItemChecklist(); }
});

document.getElementById('btn-add-etiqueta').addEventListener('click', criarEAssociarEtiqueta);
document.getElementById('nova-etiqueta-nome').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); criarEAssociarEtiqueta(); }
});

document.getElementById('filtro-busca').addEventListener('input', e => {
    filtros.busca = e.target.value.toLowerCase();
    renderizarQuadro();
});
document.getElementById('filtro-prioridade').addEventListener('change', e => {
    filtros.prioridade = e.target.value;
    renderizarQuadro();
});
document.getElementById('filtro-etiqueta').addEventListener('change', e => {
    filtros.etiqueta = e.target.value;
    renderizarQuadro();
});
document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
    filtros.busca = ''; filtros.prioridade = ''; filtros.etiqueta = '';
    document.getElementById('filtro-busca').value = '';
    document.getElementById('filtro-prioridade').value = '';
    document.getElementById('filtro-etiqueta').value = '';
    renderizarQuadro();
});

document.getElementById('tarefa-recorrente').addEventListener('change', atualizarEstadoRecorrencia);
document.getElementById('tarefa-frequencia').addEventListener('change', atualizarEstadoRecorrencia);

// ------------------------------------------------------------
// Carregamento de dados
// ------------------------------------------------------------
async function carregarQuadro() {
    try {
        const [respColunas, respTarefas, respEtiquetas] = await Promise.all([
            fetch(API_COLUNAS).then(r => r.json()),
            fetch(API_TAREFAS).then(r => r.json()),
            fetch(API_TAGS).then(r => r.json()),
        ]);

        if (!respColunas.sucesso || !respTarefas.sucesso) {
            throw new Error('Falha ao carregar dados do servidor.');
        }

        colunas = respColunas.colunas;
        tarefas = respTarefas.tarefas.filter(t => t.status !== 'cancelada');
        todasEtiquetas = respEtiquetas.sucesso ? respEtiquetas.etiquetas : [];

        renderizarQuadro();
        preencherSelectColunas();
        preencherFiltroEtiquetas();
    } catch (erro) {
        document.getElementById('board').innerHTML = `
            <div class="alert alert-danger w-100">
                Não foi possível carregar o quadro. Verifique se o banco de dados
                <code>kanban_tasks</code> foi criado/migrado (arquivos <code>database.sql</code> /
                <code>migration_checklist_etiquetas.sql</code>) e se o MySQL está rodando.<br>
                <small>${erro.message}</small>
            </div>`;
    }
}

function preencherFiltroEtiquetas() {
    const select = document.getElementById('filtro-etiqueta');
    const atual = select.value;
    select.innerHTML = '<option value="">Todas as etiquetas</option>' +
        todasEtiquetas.map(e => `<option value="${e.id}">${escapeHtml(e.nome)}</option>`).join('');
    select.value = atual;
}

// ------------------------------------------------------------
// Renderização do quadro
// ------------------------------------------------------------
function tarefaPassaNosFiltros(tarefa) {
    if (filtros.busca && !tarefa.titulo.toLowerCase().includes(filtros.busca)) return false;
    if (filtros.prioridade && tarefa.prioridade !== filtros.prioridade) return false;
    if (filtros.etiqueta) {
        const ids = (tarefa.etiquetas_ids || '').split(',').filter(Boolean);
        if (!ids.includes(String(filtros.etiqueta))) return false;
    }
    return true;
}

function renderizarQuadro() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    const temFiltrosAtivos = Boolean(filtros.busca || filtros.prioridade || filtros.etiqueta);

    if (!colunas.length) {
        board.innerHTML = `
            <div class="empty-board-state">
                <div>
                    <h5 class="fw-semibold">Comece criando seu primeiro quadro</h5>
                    <p class="text-muted mb-3">Adicione uma coluna para organizar suas atividades.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('btn-nova-coluna').click()">
                        <i class="bi bi-plus-lg me-1"></i> Criar coluna
                    </button>
                </div>
            </div>`;
        return;
    }

    if (temFiltrosAtivos && tarefas.filter(tarefaPassaNosFiltros).length === 0) {
        board.innerHTML = `
            <div class="empty-board-state">
                <div>
                    <h5 class="fw-semibold">Nenhuma tarefa encontrada</h5>
                    <p class="text-muted mb-3">Ajuste os filtros ou limpe a busca para ver mais atividades.</p>
                    <button class="btn btn-outline-primary" onclick="document.getElementById('btn-limpar-filtros').click()">
                        <i class="bi bi-funnel me-1"></i> Limpar filtros
                    </button>
                </div>
            </div>`;
        return;
    }

    colunas.forEach(coluna => {
        const tarefasColuna = tarefas
            .filter(t => Number(t.coluna_id) === Number(coluna.id))
            .filter(tarefaPassaNosFiltros)
            .sort((a, b) => a.ordem - b.ordem);

        const totalNaColuna = tarefas.filter(t => Number(t.coluna_id) === Number(coluna.id)).length;

        const colunaEl = document.createElement('div');
        colunaEl.className = 'coluna';
        colunaEl.dataset.colunaId = coluna.id;

        colunaEl.innerHTML = `
            <div class="coluna-header" style="background:${coluna.cor}">
                <span>${escapeHtml(coluna.nome)}</span>
                <div class="d-flex align-items-center gap-2">
                    <button type="button" class="btn btn-sm btn-light btn-editar-coluna" title="Editar coluna">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-light btn-excluir-coluna" title="Excluir coluna">
                        <i class="bi bi-trash"></i>
                    </button>
                    <span class="badge-contagem">${tarefasColuna.length}${tarefasColuna.length !== totalNaColuna ? ` / ${totalNaColuna}` : ''}</span>
                </div>
            </div>
            <div class="coluna-body" data-coluna-id="${coluna.id}"></div>
        `;

        const body = colunaEl.querySelector('.coluna-body');
        const btnEditar = colunaEl.querySelector('.btn-editar-coluna');
        const btnExcluir = colunaEl.querySelector('.btn-excluir-coluna');
        btnEditar?.addEventListener('click', e => {
            e.stopPropagation();
            abrirModalColuna(coluna);
        });
        btnExcluir?.addEventListener('click', e => {
            e.stopPropagation();
            excluirColuna(coluna.id);
        });

        if (tarefasColuna.length === 0) {
            body.innerHTML = '<div class="empty-column-state">Nenhuma tarefa aqui.</div>';
        } else {
            tarefasColuna.forEach(tarefa => body.appendChild(criarCardTarefa(tarefa)));
        }

        configurarDropZone(body);
        board.appendChild(colunaEl);
    });

    const addColBtn = document.createElement('div');
    addColBtn.className = 'btn-add-coluna d-flex align-items-start pt-2';
    addColBtn.innerHTML = `
        <button class="btn btn-outline-secondary w-100" onclick="document.getElementById('btn-nova-coluna').click()">
            <i class="bi bi-plus-lg"></i> Adicionar coluna
        </button>`;
    board.appendChild(addColBtn);
}

function criarCardTarefa(tarefa) {
    const card = document.createElement('div');
    card.className = `card-tarefa prioridade-${tarefa.prioridade}`;
    card.draggable = true;
    card.dataset.tarefaId = tarefa.id;

    const vencido = tarefa.data_vencimento && !tarefa.concluida_em &&
        new Date(tarefa.data_vencimento) < new Date(new Date().toDateString());
    const dataFormatada = tarefa.data_vencimento ? formatarData(tarefa.data_vencimento) : '';

    const idsEtiquetas = (tarefa.etiquetas_ids || '').split(',').filter(Boolean).map(Number);
    const etiquetasTarefa = todasEtiquetas.filter(e => idsEtiquetas.includes(e.id));
    const tagsHtml = etiquetasTarefa.map(e =>
        `<span class="badge rounded-pill" style="background:${e.cor}">${escapeHtml(e.nome)}</span>`
    ).join(' ');

    const totalSub = Number(tarefa.total_subtarefas || 0);
    const feitasSub = Number(tarefa.subtarefas_concluidas || 0);
    const progressoHtml = totalSub > 0 ? `
        <div class="checklist-mini mt-2">
            <div class="progress" style="height:5px;">
                <div class="progress-bar bg-success" style="width:${Math.round((feitasSub / totalSub) * 100)}%"></div>
            </div>
            <small class="text-muted"><i class="bi bi-check2-square"></i> ${feitasSub}/${totalSub}</small>
        </div>` : '';

    const recorrenteHtml = tarefa.recorrente ? '<span class="badge text-bg-info"><i class="bi bi-arrow-repeat"></i> Recorrente</span>' : '';

    const headerHtml = `
        <div class="d-flex justify-content-between align-items-start mb-2 gap-2">
            ${tagsHtml ? `<div class="d-flex flex-wrap gap-1 flex-grow-1">${tagsHtml}</div>` : '<div class="flex-grow-1"></div>'}
            <button type="button" class="btn btn-link btn-sm p-0 text-secondary btn-editar-tarefa" title="Editar tarefa">
                <i class="bi bi-pencil-square"></i>
            </button>
        </div>`;

    card.innerHTML = `
        ${headerHtml}
        <div class="titulo">${escapeHtml(tarefa.titulo)}</div>
        ${tarefa.descricao ? `<div class="descricao">${escapeHtml(truncar(tarefa.descricao, 90))}</div>` : ''}
        <div class="rodape">
            <span class="badge text-bg-light border">${rotuloPrioridade(tarefa.prioridade)}</span>
            ${recorrenteHtml}
            ${dataFormatada ? `<span class="vencimento ${vencido ? 'vencido' : ''}"><i class="bi bi-calendar-event"></i> ${dataFormatada}</span>` : '<span></span>'}
        </div>
        ${progressoHtml}
    `;

    card.querySelector('.btn-editar-tarefa').addEventListener('click', e => {
        e.stopPropagation();
        abrirModalTarefa(tarefa);
    });

    card.addEventListener('click', () => abrirModalTarefa(tarefa));

    card.addEventListener('dragstart', () => {
        tarefaArrastada = tarefa;
        card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    return card;
}

function configurarDropZone(body) {
    body.addEventListener('dragover', e => {
        e.preventDefault();
        body.classList.add('drag-over');

        const afterElement = elementoAposPosicao(body, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (!dragging) return;

        if (afterElement == null) {
            body.appendChild(dragging);
        } else {
            body.insertBefore(dragging, afterElement);
        }
    });

    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));

    body.addEventListener('drop', async e => {
        e.preventDefault();
        body.classList.remove('drag-over');
        if (!tarefaArrastada) return;

        const novaColunaId = Number(body.dataset.colunaId);
        const idsNaOrdem = [...body.querySelectorAll('.card-tarefa')].map(c => Number(c.dataset.tarefaId));
        const novaOrdem = idsNaOrdem.indexOf(tarefaArrastada.id) + 1;

        await moverTarefa(tarefaArrastada.id, novaColunaId, novaOrdem);
        tarefaArrastada = null;
        await carregarQuadro();
    });
}

function elementoAposPosicao(container, y) {
    const els = [...container.querySelectorAll('.card-tarefa:not(.dragging)')];
    return els.reduce((maisProximo, el) => {
        const box = el.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > maisProximo.offset) {
            return { offset, element: el };
        }
        return maisProximo;
    }, { offset: -Infinity, element: null }).element;
}

// ------------------------------------------------------------
// Ações: Tarefas
// ------------------------------------------------------------
async function abrirModalTarefa(tarefa = null) {
    const form = document.getElementById('form-tarefa');
    form.reset();

    document.getElementById('tarefa-id').value = tarefa?.id ?? '';
    document.getElementById('tarefa-titulo').value = tarefa?.titulo ?? '';
    document.getElementById('tarefa-descricao').value = tarefa?.descricao ?? '';
    document.getElementById('tarefa-prioridade').value = tarefa?.prioridade ?? 'media';
    document.getElementById('tarefa-vencimento').value = tarefa?.data_vencimento ?? '';
    document.getElementById('tarefa-coluna').value = tarefa?.coluna_id ?? (colunas[0]?.id ?? '');
    document.getElementById('tarefa-recorrente').checked = Boolean(tarefa?.recorrente);
    document.getElementById('tarefa-frequencia').value = tarefa?.frequencia ?? 'nenhuma';
    document.getElementById('tarefa-historico').innerHTML = '<small class="text-muted">Carregando histórico...</small>';
    atualizarEstadoRecorrencia();

    document.getElementById('modalTarefaTitulo').textContent = tarefa ? 'Editar Tarefa' : 'Nova Tarefa';
    document.getElementById('btn-excluir-tarefa').classList.toggle('d-none', !tarefa);
    document.getElementById('btn-cancelar-tarefa').classList.toggle('d-none', !tarefa || tarefa.status === 'cancelada' || tarefa.concluida_em);

    const checklistWrapper = document.getElementById('checklist-add-wrapper');
    const checklistAviso = document.getElementById('checklist-aviso-salvar');
    checklistWrapper.classList.toggle('d-none', !tarefa);
    checklistAviso.classList.toggle('d-none', !!tarefa);
    document.getElementById('checklist-itens').innerHTML = '';
    document.getElementById('checklist-progresso-texto').textContent = '';
    document.getElementById('checklist-progresso-barra').style.width = '0%';

    document.getElementById('tarefa-etiquetas-lista').innerHTML = '';
    etiquetasDaTarefaAtual = [];

    modalTarefa.show();

    if (tarefa) {
        await Promise.all([carregarChecklist(tarefa.id), carregarEtiquetasDaTarefa(tarefa.id), carregarHistoricoTarefa(tarefa.id)]);
    }
}

function atualizarEstadoRecorrencia() {
    const recorrente = document.getElementById('tarefa-recorrente').checked;
    document.getElementById('tarefa-frequencia').disabled = !recorrente;
}

function preencherSelectColunas() {
    const select = document.getElementById('tarefa-coluna');
    select.innerHTML = colunas.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');
}

async function salvarTarefa(e) {
    e.preventDefault();

    const id = document.getElementById('tarefa-id').value;
    const recorrente = document.getElementById('tarefa-recorrente').checked;
    const payload = {
        titulo: document.getElementById('tarefa-titulo').value.trim(),
        descricao: document.getElementById('tarefa-descricao').value.trim(),
        prioridade: document.getElementById('tarefa-prioridade').value,
        data_vencimento: document.getElementById('tarefa-vencimento').value || null,
        coluna_id: Number(document.getElementById('tarefa-coluna').value),
        recorrente,
        frequencia: recorrente ? document.getElementById('tarefa-frequencia').value : 'nenhuma',
    };

    try {
        let resp;
        if (id) {
            payload.id = Number(id);
            resp = await fetch(API_TAREFAS, { method: 'PUT', body: JSON.stringify(payload) });
            const data = await resp.json();
            if (!data.sucesso) throw new Error(data.erro || 'Erro ao salvar tarefa.');

            await moverTarefa(Number(id), payload.coluna_id, 999);
            modalTarefa.hide();
            mostrarToast('Tarefa atualizada!', 'success');
            await carregarQuadro();
        } else {
            resp = await fetch(API_TAREFAS, { method: 'POST', body: JSON.stringify(payload) });
            const data = await resp.json();
            if (!data.sucesso) throw new Error(data.erro || 'Erro ao salvar tarefa.');

            await moverTarefa(data.id, payload.coluna_id, 999);
            modalTarefa.hide();
            mostrarToast('Tarefa criada!', 'success');
            await carregarQuadro();
        }
    } catch (erro) {
        mostrarToast(erro.message, 'danger');
    }
}

async function excluirTarefa() {
    const id = document.getElementById('tarefa-id').value;
    if (!id) return;
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    try {
        const resp = await fetch(`${API_TAREFAS}?id=${id}`, { method: 'DELETE' });
        const data = await resp.json();
        if (!data.sucesso) throw new Error(data.erro || 'Erro ao excluir.');

        modalTarefa.hide();
        mostrarToast('Tarefa excluída.', 'success');
        await carregarQuadro();
    } catch (erro) {
        mostrarToast(erro.message, 'danger');
    }
}

async function cancelarTarefa(e) {
    e.preventDefault();
    const id = document.getElementById('tarefa-id').value;
    const motivo = document.getElementById('motivo-cancelamento').value.trim();
    if (!id || !motivo) return;

    try {
        const resp = await fetch(API_TAREFAS, {
            method: 'PUT',
            body: JSON.stringify({ id: Number(id), acao: 'cancelar', motivo_cancelamento: motivo }),
        });
        const data = await resp.json();
        if (!data.sucesso) throw new Error(data.erro || 'Erro ao cancelar tarefa.');

        modalCancelamento.hide();
        modalTarefa.hide();
        mostrarToast('Tarefa cancelada e registrada.', 'success');
        await carregarQuadro();
    } catch (erro) {
        mostrarToast(erro.message, 'danger');
    }
}

async function moverTarefa(id, colunaId, ordem) {
    const resp = await fetch(API_TAREFAS, {
        method: 'PUT',
        body: JSON.stringify({ id, mover: true, coluna_id: colunaId, ordem }),
    });
    const data = await resp.json();
    if (!data.sucesso) throw new Error(data.erro || 'Erro ao mover tarefa.');
}

// ------------------------------------------------------------
// Ações: Checklist (subtarefas)
// ------------------------------------------------------------
async function carregarChecklist(tarefaId) {
    const resp = await fetch(`${API_SUBTASKS}?tarefa_id=${tarefaId}`).then(r => r.json());
    if (!resp.sucesso) return;
    renderizarChecklist(resp.subtarefas);
}

async function carregarHistoricoTarefa(tarefaId) {
    const resp = await fetch(`${API_TAREFAS}?historico_tarefa_id=${tarefaId}`).then(r => r.json());
    if (!resp.sucesso) return;
    renderizarHistorico(resp.historico || []);
}

function renderizarHistorico(itens) {
    const container = document.getElementById('tarefa-historico');
    if (!itens.length) {
        container.innerHTML = '<small class="text-muted">Ainda não há registros para esta tarefa.</small>';
        return;
    }

    container.innerHTML = itens.map(item => {
        const data = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
        return `<div class="border-start border-2 ps-2 mb-2"><div class="fw-semibold">${escapeHtml(item.tipo)}</div><div>${escapeHtml(item.mensagem)}</div><small class="text-muted">${escapeHtml(data)}</small></div>`;
    }).join('');
}

function renderizarChecklist(itens) {
    const lista = document.getElementById('checklist-itens');
    lista.innerHTML = '';

    itens.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex align-items-center gap-2 py-1';
        li.innerHTML = `
            <input type="checkbox" class="form-check-input mt-0" ${item.concluida == 1 ? 'checked' : ''}>
            <span class="flex-grow-1 ${item.concluida == 1 ? 'text-decoration-line-through text-muted' : ''}">${escapeHtml(item.titulo)}</span>
            <button type="button" class="btn btn-sm btn-link text-danger p-0"><i class="bi bi-x-lg"></i></button>
        `;

        li.querySelector('input').addEventListener('change', async e => {
            await fetch(API_SUBTASKS, {
                method: 'PUT',
                body: JSON.stringify({ id: item.id, concluida: e.target.checked }),
            });
            await carregarChecklist(item.tarefa_id);
            await atualizarTarefasEmMemoria();
        });

        li.querySelector('button').addEventListener('click', async () => {
            await fetch(`${API_SUBTASKS}?id=${item.id}`, { method: 'DELETE' });
            await carregarChecklist(item.tarefa_id);
            await atualizarTarefasEmMemoria();
        });

        lista.appendChild(li);
    });

    const total = itens.length;
    const feitas = itens.filter(i => i.concluida == 1).length;
    const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;

    document.getElementById('checklist-progresso-texto').textContent = total > 0 ? `${feitas}/${total}` : '';
    document.getElementById('checklist-progresso-barra').style.width = `${pct}%`;
}

async function adicionarItemChecklist() {
    const tarefaId = document.getElementById('tarefa-id').value;
    const input = document.getElementById('novo-item-checklist');
    const titulo = input.value.trim();

    if (!tarefaId) {
        mostrarToast('Salve a tarefa antes de adicionar itens ao checklist.', 'warning');
        return;
    }
    if (!titulo) return;

    await fetch(API_SUBTASKS, {
        method: 'POST',
        body: JSON.stringify({ tarefa_id: Number(tarefaId), titulo }),
    });

    input.value = '';
    await carregarChecklist(tarefaId);
    await atualizarTarefasEmMemoria();
}

// ------------------------------------------------------------
// Ações: Etiquetas
// ------------------------------------------------------------
async function carregarEtiquetasDaTarefa(tarefaId) {
    const resp = await fetch(`${API_TAGS}?tarefa_id=${tarefaId}`).then(r => r.json());
    if (!resp.sucesso) return;
    etiquetasDaTarefaAtual = resp.etiquetas.map(e => e.id);
    renderizarEtiquetasNoModal();
}

function renderizarEtiquetasNoModal() {
    const container = document.getElementById('tarefa-etiquetas-lista');
    const tarefaId = document.getElementById('tarefa-id').value;

    if (todasEtiquetas.length === 0) {
        container.innerHTML = '<small class="text-muted">Nenhuma etiqueta cadastrada ainda.</small>';
        return;
    }

    container.innerHTML = todasEtiquetas.map(e => {
        const ativa = etiquetasDaTarefaAtual.includes(e.id);
        return `
            <button type="button"
                class="badge rounded-pill border-0 etiqueta-toggle"
                data-id="${e.id}"
                style="background:${ativa ? e.cor : '#e9ecef'}; color:${ativa ? '#fff' : '#495057'}; cursor:pointer;">
                ${ativa ? '<i class="bi bi-check-lg"></i> ' : ''}${escapeHtml(e.nome)}
            </button>`;
    }).join('');

    container.querySelectorAll('.etiqueta-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!tarefaId) {
                mostrarToast('Salve a tarefa antes de aplicar etiquetas.', 'warning');
                return;
            }
            const etiquetaId = Number(btn.dataset.id);
            const jaAtiva = etiquetasDaTarefaAtual.includes(etiquetaId);

            await fetch(API_TAGS, {
                method: 'POST',
                body: JSON.stringify({ tarefa_id: Number(tarefaId), etiqueta_id: etiquetaId, associar: !jaAtiva }),
            });

            await carregarEtiquetasDaTarefa(tarefaId);
            await atualizarTarefasEmMemoria();
        });
    });
}

async function criarEAssociarEtiqueta() {
    const nomeInput = document.getElementById('nova-etiqueta-nome');
    const corInput = document.getElementById('nova-etiqueta-cor');
    const nome = nomeInput.value.trim();
    const tarefaId = document.getElementById('tarefa-id').value;

    if (!nome) return;

    try {
        const resp = await fetch(API_TAGS, {
            method: 'POST',
            body: JSON.stringify({ nome, cor: corInput.value }),
        }).then(r => r.json());

        if (!resp.sucesso) throw new Error(resp.erro || 'Erro ao criar etiqueta.');

        nomeInput.value = '';

        const listaAtualizada = await fetch(API_TAGS).then(r => r.json());
        if (listaAtualizada.sucesso) {
            todasEtiquetas = listaAtualizada.etiquetas;
            preencherFiltroEtiquetas();
        }

        if (tarefaId) {
            await fetch(API_TAGS, {
                method: 'POST',
                body: JSON.stringify({ tarefa_id: Number(tarefaId), etiqueta_id: resp.id, associar: true }),
            });
            await carregarEtiquetasDaTarefa(tarefaId);
            await atualizarTarefasEmMemoria();
        } else {
            renderizarEtiquetasNoModal();
        }
    } catch (erro) {
        mostrarToast(erro.message, 'danger');
    }
}

// Recarrega apenas a lista de tarefas (sem fechar o modal), para refletir
// progresso de checklist / etiquetas nos cards em tempo real.
async function atualizarTarefasEmMemoria() {
    const resp = await fetch(API_TAREFAS).then(r => r.json());
    if (resp.sucesso) {
        tarefas = resp.tarefas.filter(t => t.status !== 'cancelada');
        renderizarQuadro();
    }
}

// ------------------------------------------------------------
// Ações: Colunas
// ------------------------------------------------------------
function abrirModalColuna(coluna = null) {
    const form = document.getElementById('form-coluna');
    form.reset();

    document.getElementById('coluna-id').value = coluna?.id ?? '';
    document.getElementById('coluna-nome').value = coluna?.nome ?? '';
    document.getElementById('coluna-cor').value = coluna?.cor ?? '#6c757d';
    document.getElementById('modalColunaTitulo').textContent = coluna ? 'Editar Coluna' : 'Nova Coluna';
    document.getElementById('btn-salvar-coluna').textContent = coluna ? 'Salvar' : 'Criar';

    modalColuna.show();
}

async function salvarColuna(e) {
    e.preventDefault();

    const id = document.getElementById('coluna-id').value;
    const payload = {
        nome: document.getElementById('coluna-nome').value.trim(),
        cor: document.getElementById('coluna-cor').value,
    };

    try {
        const method = id ? 'PUT' : 'POST';
        if (id) payload.id = Number(id);

        const resp = await fetch(API_COLUNAS, { method, body: JSON.stringify(payload) });
        const data = await resp.json();
        if (!data.sucesso) throw new Error(data.erro || 'Erro ao salvar coluna.');

        modalColuna.hide();
        mostrarToast(id ? 'Coluna atualizada!' : 'Coluna criada!', 'success');
        await carregarQuadro();
    } catch (erro) {
        mostrarToast(erro.message, 'danger');
    }
}

async function excluirColuna(colunaId) {
    const coluna = colunas.find(c => Number(c.id) === Number(colunaId));
    if (!coluna) return;
    if (!confirm(`Tem certeza que deseja excluir a coluna "${coluna.nome}"? As tarefas dela serão removidas.`)) return;

    try {
        const resp = await fetch(`${API_COLUNAS}?id=${colunaId}`, { method: 'DELETE' });
        const data = await resp.json();
        if (!data.sucesso) throw new Error(data.erro || 'Erro ao excluir coluna.');

        mostrarToast('Coluna excluída.', 'success');
        await carregarQuadro();
    } catch (erro) {
        mostrarToast(erro.message, 'danger');
    }
}

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------
function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

function truncar(texto, max) {
    return texto.length > max ? texto.slice(0, max) + '…' : texto;
}

function formatarData(dataIso) {
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function rotuloPrioridade(p) {
    return { baixa: 'Baixa', media: 'Média', alta: 'Alta' }[p] ?? p;
}

function mostrarToast(mensagem, tipo = 'success') {
    const toastEl = document.getElementById('toast');
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toastEl.className = `toast align-items-center text-white border-0 bg-${tipo}`;
    document.getElementById('toast-msg').textContent = mensagem;
    toast.show();
}
