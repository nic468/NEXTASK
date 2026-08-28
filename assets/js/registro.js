document.addEventListener('DOMContentLoaded', carregarRegistro);

async function carregarRegistro() {
    const container = document.getElementById('registro-conteudo');
    try {
        const resposta = await fetch('api/tasks.php?registros=1').then(r => r.json());
        if (!resposta.sucesso) throw new Error(resposta.erro || 'Não foi possível carregar o registro.');

        if (!resposta.registros.length) {
            container.innerHTML = '<div class="alert alert-light border">Nenhuma tarefa encerrada foi registrada.</div>';
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
              <table class="table table-hover align-middle">
                <thead><tr><th>Tarefa</th><th>Status</th><th>Coluna</th><th>Motivo do cancelamento</th><th>Encerrada em</th></tr></thead>
                <tbody>${resposta.registros.map(registro => `
                  <tr>
                    <td><strong>${escapar(registro.titulo)}</strong>${registro.descricao ? `<div class="small text-muted">${escapar(registro.descricao)}</div>` : ''}</td>
                    <td>${registro.status === 'cancelada'
                        ? '<span class="badge text-bg-warning">Cancelada</span>'
                        : '<span class="badge text-bg-success">Concluída</span>'}</td>
                    <td>${escapar(registro.coluna_nome || '-')}</td>
                    <td>${registro.status === 'cancelada' ? escapar(registro.cancelamento_motivo || '-') : '<span class="text-muted">-</span>'}</td>
                    <td>${formatarData(registro.encerrada_em || registro.concluida_em)}</td>
                  </tr>`).join('')}</tbody>
              </table>
            </div>`;
    } catch (erro) {
        container.innerHTML = `<div class="alert alert-danger">${escapar(erro.message)}</div>`;
    }
}

function escapar(valor) {
    const div = document.createElement('div');
    div.textContent = valor ?? '';
    return div.innerHTML;
}

function formatarData(valor) {
    if (!valor) return '-';
    const data = new Date(valor.replace(' ', 'T'));
    return Number.isNaN(data.getTime()) ? '-' : data.toLocaleString('pt-BR');
}
