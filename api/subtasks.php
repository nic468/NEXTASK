<?php
/**
 * API de Subtarefas (Checklist) - api/subtasks.php
 * Métodos: GET (listar por tarefa_id), POST (criar), PUT (marcar concluída / renomear), DELETE (remover)
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config/database.php';

$pdo    = getConnection();
$metodo = $_SERVER['REQUEST_METHOD'];

function responder(bool $sucesso, array $dados = [], int $status = 200): void
{
    http_response_code($status);
    echo json_encode(array_merge(['sucesso' => $sucesso], $dados), JSON_UNESCAPED_UNICODE);
    exit;
}

function corpoRequisicao(): array
{
    $input = json_decode(file_get_contents('php://input'), true);
    return is_array($input) ? $input : [];
}

/**
 * Atualiza automaticamente a data de conclusão da tarefa-pai quando
 * todas as subtarefas ficam concluídas (e limpa se alguma reabrir).
 */
function atualizarConclusaoTarefa(PDO $pdo, int $tarefaId): void
{
    $stmt = $pdo->prepare('SELECT COUNT(*) AS total, SUM(concluida) AS feitas FROM subtarefas WHERE tarefa_id = ?');
    $stmt->execute([$tarefaId]);
    $r = $stmt->fetch();

    if ((int)$r['total'] > 0 && (int)$r['total'] === (int)$r['feitas']) {
        $pdo->prepare('UPDATE tarefas SET concluida_em = COALESCE(concluida_em, NOW()) WHERE id = ?')->execute([$tarefaId]);
    } else {
        $pdo->prepare('UPDATE tarefas SET concluida_em = NULL WHERE id = ?')->execute([$tarefaId]);
    }
}

try {
    switch ($metodo) {

        // ---------------------------------------------------------
        // LISTAR SUBTAREFAS (todas, ou filtradas por tarefa_id)
        // ---------------------------------------------------------
        case 'GET':
            if (isset($_GET['tarefa_id'])) {
                $stmt = $pdo->prepare('SELECT * FROM subtarefas WHERE tarefa_id = ? ORDER BY ordem ASC, id ASC');
                $stmt->execute([(int)$_GET['tarefa_id']]);
            } else {
                $stmt = $pdo->query('SELECT * FROM subtarefas ORDER BY tarefa_id, ordem ASC, id ASC');
            }
            responder(true, ['subtarefas' => $stmt->fetchAll()]);
            break;

        // ---------------------------------------------------------
        // CRIAR SUBTAREFA
        // ---------------------------------------------------------
        case 'POST':
            $dados    = corpoRequisicao();
            $tarefaId = (int)($dados['tarefa_id'] ?? 0);
            $titulo   = trim($dados['titulo'] ?? '');

            if ($tarefaId <= 0 || $titulo === '') {
                responder(false, ['erro' => 'Tarefa e título são obrigatórios.'], 422);
            }

            $stmtOrdem = $pdo->prepare('SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima FROM subtarefas WHERE tarefa_id = ?');
            $stmtOrdem->execute([$tarefaId]);
            $proximaOrdem = (int)$stmtOrdem->fetch()['proxima'];

            $stmt = $pdo->prepare(
                'INSERT INTO subtarefas (tarefa_id, titulo, ordem) VALUES (:tarefa_id, :titulo, :ordem)'
            );
            $stmt->execute([':tarefa_id' => $tarefaId, ':titulo' => $titulo, ':ordem' => $proximaOrdem]);

            atualizarConclusaoTarefa($pdo, $tarefaId);
            responder(true, ['id' => (int)$pdo->lastInsertId()], 201);
            break;

        // ---------------------------------------------------------
        // ATUALIZAR SUBTAREFA (marcar concluída / renomear)
        // ---------------------------------------------------------
        case 'PUT':
            $dados = corpoRequisicao();
            $id = (int)($dados['id'] ?? 0);

            if ($id <= 0) {
                responder(false, ['erro' => 'ID inválido.'], 422);
            }

            $stmtAtual = $pdo->prepare('SELECT tarefa_id FROM subtarefas WHERE id = ?');
            $stmtAtual->execute([$id]);
            $atual = $stmtAtual->fetch();
            if (!$atual) {
                responder(false, ['erro' => 'Subtarefa não encontrada.'], 404);
            }

            $campos = [];
            $params = [':id' => $id];

            if (array_key_exists('concluida', $dados)) {
                $campos[] = 'concluida = :concluida';
                $params[':concluida'] = (int)(bool)$dados['concluida'];
            }
            if (array_key_exists('titulo', $dados)) {
                $tituloNovo = trim((string)$dados['titulo']);
                if ($tituloNovo === '') {
                    responder(false, ['erro' => 'Título não pode ser vazio.'], 422);
                }
                $campos[] = 'titulo = :titulo';
                $params[':titulo'] = $tituloNovo;
            }

            if (empty($campos)) {
                responder(false, ['erro' => 'Nada para atualizar.'], 422);
            }

            $sql = 'UPDATE subtarefas SET ' . implode(', ', $campos) . ' WHERE id = :id';
            $pdo->prepare($sql)->execute($params);

            atualizarConclusaoTarefa($pdo, (int)$atual['tarefa_id']);
            responder(true);
            break;

        // ---------------------------------------------------------
        // EXCLUIR SUBTAREFA
        // ---------------------------------------------------------
        case 'DELETE':
            parse_str(file_get_contents('php://input'), $dados);
            $id = (int)($_GET['id'] ?? $dados['id'] ?? 0);

            if ($id <= 0) {
                responder(false, ['erro' => 'ID inválido.'], 422);
            }

            $stmtAtual = $pdo->prepare('SELECT tarefa_id FROM subtarefas WHERE id = ?');
            $stmtAtual->execute([$id]);
            $atual = $stmtAtual->fetch();

            $pdo->prepare('DELETE FROM subtarefas WHERE id = ?')->execute([$id]);

            if ($atual) {
                atualizarConclusaoTarefa($pdo, (int)$atual['tarefa_id']);
            }

            responder(true);
            break;

        default:
            responder(false, ['erro' => 'Método não suportado.'], 405);
    }
} catch (Throwable $e) {
    responder(false, ['erro' => 'Erro interno: ' . $e->getMessage()], 500);
}
