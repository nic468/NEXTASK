<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Registro de Tarefas - Kanban</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
<link href="assets/css/style.css" rel="stylesheet">
</head>
<body>
<nav class="navbar navbar-dark bg-dark mb-4">
  <div class="container-fluid">
    <span class="navbar-brand mb-0 h1"><i class="bi bi-journal-text me-2"></i>Registro de Tarefas</span>
    <div class="d-flex gap-2">
      <a href="dashboard.php" class="btn btn-outline-light btn-sm"><i class="bi bi-bar-chart-fill"></i> Dashboard</a>
      <a href="index.php" class="btn btn-outline-light btn-sm"><i class="bi bi-kanban-fill"></i> Voltar ao quadro</a>
    </div>
  </div>
</nav>
<main class="container-fluid px-4 pb-5">
  <div class="card shadow-sm">
    <div class="card-body">
      <h5 class="card-title">Tarefas encerradas</h5>
      <p class="text-muted">Histórico de tarefas concluídas e canceladas.</p>
      <div id="registro-conteudo">
        <div class="text-center text-muted py-4"><div class="spinner-border"></div></div>
      </div>
    </div>
  </div>
</main>
<script src="assets/js/registro.js"></script>
</body>
</html>
