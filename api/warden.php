<?php
declare(strict_types=1);

require_once __DIR__ . '/_warden_runtime.php';

/**
 * Read-only Warden machine state summary for external dashboards.
 * Proxies public ops_fast + ops_heavy snapshots without exposing internal paths or secrets.
 */

// Mirrors WARDEN_FAST_STALE_MS / WARDEN_HEAVY_STALE_MS in public/backend/apps/warden/api.php.
// Snapshot-file mode has no access to those constants, so they are duplicated here; keep in sync.
const WARDEN_PROXY_FAST_STALE_MS = 12000;
const WARDEN_PROXY_HEAVY_STALE_MS = 10 * 60 * 1000;

$apiCfg = wells_api_api_config('warden');
$allowedOrigins = wells_api_config_value($apiCfg, 'cors.allowed_origins', ['*']);
if (!is_array($allowedOrigins)) {
    $allowedOrigins = ['*'];
}
wells_api_apply_cors($allowedOrigins, ['GET', 'OPTIONS']);

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method !== 'GET') {
    wells_api_send_json_error(405, 'Método não permitido.');
}

function warden_public_url(): string
{
    $host = $_SERVER['HTTP_HOST'] ?? null;
    $path = trim((string)($_SERVER['SCRIPT_NAME'] ?? ''));
    if (is_string($host) && $host !== '' && $path !== '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        return $scheme . '://' . $host . $path;
    }

    return $path !== '' ? $path : '/api/warden.php';
}

function warden_build_help_response(): array
{
    $baseUrl = warden_public_url();

    return [
        'api' => 'Warden',
        'version' => wells_api_env('WELLS_API_VERSION', WELLS_API_VERSION),
        'summary' => 'Proxy read-only para estado da máquina (ops_fast + ops_heavy).',
        'self' => $baseUrl . '?help=1',
        'parameters' => [
            ['group' => 'Geral', 'name' => 'help', 'values' => '1', 'description' => 'Este guia — não consulta a API Warden upstream.'],
        ],
        'examples' => [
            ['label' => 'Estado da máquina', 'url' => $baseUrl],
        ],
        'limits' => [
            'Apenas GET sem parâmetros de consulta.',
            'Depende de apis.warden.api_url, WARDEN_API_URL ou snapshot_fast_path/snapshot_heavy_path.',
        ],
    ];
}

$helpRaw = filter_input(INPUT_GET, 'help', FILTER_UNSAFE_RAW);
if (in_array(strtolower((string)($helpRaw ?? '')), ['1', 'true', 'yes'], true)) {
    wells_api_send_json(warden_build_help_response());
}

$baseUrl = rtrim((string)wells_api_config_value($apiCfg, 'api_url', wells_api_env('WARDEN_API_URL', '')), '/');
$fastSnapshotPath = trim((string)wells_api_config_value(
    $apiCfg,
    'snapshot_fast_path',
    wells_api_env('WARDEN_SNAPSHOT_FAST_PATH', '')
));
$heavySnapshotPath = trim((string)wells_api_config_value(
    $apiCfg,
    'snapshot_heavy_path',
    wells_api_env('WARDEN_SNAPSHOT_HEAVY_PATH', '')
));

if ($baseUrl === '' && ($fastSnapshotPath === '' || $heavySnapshotPath === '')) {
    wells_api_send_json([
        'ok' => false,
        'service' => 'WELLS_API',
        'module' => 'warden',
        'version' => wells_api_env('WELLS_API_VERSION', WELLS_API_VERSION),
        'warden' => [
            'api_reachable' => false,
            'upstream_host' => '',
            'profile' => wells_api_profile_name(),
            'ops_ok' => false,
            'ops_error' => 'WARDEN_API_URL or snapshot paths not configured',
            'generated_at' => null,
            'stale' => true,
            'machine' => null,
            'alerts' => ['summary' => [], 'current' => []],
            'history' => ['1h' => [], '24h' => []],
        ],
        'timestamp' => gmdate('c'),
    ]);
}

function warden_upstream_host(string $apiUrl): string
{
    $parts = parse_url($apiUrl);
    if (!is_array($parts)) {
        return '';
    }
    $host = (string)($parts['host'] ?? '');
    if ($host === '') {
        return '';
    }
    $port = isset($parts['port']) ? (int)$parts['port'] : null;
    if ($port !== null && $port > 0) {
        return $host . ':' . $port;
    }

    return $host;
}

