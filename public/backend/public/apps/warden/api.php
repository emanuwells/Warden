<?php
/**
 * Finalidade: Wrapper de compatibilidade da API pública da app Warden.
 * Depende de: implementação canónica localizada noutro path do repositório.
 * Entradas/Saídas principais: Recebe pedidos HTTP ou parâmetros de execução e devolve resposta, efeitos de backend ou dados serializados.
 * Efeitos laterais: Pode ler/escrever sessão, base de dados, ficheiros locais e cabeçalhos HTTP conforme a operação.
 * Relação canónica: Wrapper de compatibilidade; a lógica real vive noutro path canónico e não deve ser duplicada aqui.
 */
// Wrapper público; a implementação canónica vive em backend/apps/warden/api.php.
require_once __DIR__ . '/../../../apps/warden/api.php';
