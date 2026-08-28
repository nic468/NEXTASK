<?php
/**
 * API de Colunas - api/columns.php
 * Métodos: GET (listar), POST (criar), PUT (renomear/cor), DELETE (remover)
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

try {
    switch ($metodo) {

        case 'GET':
            $stmt = $pdo->query('SELECT * FROM colunas ORDER BY ordem ASC, id ASC');
            responder(true, ['colunas' => $stmt->fetchAll()]);
            break;

        case 'POST':
            $dados = corpoRequisicao();
            $nome = trim($dados['nome'] ?? '');
            $cor  = trim($dados['cor'] ?? '#6c757d');

            if ($nome === '') {
                responder(false, ['erro' => 'Nome da coluna é obrigatório.'], 422);
            }

            $stmtOrdem = $pdo->query('SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima FROM colunas');
            $proximaOrdem = (int)$stmtOrdem->fetch()['proxima'];

            $stmt = $pdo->prepare('INSERT INTO colunas (nome, cor, ordem) VALUES (:nome, :cor, :ordem)');
            $stmt->execute([':nome' => $nome, ':cor' => $cor, ':ordem' => $proximaOrdem]);

            responder(true, ['id' => (int)$pdo->lastInsertId()], 201);
            break;

        case 'PUT':
            $dados = corpoRequisicao();
            $id   = (int)($dados['id'] ?? 0);
            $nome = trim($dados['nome'] ?? '');
            $cor  = trim($dados['cor'] ?? '#6c757d');

            if ($id <= 0 || $nome === '') {
                responder(false, ['erro' => 'Dados inválidos.'], 422);
            }

            $stmt = $pdo->prepare('UPDATE colunas SET nome = :nome, cor = :cor WHERE id = :id');
            $stmt->execute([':nome' => $nome, ':cor' => $cor, ':id' => $id]);

            responder(true);
            break;

        case 'DELETE':
            parse_str(file_get_contents('php://input'), $dados);
            $id = (int)($_GET['id'] ?? $dados['id'] ?? 0);

            if ($id <= 0) {
                responder(false, ['erro' => 'ID da coluna inválido.'], 422);
            }

            // Impede excluir a última coluna restante
            $total = (int)$pdo->query('SELECT COUNT(*) AS total FROM colunas')->fetch()['total'];
            if ($total <= 1) {
                responder(false, ['erro' => 'É necessário manter ao menos uma coluna.'], 422);
            }

            $stmtTarefas = $pdo->prepare('SELECT id FROM tarefas WHERE coluna_id = ?');
            $stmtTarefas->execute([$id]);
            $tarefasDaColuna = $stmtTarefas->fetchAll(PDO::FETCH_COLUMN);

            foreach ($tarefasDaColuna as $tarefaId) {
                $stmtHistorico = $pdo->prepare('INSERT INTO tarefas_historico (tarefa_id, tipo, mensagem) VALUES (?, ?, ?)');
                $stmtHistorico->execute([$tarefaId, 'coluna_removida', 'A tarefa foi removida junto com a coluna.']);
            }

            $stmt = $pdo->prepare('DELETE FROM colunas WHERE id = ?');
            $stmt->execute([$id]);

            responder(true);
            break;

        default:
            responder(false, ['erro' => 'Método não suportado.'], 405);
    }
} catch (Throwable $e) {
    responder(false, ['erro' => 'Erro interno: ' . $e->getMessage()], 500);
}