function warden_load_snapshot_file(string $path, int $staleThresholdMs): array
{
    if ($path === '' || !is_readable($path)) {
        return ['ok' => false, 'error' => 'Snapshot file not readable'];
    }
    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return ['ok' => false, 'error' => 'Snapshot file empty'];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'Invalid snapshot JSON'];
    }
    $mtime = @filemtime($path);
    $generatedAt = (string)($decoded['generated_at'] ?? ($decoded['current']['timestamp'] ?? ''));
    $ageMs = null;
    if ($mtime !== false) {
        $ageMs = max(0, (int)round((microtime(true) - (float)$mtime) * 1000));
    }

    return [
        'ok' => true,
        'payload' => $decoded,
        'generated_at' => $generatedAt !== '' ? $generatedAt : null,
        'stale' => $ageMs !== null && $ageMs > $staleThresholdMs,
        'age_ms' => $ageMs,
        'source' => 'snapshot',
    ];
}

function warden_fetch_action(string $baseUrl, string $action): array
{
    $separator = strpos($baseUrl, '?') === false ? '?' : '&';
    $url = $baseUrl . $separator . 'action=' . rawurlencode($action);
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => "Accept: application/json\r\n",
            'timeout' => 25,
            'ignore_errors' => true,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if (!is_string($raw) || trim($raw) === '') {
        return ['ok' => false, 'error' => 'Warden API unreachable'];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'Invalid JSON from Warden API'];
    }

    return $decoded;
}

/**
 * @param array<string, mixed> $source
 * @param list<string> $keys
 * @return mixed
 */
function warden_pick(array $source, array $keys)
{
    foreach ($keys as $key) {
        if (array_key_exists($key, $source)) {
            return $source[$key];
        }
    }

    return null;
}

function warden_payload_from_envelope(array $response): array
{
    if (isset($response['payload']) && is_array($response['payload'])) {
        return $response['payload'];
    }

    return $response;
}

if ($baseUrl !== '') {
    $fastEnvelope = warden_fetch_action($baseUrl, 'ops_fast');
    $heavyEnvelope = warden_fetch_action($baseUrl, 'ops_heavy');
    $upstreamHost = warden_upstream_host($baseUrl);
} else {
    $fastEnvelope = warden_load_snapshot_file($fastSnapshotPath, WARDEN_PROXY_FAST_STALE_MS);
    $heavyEnvelope = warden_load_snapshot_file($heavySnapshotPath, WARDEN_PROXY_HEAVY_STALE_MS);
    $upstreamHost = 'snapshot';
}

$fastOk = (bool)($fastEnvelope['ok'] ?? false);
$heavyOk = (bool)($heavyEnvelope['ok'] ?? false);
$fastPayload = $fastOk ? warden_payload_from_envelope($fastEnvelope) : [];
$heavyPayload = $heavyOk ? warden_payload_from_envelope($heavyEnvelope) : [];

$opsOk = $fastOk && $heavyOk;
$opsError = null;
if (!$opsOk) {
    if (!$fastOk) {
        $candidate = warden_pick($fastEnvelope, ['error', 'message', 'reason']);
        $opsError = is_string($candidate) ? $candidate : 'ops_fast unavailable';
    } elseif (!$heavyOk) {
        $candidate = warden_pick($heavyEnvelope, ['error', 'message', 'reason']);
        $opsError = is_string($candidate) ? $candidate : 'ops_heavy unavailable';
    }
}

$currentFast = is_array($fastPayload['current'] ?? null) ? $fastPayload['current'] : [];
$currentHeavy = is_array($heavyPayload['current'] ?? null) ? $heavyPayload['current'] : [];
$hostInfo = is_array($currentHeavy['host'] ?? null) ? $currentHeavy['host'] : [];
$alerts = is_array($fastPayload['alerts'] ?? null) ? $fastPayload['alerts'] : [];

/**
 * ops_fast traz telemetria leve; top_consumers / processos vivem tipicamente em ops_heavy.
 *
 * @param mixed $fastDisk
 * @param mixed $heavyDisk
 * @return array|null
 */
function warden_public_disk($fastDisk, $heavyDisk)
{
    $disk = is_array($fastDisk) ? $fastDisk : [];
    if (is_array($heavyDisk)) {
        foreach (['percent', 'used_gb', 'free_gb', 'total_gb', 'mount_path', 'read_mb_s', 'write_mb_s'] as $key) {
            if (!array_key_exists($key, $disk) && array_key_exists($key, $heavyDisk)) {
                $disk[$key] = $heavyDisk[$key];
            }
        }
        if (!isset($disk['top_consumers']) && isset($heavyDisk['top_consumers']) && is_array($heavyDisk['top_consumers'])) {
            $disk['top_consumers'] = $heavyDisk['top_consumers'];
        }
    }

    return $disk !== [] ? $disk : null;
}

/**
 * @param mixed $processes
 * @return array|null
 */
function warden_public_processes($processes)
{
    if (!is_array($processes)) {
        return null;
    }
    $topCpu = [];
    foreach (array_slice(is_array($processes['top_cpu'] ?? null) ? $processes['top_cpu'] : [], 0, 15) as $row) {
        if (!is_array($row)) {
            continue;
        }
        $name = $row['name'] ?? null;
        $topCpu[] = [
            'pid' => $row['pid'] ?? null,
            'name' => is_string($name) ? $name : null,
            'cpu_percent' => $row['cpu_percent'] ?? null,
        ];
    }
    $topMem = [];
    foreach (array_slice(is_array($processes['top_memory'] ?? null) ? $processes['top_memory'] : [], 0, 15) as $row) {
        if (!is_array($row)) {
            continue;
        }
        $name = $row['name'] ?? null;
        $topMem[] = [
            'pid' => $row['pid'] ?? null,
            'name' => is_string($name) ? $name : null,
            'rss_bytes' => $row['rss_bytes'] ?? null,
        ];
    }
    if ($topCpu === [] && $topMem === []) {
        return null;
    }

    return [
        'generated_at' => is_string($processes['generated_at'] ?? null) ? $processes['generated_at'] : null,
        'top_cpu' => $topCpu,
        'top_memory' => $topMem,
    ];
}

$publicDisk = warden_public_disk($currentFast['disk'] ?? null, $currentHeavy['disk'] ?? null);
$publicProcesses = warden_public_processes($currentHeavy['processes'] ?? ($currentFast['processes'] ?? null));

$generatedAt = warden_pick($fastEnvelope, ['generated_at'])
    ?? warden_pick($fastPayload, ['generated_at'])
    ?? warden_pick($heavyEnvelope, ['generated_at'])
    ?? warden_pick($heavyPayload, ['generated_at']);

// Frescor da telemetria da máquina = ops_fast. ops_heavy (DB/histórico) refresca
// mais lento e não deve marcar o Warden inteiro como stale.
$fastStale = (bool)($fastEnvelope['stale'] ?? false);
$heavyStale = (bool)($heavyEnvelope['stale'] ?? false);
$ageMs = warden_pick($fastEnvelope, ['age_ms']);
if (!is_int($ageMs) && !is_float($ageMs)) {
    $ageMs = null;
} else {
    $ageMs = (int)$ageMs;
}
$stale = $fastStale || ($ageMs !== null && $ageMs > 30000);

wells_api_send_json([
    'ok' => $opsOk,
    'service' => 'WELLS_API',
    'module' => 'warden',
    'version' => wells_api_env('WELLS_API_VERSION', WELLS_API_VERSION),
    'warden' => [
        'api_reachable' => $fastOk || $heavyOk,
        'upstream_host' => $upstreamHost,
        'profile' => wells_api_profile_name(),
        'ops_ok' => $opsOk,
        'ops_error' => $opsError,
        'generated_at' => is_string($generatedAt) ? $generatedAt : null,
        'stale' => $stale,
        'stale_fast' => $fastStale,
        'stale_heavy' => $heavyStale,
        'age_ms' => $ageMs,
        'machine' => [
            'cpu' => $currentFast['cpu'] ?? ($currentHeavy['cpu'] ?? null),
            'memory' => $currentFast['memory'] ?? ($currentHeavy['memory'] ?? null),
            'disk' => $publicDisk,
            'network' => $currentFast['network'] ?? ($currentHeavy['network'] ?? null),
            'processes' => $publicProcesses,
            'timestamp' => $currentFast['timestamp'] ?? ($currentHeavy['timestamp'] ?? null),
            'host' => $hostInfo !== [] ? $hostInfo : null,
        ],
        'alerts' => [
            'summary' => is_array($alerts['summary'] ?? null) ? $alerts['summary'] : [],
            'current' => is_array($alerts['current'] ?? null) ? $alerts['current'] : [],
        ],
        'db' => is_array($fastPayload['db'] ?? null) ? $fastPayload['db'] : [],
        'history' => [
            '1h' => is_array($heavyPayload['history_1h'] ?? null) ? $heavyPayload['history_1h'] : [],
            '24h' => is_array($heavyPayload['history_24h'] ?? null) ? $heavyPayload['history_24h'] : [],
        ],
        'realtime' => is_array($fastPayload['realtime'] ?? null) ? $fastPayload['realtime'] : [],
    ],
    'timestamp' => gmdate('c'),
]);
