<?php
declare(strict_types=1);

/**
 * Finalidade: API backend can?nica da app Warden.
 * Depende de: auth partilhada, configura??o local e base de dados/artefactos da app.
 * Entradas/Sa?das principais: Recebe pedidos HTTP ou par?metros de execu??o e devolve resposta, efeitos de backend ou dados serializados.
 * Efeitos laterais: Pode ler/escrever sess?o, base de dados, ficheiros locais e cabe?alhos HTTP conforme a opera??o.
 * Rela??o can?nica: Implementa??o can?nica de backend/opera??o; os paths p?blicos limitam-se a delegar para aqui quando necess?rio.
 */
require_once __DIR__ . '/../../core/shared/maiatron-auth-session.php';
require_once __DIR__ . '/../../core/shared/maiatron-authz.php';

const WARDEN_API_SCHEMA_VERSION = 2;
const WARDEN_API_APP_KEY = 'warden';
const WARDEN_FAST_STALE_MS = 12000;
const WARDEN_HEAVY_STALE_MS = 10 * 60 * 1000;
const WARDEN_FULL_STALE_MS = 10 * 60 * 1000;
const WARDEN_RETENTION_DAYS = 7;
const WARDEN_FALLBACK_30D_DAYS = 30;
const WARDEN_INGEST_LOCK_NAME = 'maiatron_warden_ingest_v1';
const WARDEN_JANITOR_LOCK_NAME = 'maiatron_warden_janitor_v1';
const WARDEN_JANITOR_EVERY_SECONDS = 6 * 3600;
const WARDEN_JANITOR_DELETE_BATCH = 5000;

function warden_json_out(array $data, int $code = 200, array $headers = []): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-cache');
    header('Vary: Cookie');
    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function warden_json_error(string $reason, string $message, int $code): void
{
    warden_json_out([
        'ok' => false,
        'reason' => $reason,
        'error' => $message,
    ], $code);
}

function warden_send_304(array $headers = []): void
{
    http_response_code(304);
    header('Cache-Control: private, no-cache');
    header('Vary: Cookie');
    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }
    exit;
}

function warden_request_method(): string
{
    return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}

function warden_action(): string
{
    return strtolower(trim((string)($_GET['action'] ?? 'full')));
}

function warden_if_none_match(): ?string
{
    $raw = trim((string)($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''));
    return $raw !== '' ? $raw : null;
}

function warden_etag_matches(string $etag): bool
{
    $raw = warden_if_none_match();
    if ($raw === null) return false;
    foreach (explode(',', $raw) as $candidate) {
        $token = trim($candidate);
        if ($token === $etag || $token === ('W/' . $etag)) return true;
    }
    return false;
}

function warden_http_date_from_timestamp(int $ts): string
{
    return gmdate('D, d M Y H:i:s', max(0, $ts)) . ' GMT';
}

function warden_parse_time_ms(?string $value): ?int
{
    if ($value === null || $value === '') return null;
    $ts = strtotime($value);
    if ($ts === false) return null;
    return (int)$ts * 1000;
}

function warden_age_ms(?string $generatedAt, int $fallbackMtime): int
{
    $now = (int)floor(microtime(true) * 1000);
    $generatedMs = warden_parse_time_ms($generatedAt);
    if ($generatedMs === null) {
        return max(0, $now - ($fallbackMtime * 1000));
    }
    return max(0, $now - $generatedMs);
}

function warden_envelope(string $kind, array $payload, array $meta): array
{
    $generatedAt = (string)($meta['generated_at'] ?? ($payload['generated_at'] ?? ''));
    $mtime = (int)($meta['mtime'] ?? time());
    $staleMs = (int)($meta['stale_threshold_ms'] ?? WARDEN_FULL_STALE_MS);
    $ageMs = (int)($meta['age_ms'] ?? warden_age_ms($generatedAt !== '' ? $generatedAt : null, $mtime));
    $etag = (string)($meta['etag'] ?? '');
    return [
        'ok' => true,
        'kind' => $kind,
        'schema_version' => WARDEN_API_SCHEMA_VERSION,
        'snapshot_id' => (string)($meta['snapshot_id'] ?? ('snapshot-' . $kind)),
        'generated_at' => $generatedAt !== '' ? $generatedAt : null,
        'stale' => array_key_exists('stale', $meta) ? (bool)$meta['stale'] : ($ageMs > $staleMs),
        'age_ms' => $ageMs,
        'etag' => $etag !== '' ? $etag : null,
        'payload' => $payload,
    ];
}

function warden_db_secret_candidate_paths(): array
{
    $candidates = [];
    $envPath = getenv('MAIATRON_AUTH_DB_SECRET');
    if (is_string($envPath) && trim($envPath) !== '') {
        $candidates[] = trim($envPath);
    }

    $candidates[] = __DIR__ . '/../../../secrets/database.local.php';
    $candidates[] = __DIR__ . '/../../../secrets/database.local.json';
    $candidates[] = '/opt/maiatron/MAIATRON_HUB/secrets/database.json';
    $candidates[] = '/opt/maiatron/Warden/secrets/database.json';
    $candidates[] = '/opt/maiatron/Overseer/secrets/database.json';
    $candidates[] = '/opt/maiatron/fontetron/secrets/database.json';
    $candidates[] = '/home/eferreira/MAIATRON/Warden/secrets/database.json';
    $candidates[] = '/home/eferreira/MAIATRON/Overseer/secrets/database.json';

    $normalized = [];
    foreach ($candidates as $path) {
        $path = trim((string)$path);
        if ($path === '' || isset($normalized[$path])) {
            continue;
        }
        $normalized[$path] = true;
    }

    return array_keys($normalized);
}

function warden_load_db_config(): array
{
    $cfg = null;
    foreach (warden_db_secret_candidate_paths() as $path) {
        if (!is_file($path) || !is_readable($path)) {
            continue;
        }

        $cfg = (substr($path, -4) === '.php')
            ? include $path
            : json_decode((string)file_get_contents($path), true);

        if (is_array($cfg)) {
            break;
        }
    }

    if (!is_array($cfg)) {
        throw new RuntimeException('Database config not found');
    }

    $db = isset($cfg['database']) && is_array($cfg['database']) ? $cfg['database'] : $cfg;

    return [
        'host' => $db['host'] ?? $cfg['host'] ?? '127.0.0.1',
        'port' => (int)($db['port'] ?? $cfg['port'] ?? 3306),
        'user' => $db['user'] ?? $db['username'] ?? $cfg['user'] ?? $cfg['username'] ?? 'root',
        'password' => $db['password'] ?? $cfg['password'] ?? '',
    ];
}

function warden_db_connect(string $dbName): PDO
{
    static $pool = [];
    if (isset($pool[$dbName]) && $pool[$dbName] instanceof PDO) {
        return $pool[$dbName];
    }

    $cfg = warden_load_db_config();
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $cfg['host'], $cfg['port'], $dbName);
    $pool[$dbName] = new PDO($dsn, $cfg['user'], $cfg['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pool[$dbName];
}

function warden_db_warden(): PDO
{
    return warden_db_connect('Warden');
}

function warden_db_auth(): PDO
{
    return warden_db_connect('MAIATRON');
}

function warden_db_ensure_schema(): void
{
    static $done = false;
    if ($done) return;

    $pdo = warden_db_warden();

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `warden_ts_minute` (
            `host_key` VARCHAR(190) NOT NULL,
            `bucket_minute` DATETIME NOT NULL,
            `cpu_avg` DOUBLE NULL,
            `mem_avg` DOUBLE NULL,
            `disk_avg` DOUBLE NULL,
            `disk_total_gb_avg` DOUBLE NULL,
            `disk_used_gb_avg` DOUBLE NULL,
            `disk_free_gb_avg` DOUBLE NULL,
            `disk_growth_gb_h_avg` DOUBLE NULL,
            `net_up_avg` DOUBLE NULL,
            `net_down_avg` DOUBLE NULL,
            `qps_avg` DOUBLE NULL,
            `tps_avg` DOUBLE NULL,
            `storage_total_gb_avg` DOUBLE NULL,
            `storage_growth_gb_h_avg` DOUBLE NULL,
            `threads_running_avg` DOUBLE NULL,
            `threads_running_max` DOUBLE NULL,
            `threads_connected_avg` DOUBLE NULL,
            `samples_count` INT NOT NULL DEFAULT 1,
            `source_generated_at` DATETIME NULL,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`host_key`, `bucket_minute`),
            INDEX `idx_warden_ts_bucket` (`bucket_minute`),
            INDEX `idx_warden_ts_updated` (`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    warden_db_ensure_column(
        $pdo,
        'warden_ts_minute',
        'disk_total_gb_avg',
        "ALTER TABLE `warden_ts_minute` ADD COLUMN `disk_total_gb_avg` DOUBLE NULL AFTER `disk_avg`"
    );
    warden_db_ensure_column(
        $pdo,
        'warden_ts_minute',
        'disk_used_gb_avg',
        "ALTER TABLE `warden_ts_minute` ADD COLUMN `disk_used_gb_avg` DOUBLE NULL AFTER `disk_total_gb_avg`"
    );
    warden_db_ensure_column(
        $pdo,
        'warden_ts_minute',
        'disk_free_gb_avg',
        "ALTER TABLE `warden_ts_minute` ADD COLUMN `disk_free_gb_avg` DOUBLE NULL AFTER `disk_used_gb_avg`"
    );
    warden_db_ensure_column(
        $pdo,
        'warden_ts_minute',
        'disk_growth_gb_h_avg',
        "ALTER TABLE `warden_ts_minute` ADD COLUMN `disk_growth_gb_h_avg` DOUBLE NULL AFTER `disk_free_gb_avg`"
    );
    warden_db_ensure_column(
        $pdo,
        'warden_ts_minute',
        'storage_total_gb_avg',
        "ALTER TABLE `warden_ts_minute` ADD COLUMN `storage_total_gb_avg` DOUBLE NULL AFTER `tps_avg`"
    );
    warden_db_ensure_column(
        $pdo,
        'warden_ts_minute',
        'storage_growth_gb_h_avg',
        "ALTER TABLE `warden_ts_minute` ADD COLUMN `storage_growth_gb_h_avg` DOUBLE NULL AFTER `storage_total_gb_avg`"
    );

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `warden_alert_events` (
            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
            `host_key` VARCHAR(190) NOT NULL,
            `observed_at` DATETIME NOT NULL,
            `alert_key` VARCHAR(190) NOT NULL,
            `title` VARCHAR(255) NULL,
            `severity` VARCHAR(32) NULL,
            `status` VARCHAR(32) NULL,
            `value_num` DOUBLE NULL,
            `threshold_num` DOUBLE NULL,
            `source_generated_at` DATETIME NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_warden_alert_obs` (`host_key`, `observed_at`, `alert_key`, `status`),
            INDEX `idx_warden_alert_observed` (`observed_at`),
            INDEX `idx_warden_alert_key_observed` (`alert_key`, `observed_at`),
            INDEX `idx_warden_alert_sev_observed` (`severity`, `observed_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `warden_ingest_registry` (
            `snapshot_key` CHAR(40) NOT NULL PRIMARY KEY,
            `generated_at` DATETIME NULL,
            `source_mtime` BIGINT NOT NULL,
            `source_size` BIGINT NOT NULL,
            `ingested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_warden_ingest_ingested` (`ingested_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `warden_maintenance_state` (
            `state_key` VARCHAR(120) NOT NULL PRIMARY KEY,
            `state_value` TEXT NULL,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $done = true;
}

function warden_db_column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare("
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = :table_name
          AND column_name = :column_name
        LIMIT 1
    ");
    $stmt->execute([
        'table_name' => $table,
        'column_name' => $column,
    ]);
    return (bool)$stmt->fetchColumn();
}

function warden_db_ensure_column(PDO $pdo, string $table, string $column, string $alterSql): void
{
    if (warden_db_column_exists($pdo, $table, $column)) {
        return;
    }
    $pdo->exec($alterSql);
}

function warden_db_get_lock(PDO $pdo, string $name, int $timeoutSeconds = 0): bool
{
    $stmt = $pdo->prepare('SELECT GET_LOCK(:name, :timeout) AS l');
    $stmt->execute([
        'name' => $name,
        'timeout' => max(0, $timeoutSeconds),
    ]);
    $row = $stmt->fetch();
    return (int)($row['l'] ?? 0) === 1;
}

function warden_db_release_lock(PDO $pdo, string $name): void
{
    try {
        $stmt = $pdo->prepare('SELECT RELEASE_LOCK(:name) AS l');
        $stmt->execute(['name' => $name]);
    } catch (Throwable $e) {
        error_log('[Warden API] release lock failed: ' . $e->getMessage());
    }
}

function warden_to_float_or_null($value): ?float
{
    if ($value === null || $value === '') return null;
    if (!is_numeric($value)) return null;
    return (float)$value;
}

function warden_bucket_to_sql_datetime($value): ?string
{
    if ($value === null || $value === '') return null;
    $ts = strtotime((string)$value);
    if ($ts === false) return null;
    return gmdate('Y-m-d H:i:00', $ts);
}

function warden_iso_to_sql_datetime($value): ?string
{
    if ($value === null || $value === '') return null;
    $ts = strtotime((string)$value);
    if ($ts === false) return null;
    return gmdate('Y-m-d H:i:s', $ts);
}

function warden_retention_cutoff_ts(): int
{
    return time() - (WARDEN_RETENTION_DAYS * 86400);
}

function warden_is_within_retention(?string $sqlDateTime, ?int $cutoffTs = null): bool
{
    if ($sqlDateTime === null || $sqlDateTime === '') return false;
    $rawTs = strtotime($sqlDateTime . ' UTC');
    if ($rawTs === false) return false;
    return $rawTs >= ($cutoffTs ?? warden_retention_cutoff_ts());
}

function warden_host_key_from_payload(array $payload): string
{
    $host = is_array($payload['current']['host'] ?? null) ? $payload['current']['host'] : [];
    $raw = trim((string)($host['hostname'] ?? $host['fqdn'] ?? ''));
    if ($raw === '') $raw = 'default';
    return substr($raw, 0, 190);
}

function warden_state_set(PDO $pdo, string $key, ?string $value): void
{
    $stmt = $pdo->prepare("
        INSERT INTO `warden_maintenance_state` (`state_key`, `state_value`, `updated_at`)
        VALUES (:k, :v, UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE `state_value` = VALUES(`state_value`), `updated_at` = UTC_TIMESTAMP()
    ");
    $stmt->execute([
        'k' => $key,
        'v' => $value,
    ]);
}

function warden_state_get(PDO $pdo, string $key): ?string
{
    $stmt = $pdo->prepare('SELECT `state_value` FROM `warden_maintenance_state` WHERE `state_key` = :k LIMIT 1');
    $stmt->execute(['k' => $key]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $value = $row['state_value'] ?? null;
    return $value !== null ? (string)$value : null;
}

function warden_build_ingest_rows(array $full, bool $bootstrap, ?float $fallbackDiskTotalGb = null): array
{
    $cutoffTs = warden_retention_cutoff_ts();

    $sysRows = $bootstrap
        ? (array)($full['history_7d'] ?? [])
        : (array)($full['history_1h'] ?? []);
    $dbRows = $bootstrap
        ? (array)($full['db']['history']['7d'] ?? [])
        : (array)($full['db']['history']['1h'] ?? []);

    if (!$sysRows && !$dbRows) {
        $sysRows = (array)($full['history_7d'] ?? []);
        $dbRows = (array)($full['db']['history']['7d'] ?? []);
    }

    $out = [];
    foreach ($sysRows as $row) {
        if (!is_array($row)) continue;
        $bucket = warden_bucket_to_sql_datetime($row['bucket'] ?? $row['timestamp'] ?? null);
        if ($bucket === null) continue;
        if (!warden_is_within_retention($bucket, $cutoffTs)) continue;
        $out[$bucket] = [
            'bucket_minute' => $bucket,
            'cpu_avg' => warden_to_float_or_null($row['cpu_avg'] ?? null),
            'mem_avg' => warden_to_float_or_null($row['mem_avg'] ?? null),
            'disk_avg' => warden_to_float_or_null($row['disk_avg'] ?? null),
            'disk_total_gb_avg' => warden_to_float_or_null($row['disk_total_gb_avg'] ?? null),
            'disk_used_gb_avg' => warden_to_float_or_null($row['disk_used_gb_avg'] ?? null),
            'disk_free_gb_avg' => warden_to_float_or_null($row['disk_free_gb_avg'] ?? null),
            'disk_growth_gb_h_avg' => warden_to_float_or_null($row['disk_growth_gb_h_avg'] ?? null),
            'net_up_avg' => warden_to_float_or_null($row['net_up_avg'] ?? null),
            'net_down_avg' => warden_to_float_or_null($row['net_down_avg'] ?? null),
            'qps_avg' => null,
            'tps_avg' => null,
            'storage_total_gb_avg' => null,
            'storage_growth_gb_h_avg' => null,
            'threads_running_avg' => null,
            'threads_running_max' => null,
            'threads_connected_avg' => null,
            'samples_count' => max(1, (int)($row['samples_count'] ?? $row['samples'] ?? 1)),
        ];
    }

    foreach ($dbRows as $row) {
        if (!is_array($row)) continue;
        $bucket = warden_bucket_to_sql_datetime($row['bucket'] ?? $row['timestamp'] ?? null);
        if ($bucket === null) continue;
        if (!warden_is_within_retention($bucket, $cutoffTs)) continue;
        if (!isset($out[$bucket])) {
            $out[$bucket] = [
                'bucket_minute' => $bucket,
                'cpu_avg' => null,
                'mem_avg' => null,
                'disk_avg' => null,
                'disk_total_gb_avg' => null,
                'disk_used_gb_avg' => null,
                'disk_free_gb_avg' => null,
                'disk_growth_gb_h_avg' => null,
                'net_up_avg' => null,
                'net_down_avg' => null,
                'qps_avg' => null,
                'tps_avg' => null,
                'storage_total_gb_avg' => null,
                'storage_growth_gb_h_avg' => null,
                'threads_running_avg' => null,
                'threads_running_max' => null,
                'threads_connected_avg' => null,
                'samples_count' => 1,
            ];
        }
        $out[$bucket]['qps_avg'] = warden_to_float_or_null($row['qps_avg'] ?? null);
        $out[$bucket]['tps_avg'] = warden_to_float_or_null($row['tps_avg'] ?? null);
        $out[$bucket]['storage_total_gb_avg'] = warden_to_float_or_null($row['storage_total_gb_avg'] ?? null);
        $out[$bucket]['storage_growth_gb_h_avg'] = warden_to_float_or_null($row['storage_growth_gb_h_avg'] ?? null);
        $out[$bucket]['threads_running_avg'] = warden_to_float_or_null($row['threads_running_avg'] ?? null);
        $out[$bucket]['threads_running_max'] = warden_to_float_or_null($row['threads_running_max'] ?? null);
        $out[$bucket]['threads_connected_avg'] = warden_to_float_or_null($row['threads_connected_avg'] ?? null);
        $out[$bucket]['samples_count'] = max(
            (int)$out[$bucket]['samples_count'],
            max(1, (int)($row['samples_count'] ?? $row['samples'] ?? 1))
        );
    }

    ksort($out);

    if ($fallbackDiskTotalGb !== null && $fallbackDiskTotalGb > 0) {
        foreach ($out as &$row) {
            if ($row['disk_total_gb_avg'] === null || $row['disk_total_gb_avg'] <= 0) {
                $row['disk_total_gb_avg'] = $fallbackDiskTotalGb;
            }
        }
        unset($row);
    }

    foreach ($out as &$row) {
        $diskTotal = warden_to_float_or_null($row['disk_total_gb_avg'] ?? null);
        $diskUsed = warden_to_float_or_null($row['disk_used_gb_avg'] ?? null);
        $diskFree = warden_to_float_or_null($row['disk_free_gb_avg'] ?? null);
        $diskPct = warden_to_float_or_null($row['disk_avg'] ?? null);

        if (($diskUsed === null || $diskUsed < 0) && $diskTotal !== null && $diskPct !== null) {
            $diskUsed = $diskTotal * ($diskPct / 100.0);
        }
        if (($diskFree === null || $diskFree < 0) && $diskTotal !== null && $diskUsed !== null) {
            $diskFree = max(0.0, $diskTotal - $diskUsed);
        }

        $row['disk_total_gb_avg'] = $diskTotal !== null ? round($diskTotal, 3) : null;
        $row['disk_used_gb_avg'] = $diskUsed !== null ? round($diskUsed, 3) : null;
        $row['disk_free_gb_avg'] = $diskFree !== null ? round($diskFree, 3) : null;
    }
    unset($row);

    $prevBucketTs = null;
    $prevUsedGb = null;
    foreach ($out as &$row) {
        $growth = warden_to_float_or_null($row['disk_growth_gb_h_avg'] ?? null);
        $used = warden_to_float_or_null($row['disk_used_gb_avg'] ?? null);
        $bucketTs = strtotime((string)$row['bucket_minute']);
        if ($growth === null && $used !== null && $prevBucketTs !== null && $prevUsedGb !== null && $bucketTs !== false && $bucketTs > $prevBucketTs) {
            $elapsedH = ($bucketTs - $prevBucketTs) / 3600.0;
            if ($elapsedH > 0) {
                $growth = ($used - $prevUsedGb) / $elapsedH;
            }
        }
        if ($growth === null && $used !== null) {
            $growth = 0.0;
        }
        $row['disk_growth_gb_h_avg'] = $growth !== null ? round($growth, 3) : null;

        if ($bucketTs !== false && $used !== null) {
            $prevBucketTs = (int)$bucketTs;
            $prevUsedGb = $used;
        }
    }
    unset($row);

    ksort($out);
    return array_values($out);
}

function warden_ingest_alert_events(PDO $pdo, string $hostKey, array $full, ?string $generatedSql): int
{
    $cutoffTs = warden_retention_cutoff_ts();
    $rows = [];
    $alerts = is_array($full['alerts'] ?? null) ? $full['alerts'] : [];
    foreach ((array)($alerts['history_recent'] ?? []) as $row) {
        if (!is_array($row)) continue;
        $rows[] = $row;
    }
    foreach ((array)($alerts['current'] ?? []) as $row) {
        if (!is_array($row)) continue;
        $rows[] = $row;
    }
    if (!$rows) return 0;

    $stmt = $pdo->prepare("
        INSERT IGNORE INTO `warden_alert_events`
        (`host_key`, `observed_at`, `alert_key`, `title`, `severity`, `status`, `value_num`, `threshold_num`, `source_generated_at`)
        VALUES
        (:host_key, :observed_at, :alert_key, :title, :severity, :status, :value_num, :threshold_num, :source_generated_at)
    ");

    $inserted = 0;
    foreach ($rows as $row) {
        $observedAt = warden_iso_to_sql_datetime($row['sent_at'] ?? $row['timestamp'] ?? null) ?: $generatedSql;
        if ($observedAt === null) continue;
        if (!warden_is_within_retention($observedAt, $cutoffTs)) continue;
        $alertKey = trim((string)($row['key'] ?? ''));
        if ($alertKey === '') $alertKey = 'alert';
        $status = trim((string)($row['status'] ?? 'unknown'));
        if ($status === '') $status = 'unknown';
        $stmt->execute([
            'host_key' => $hostKey,
            'observed_at' => $observedAt,
            'alert_key' => substr($alertKey, 0, 190),
            'title' => ($row['title'] ?? null) !== null ? substr((string)$row['title'], 0, 255) : null,
            'severity' => ($row['severity'] ?? null) !== null ? substr((string)$row['severity'], 0, 32) : null,
            'status' => substr($status, 0, 32),
            'value_num' => warden_to_float_or_null($row['value'] ?? null),
            'threshold_num' => warden_to_float_or_null($row['threshold'] ?? null),
            'source_generated_at' => $generatedSql,
        ]);
        $inserted += $stmt->rowCount();
    }

    return $inserted;
}

function warden_ingest_snapshot(array $full, array $sourceStat, string $cacheKey): void
{
    try {
        warden_db_ensure_schema();
    } catch (Throwable $e) {
        error_log('[Warden API] ensure schema failed: ' . $e->getMessage());
        return;
    }

    $pdo = warden_db_warden();
    if (!warden_db_get_lock($pdo, WARDEN_INGEST_LOCK_NAME, 0)) {
        return;
    }

    try {
        $registryStmt = $pdo->prepare('SELECT 1 FROM `warden_ingest_registry` WHERE `snapshot_key` = :k LIMIT 1');
        $registryStmt->execute(['k' => $cacheKey]);
        if ($registryStmt->fetch()) {
            return;
        }

        $hostKey = warden_host_key_from_payload($full);
        $generatedSql = warden_iso_to_sql_datetime($full['generated_at'] ?? ($full['current']['timestamp'] ?? null));

        $countStmt = $pdo->prepare('SELECT COUNT(*) AS c FROM `warden_ts_minute` WHERE `host_key` = :h');
        $countStmt->execute(['h' => $hostKey]);
        $hasRows = ((int)($countStmt->fetch()['c'] ?? 0)) > 0;
        $fallbackDiskTotalGb = warden_to_float_or_null($full['current']['disk']['total_gb'] ?? null);
        $ingestRows = warden_build_ingest_rows($full, !$hasRows, $fallbackDiskTotalGb);

        if ($ingestRows) {
            $upsert = $pdo->prepare("
                INSERT INTO `warden_ts_minute`
                (`host_key`, `bucket_minute`, `cpu_avg`, `mem_avg`, `disk_avg`, `disk_total_gb_avg`, `disk_used_gb_avg`, `disk_free_gb_avg`, `disk_growth_gb_h_avg`, `net_up_avg`, `net_down_avg`,
                 `qps_avg`, `tps_avg`, `storage_total_gb_avg`, `storage_growth_gb_h_avg`, `threads_running_avg`, `threads_running_max`, `threads_connected_avg`,
                 `samples_count`, `source_generated_at`, `updated_at`)
                VALUES
                (:host_key, :bucket_minute, :cpu_avg, :mem_avg, :disk_avg, :disk_total_gb_avg, :disk_used_gb_avg, :disk_free_gb_avg, :disk_growth_gb_h_avg, :net_up_avg, :net_down_avg,
                 :qps_avg, :tps_avg, :storage_total_gb_avg, :storage_growth_gb_h_avg, :threads_running_avg, :threads_running_max, :threads_connected_avg,
                 :samples_count, :source_generated_at, UTC_TIMESTAMP())
                ON DUPLICATE KEY UPDATE
                    `cpu_avg` = VALUES(`cpu_avg`),
                    `mem_avg` = VALUES(`mem_avg`),
                    `disk_avg` = VALUES(`disk_avg`),
                    `disk_total_gb_avg` = VALUES(`disk_total_gb_avg`),
                    `disk_used_gb_avg` = VALUES(`disk_used_gb_avg`),
                    `disk_free_gb_avg` = VALUES(`disk_free_gb_avg`),
                    `disk_growth_gb_h_avg` = VALUES(`disk_growth_gb_h_avg`),
                    `net_up_avg` = VALUES(`net_up_avg`),
                    `net_down_avg` = VALUES(`net_down_avg`),
                    `qps_avg` = VALUES(`qps_avg`),
                    `tps_avg` = VALUES(`tps_avg`),
                    `storage_total_gb_avg` = VALUES(`storage_total_gb_avg`),
                    `storage_growth_gb_h_avg` = VALUES(`storage_growth_gb_h_avg`),
                    `threads_running_avg` = VALUES(`threads_running_avg`),
                    `threads_running_max` = VALUES(`threads_running_max`),
                    `threads_connected_avg` = VALUES(`threads_connected_avg`),
                    `samples_count` = GREATEST(`samples_count`, VALUES(`samples_count`)),
                    `source_generated_at` = VALUES(`source_generated_at`),
                    `updated_at` = UTC_TIMESTAMP()
            ");
            foreach ($ingestRows as $row) {
                $upsert->execute([
                    'host_key' => $hostKey,
                    'bucket_minute' => $row['bucket_minute'],
                    'cpu_avg' => $row['cpu_avg'],
                    'mem_avg' => $row['mem_avg'],
                    'disk_avg' => $row['disk_avg'],
                    'disk_total_gb_avg' => $row['disk_total_gb_avg'],
                    'disk_used_gb_avg' => $row['disk_used_gb_avg'],
                    'disk_free_gb_avg' => $row['disk_free_gb_avg'],
                    'disk_growth_gb_h_avg' => $row['disk_growth_gb_h_avg'],
                    'net_up_avg' => $row['net_up_avg'],
                    'net_down_avg' => $row['net_down_avg'],
                    'qps_avg' => $row['qps_avg'],
                    'tps_avg' => $row['tps_avg'],
                    'storage_total_gb_avg' => $row['storage_total_gb_avg'],
                    'storage_growth_gb_h_avg' => $row['storage_growth_gb_h_avg'],
                    'threads_running_avg' => $row['threads_running_avg'],
                    'threads_running_max' => $row['threads_running_max'],
                    'threads_connected_avg' => $row['threads_connected_avg'],
                    'samples_count' => $row['samples_count'],
                    'source_generated_at' => $generatedSql,
                ]);
            }
        }

        warden_ingest_alert_events($pdo, $hostKey, $full, $generatedSql);

        $insReg = $pdo->prepare("
            INSERT INTO `warden_ingest_registry` (`snapshot_key`, `generated_at`, `source_mtime`, `source_size`, `ingested_at`)
            VALUES (:snapshot_key, :generated_at, :source_mtime, :source_size, UTC_TIMESTAMP())
        ");
        $insReg->execute([
            'snapshot_key' => $cacheKey,
            'generated_at' => $generatedSql,
            'source_mtime' => (int)($sourceStat['mtime'] ?? time()),
            'source_size' => (int)($sourceStat['size'] ?? 0),
        ]);

        warden_state_set($pdo, 'last_ingested_snapshot', $cacheKey);
        if (!empty($full['generated_at'])) {
            warden_state_set($pdo, 'last_ingested_generated_at', (string)$full['generated_at']);
        }
    } catch (Throwable $e) {
        error_log('[Warden API] ingest failed: ' . $e->getMessage());
    } finally {
        warden_db_release_lock($pdo, WARDEN_INGEST_LOCK_NAME);
    }
}

function warden_run_janitor_if_due(bool $force = false, ?PDO $pdo = null): array
{
    $result = [
        'ran' => false,
        'deleted_metrics' => 0,
        'deleted_ts' => 0,
        'deleted_alerts' => 0,
        'deleted_registry' => 0,
    ];

    try {
        warden_db_ensure_schema();
    } catch (Throwable $e) {
        error_log('[Warden API] janitor schema failed: ' . $e->getMessage());
        return $result;
    }

    $pdo = $pdo ?: warden_db_warden();
    if (!warden_db_get_lock($pdo, WARDEN_JANITOR_LOCK_NAME, 0)) {
        return $result;
    }

    try {
        $lastRaw = warden_state_get($pdo, 'last_janitor_at');
        $lastTs = $lastRaw ? strtotime($lastRaw) : false;
        $now = time();
        if (!$force && $lastTs !== false && ($now - $lastTs) < WARDEN_JANITOR_EVERY_SECONDS) {
            return $result;
        }

        $cutoffTs = gmdate('Y-m-d H:i:s', $now - (WARDEN_RETENTION_DAYS * 86400));
        $cutoffRegistry = $cutoffTs;

        $deleteMetrics = $pdo->prepare('DELETE FROM `warden_metrics` WHERE `captured_at` < :cutoff LIMIT ' . WARDEN_JANITOR_DELETE_BATCH);
        do {
            $deleteMetrics->execute(['cutoff' => $cutoffTs]);
            $affected = $deleteMetrics->rowCount();
            $result['deleted_metrics'] += $affected;
        } while ($affected === WARDEN_JANITOR_DELETE_BATCH);

        $deleteTs = $pdo->prepare('DELETE FROM `warden_ts_minute` WHERE `bucket_minute` < :cutoff LIMIT ' . WARDEN_JANITOR_DELETE_BATCH);
        do {
            $deleteTs->execute(['cutoff' => $cutoffTs]);
            $affected = $deleteTs->rowCount();
            $result['deleted_ts'] += $affected;
        } while ($affected === WARDEN_JANITOR_DELETE_BATCH);

        $deleteAlerts = $pdo->prepare('DELETE FROM `warden_alert_events` WHERE `observed_at` < :cutoff LIMIT ' . WARDEN_JANITOR_DELETE_BATCH);
        do {
            $deleteAlerts->execute(['cutoff' => $cutoffTs]);
            $affected = $deleteAlerts->rowCount();
            $result['deleted_alerts'] += $affected;
        } while ($affected === WARDEN_JANITOR_DELETE_BATCH);

        $deleteRegistry = $pdo->prepare('DELETE FROM `warden_ingest_registry` WHERE `ingested_at` < :cutoff LIMIT ' . WARDEN_JANITOR_DELETE_BATCH);
        do {
            $deleteRegistry->execute(['cutoff' => $cutoffRegistry]);
            $affected = $deleteRegistry->rowCount();
            $result['deleted_registry'] += $affected;
        } while ($affected === WARDEN_JANITOR_DELETE_BATCH);

        warden_state_set($pdo, 'last_janitor_at', gmdate('c', $now));
        warden_state_set($pdo, 'last_janitor_stats', json_encode([
            'deleted_metrics' => $result['deleted_metrics'],
            'deleted_ts' => $result['deleted_ts'],
            'deleted_alerts' => $result['deleted_alerts'],
            'deleted_registry' => $result['deleted_registry'],
            'ran_at' => gmdate('c', $now),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $result['ran'] = true;
        return $result;
    } catch (Throwable $e) {
        error_log('[Warden API] janitor failed: ' . $e->getMessage());
        return $result;
    } finally {
        warden_db_release_lock($pdo, WARDEN_JANITOR_LOCK_NAME);
    }
}

function warden_fetch_30d_series_from_db(string $hostKey): array
{
    try {
        warden_db_ensure_schema();
    } catch (Throwable $e) {
        return ['history' => [], 'db' => []];
    }

    $pdo = warden_db_warden();
    $sysStmt = $pdo->prepare("
        SELECT
            DATE_FORMAT(`bucket_minute`, '%Y-%m-%dT%H:00:00') AS bucket,
            AVG(`cpu_avg`) AS cpu_avg,
            AVG(`mem_avg`) AS mem_avg,
            AVG(`disk_avg`) AS disk_avg,
            AVG(`disk_total_gb_avg`) AS disk_total_gb_avg,
            AVG(`disk_used_gb_avg`) AS disk_used_gb_avg,
            AVG(`disk_free_gb_avg`) AS disk_free_gb_avg,
            AVG(`disk_growth_gb_h_avg`) AS disk_growth_gb_h_avg,
            AVG(`net_up_avg`) AS net_up_avg,
            AVG(`net_down_avg`) AS net_down_avg
        FROM `warden_ts_minute`
        WHERE `host_key` = :host_key
          AND `bucket_minute` >= (UTC_TIMESTAMP() - INTERVAL " . WARDEN_FALLBACK_30D_DAYS . " DAY)
        GROUP BY DATE_FORMAT(`bucket_minute`, '%Y-%m-%d %H')
        ORDER BY DATE_FORMAT(`bucket_minute`, '%Y-%m-%d %H') ASC
    ");
    $sysStmt->execute(['host_key' => $hostKey]);
    $history = $sysStmt->fetchAll() ?: [];

    $dbStmt = $pdo->prepare("
        SELECT
            DATE_FORMAT(`bucket_minute`, '%Y-%m-%dT%H:00:00') AS bucket,
            AVG(`qps_avg`) AS qps_avg,
            AVG(`tps_avg`) AS tps_avg,
            AVG(`storage_total_gb_avg`) AS storage_total_gb_avg,
            AVG(`storage_growth_gb_h_avg`) AS storage_growth_gb_h_avg,
            AVG(`threads_running_avg`) AS threads_running_avg,
            MAX(`threads_running_max`) AS threads_running_max,
            AVG(`threads_connected_avg`) AS threads_connected_avg
        FROM `warden_ts_minute`
        WHERE `host_key` = :host_key
          AND `bucket_minute` >= (UTC_TIMESTAMP() - INTERVAL " . WARDEN_FALLBACK_30D_DAYS . " DAY)
        GROUP BY DATE_FORMAT(`bucket_minute`, '%Y-%m-%d %H')
        ORDER BY DATE_FORMAT(`bucket_minute`, '%Y-%m-%d %H') ASC
    ");
    $dbStmt->execute(['host_key' => $hostKey]);
    $dbHistory = $dbStmt->fetchAll() ?: [];

    return [
        'history' => $history,
        'db' => $dbHistory,
    ];
}

function warden_storage_meta(): array
{
    try {
        warden_db_ensure_schema();
        $pdo = warden_db_warden();
        return [
            'last_janitor_at' => warden_state_get($pdo, 'last_janitor_at'),
            'last_ingested_snapshot' => warden_state_get($pdo, 'last_ingested_snapshot'),
            'last_ingested_generated_at' => warden_state_get($pdo, 'last_ingested_generated_at'),
        ];
    } catch (Throwable $e) {
        return [
            'last_janitor_at' => null,
            'last_ingested_snapshot' => null,
            'last_ingested_generated_at' => null,
        ];
    }
}

function warden_normalize_app_role(string $value): string
{
    $role = strtolower(trim($value));
    if ($role === 'user') $role = 'viewer';
    return in_array($role, ['admin', 'editor', 'viewer'], true) ? $role : 'viewer';
}

function warden_normalize_global_tier(string $value): string
{
    $tier = strtolower(trim($value));
    return $tier === 'global_admin' ? 'global_admin' : 'member';
}

function warden_fetch_central_permission(string $username): array
{
    $perm = maiatron_authz_fetch_permission(warden_db_auth(), $username, WARDEN_API_APP_KEY);
    return [
        'isAllowed' => !empty($perm['isAllowed']),
        'appRole' => warden_normalize_app_role((string)($perm['appRole'] ?? 'viewer')),
        'source' => (string)($perm['source'] ?? ''),
        'globalTier' => warden_normalize_global_tier((string)($perm['globalTier'] ?? 'member')),
        'userType' => (string)($perm['userType'] ?? 'standard'),
        'accessExpiresAt' => $perm['accessExpiresAt'] ?? null,
        'scopes' => is_array($perm['scopes'] ?? null) ? $perm['scopes'] : [],
    ];
}

function warden_require_auth(): array
{
    maiatron_auth_session_start();
    $sess = maiatron_auth_session_get_raw(true);
    if (!$sess || empty($sess['username'])) {
        warden_json_error('not_authenticated', 'Sessão expirada. Faça login novamente.', 401);
    }

    $username = (string)$sess['username'];
    try {
        $perm = warden_fetch_central_permission($username);
    } catch (Throwable $e) {
        error_log('[Warden API] central authz lookup failed: ' . $e->getMessage());
        warden_json_error('server_error', 'Falha ao validar permissões centrais.', 500);
    }

    if (empty($perm['isAllowed'])) {
        warden_json_error('forbidden', 'Permissão negada para aceder ao Warden.', 403);
    }

    return [
        'username' => $username,
        'appRole' => warden_normalize_app_role((string)($perm['appRole'] ?? 'viewer')),
        'globalTier' => warden_normalize_global_tier((string)($perm['globalTier'] ?? 'member')),
        'userType' => (string)($perm['userType'] ?? 'standard'),
        'permissionSource' => (string)($perm['source'] ?? 'unknown'),
    ];
}

function warden_source_path(): string
{
    $env = trim((string)(getenv('WARDEN_SOURCE_PATH') ?: ''));
    if ($env !== '') return $env;
    $legacy = trim((string)(getenv('MAIATRON_WARDEN_FULL_SNAPSHOT_PATH') ?: ''));
    if ($legacy !== '') return $legacy;
    $repoPath = '/opt/maiatron/Warden/runtime/export/warden_payload.json';
    if (is_file($repoPath) && is_readable($repoPath)) return $repoPath;
    return __DIR__ . '/warden_payload.json';
}

function warden_path_join(string $dir, string $file): string
{
    return rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . ltrim($file, '/\\');
}

function warden_fast_source_path(): string
{
    $env = trim((string)(getenv('WARDEN_FAST_SOURCE_PATH') ?: ''));
    if ($env !== '') return $env;
    $legacy = trim((string)(getenv('MAIATRON_WARDEN_FAST_SNAPSHOT_PATH') ?: ''));
    if ($legacy !== '') return $legacy;
    $repoPath = '/opt/maiatron/Warden/runtime/export/warden_fast_snapshot.json';
    if (is_file($repoPath) && is_readable($repoPath)) return $repoPath;
    return warden_path_join(dirname(warden_source_path()), 'warden_fast_snapshot.json');
}

function warden_heavy_source_path(): string
{
    $env = trim((string)(getenv('WARDEN_HEAVY_SOURCE_PATH') ?: ''));
    if ($env !== '') return $env;
    $legacy = trim((string)(getenv('MAIATRON_WARDEN_HEAVY_SNAPSHOT_PATH') ?: ''));
    if ($legacy !== '') return $legacy;
    $repoPath = '/opt/maiatron/Warden/runtime/export/warden_heavy_snapshot.json';
    if (is_file($repoPath) && is_readable($repoPath)) return $repoPath;
    return warden_path_join(dirname(warden_source_path()), 'warden_heavy_snapshot.json');
}

function warden_cache_dir(): string
{
    $env = trim((string)(getenv('MAIATRON_WARDEN_CACHE_DIR') ?: ''));
    $dir = $env !== '' ? $env : (rtrim(sys_get_temp_dir(), '/\\') . '/maiatron_warden_api_cache');
    if (!is_dir($dir)) {
        @mkdir($dir, 0770, true);
    }
    return $dir;
}

function warden_cache_key_for_source(array $stat): string
{
    return sha1(($stat['realpath'] ?? $stat['path']) . '|' . (string)$stat['mtime'] . '|' . (string)$stat['size']);
}

function warden_source_stat(string $path): ?array
{
    clearstatcache(true, $path);
    if (!is_file($path) || !is_readable($path)) return null;
    $st = @stat($path);
    if (!is_array($st)) return null;
    return [
        'path' => $path,
        'realpath' => realpath($path) ?: $path,
        'mtime' => (int)($st['mtime'] ?? time()),
        'size' => (int)($st['size'] ?? 0),
    ];
}

function warden_cache_file(string $name): string
{
    return rtrim(warden_cache_dir(), '/\\') . '/' . $name;
}

function warden_read_json_file(string $path): ?array
{
    if (!is_file($path) || !is_readable($path)) return null;
    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '') return null;
    $data = json_decode($raw, true);
    if (!is_array($data)) return null;
    return $data;
}

function warden_payload_generated_at(array $payload): ?string
{
    $generated = trim((string)($payload['generated_at'] ?? ''));
    if ($generated !== '') return $generated;
    $ts = trim((string)($payload['current']['timestamp'] ?? ''));
    return $ts !== '' ? $ts : null;
}

function warden_payload_sample_at(array $payload): ?string
{
    $sampleAt = trim((string)($payload['current']['timestamp'] ?? ''));
    if ($sampleAt !== '') return $sampleAt;
    return warden_payload_generated_at($payload);
}

function warden_build_manifest_for_dedicated_snapshots(array $fastPayload, array $heavyPayload, array $fastStat, array $heavyStat): array
{
    $cacheKey = sha1(
        'dedicated|'
        . ($fastStat['realpath'] ?? $fastStat['path']) . '|'
        . (string)$fastStat['mtime'] . '|'
        . (string)$fastStat['size'] . '|'
        . ($heavyStat['realpath'] ?? $heavyStat['path']) . '|'
        . (string)$heavyStat['mtime'] . '|'
        . (string)$heavyStat['size']
    );
    $etagBase = 'wdr-ded-' . $cacheKey;

    $fastGenerated = warden_payload_generated_at($fastPayload);
    $heavyGenerated = warden_payload_generated_at($heavyPayload) ?? $fastGenerated;
    $sampleFast = warden_payload_sample_at($fastPayload) ?? $fastGenerated;
    $sampleHeavy = warden_payload_sample_at($heavyPayload) ?? $heavyGenerated;
    $fullGenerated = $fastGenerated ?? $heavyGenerated;

    return [
        'schema_version' => WARDEN_API_SCHEMA_VERSION,
        'cache_key' => $cacheKey,
        'source' => [
            'fast_path' => $fastStat['path'],
            'fast_mtime' => (int)$fastStat['mtime'],
            'fast_size' => (int)$fastStat['size'],
            'heavy_path' => $heavyStat['path'],
            'heavy_mtime' => (int)$heavyStat['mtime'],
            'heavy_size' => (int)$heavyStat['size'],
        ],
        'generated_at' => $fullGenerated,
        'stream_generated_at' => [
            'fast' => $fastGenerated,
            'heavy' => $heavyGenerated,
            'full' => $fullGenerated,
        ],
        'sample_at' => [
            'fast' => $sampleFast,
            'heavy' => $sampleHeavy,
            'full' => $fullGenerated,
        ],
        'built_at' => gmdate('c'),
        'etags' => [
            'fast' => '"' . $etagBase . '-fast"',
            'heavy' => '"' . $etagBase . '-heavy"',
            'full' => '"' . $etagBase . '-full"',
        ],
        'snapshot_ids' => [
            'fast' => 'ded-fast-' . substr($cacheKey, 0, 12),
            'heavy' => 'ded-heavy-' . substr($cacheKey, 0, 12),
            'full' => 'ded-full-' . substr($cacheKey, 0, 12),
        ],
    ];
}

function warden_dedicated_source_meta(string $fastSourcePath, array $fastStat, array $heavyStat): array
{
    return [
        'path' => $fastSourcePath,
        'mtime' => max((int)$fastStat['mtime'], (int)$heavyStat['mtime']),
        'size' => ((int)$fastStat['size'] + (int)$heavyStat['size']),
    ];
}

function warden_dedicated_cache_key(array $manifest, array $fastStat, array $heavyStat): string
{
    $manifestKey = trim((string)($manifest['cache_key'] ?? ''));
    if ($manifestKey !== '') {
        return $manifestKey;
    }
    return sha1(
        ($fastStat['realpath'] ?? $fastStat['path']) . '|'
        . (string)$fastStat['mtime'] . '|'
        . (string)$fastStat['size'] . '|'
        . ($heavyStat['realpath'] ?? $heavyStat['path']) . '|'
        . (string)$heavyStat['mtime'] . '|'
        . (string)$heavyStat['size']
    );
}

function warden_merge_dedicated_payloads(array $fastPayload, array $heavyPayload, array $manifest): array
{
    $merged = [];
    $fc = is_array($fastPayload['current'] ?? null) ? $fastPayload['current'] : [];
    $hc = is_array($heavyPayload['current'] ?? null) ? $heavyPayload['current'] : [];
    $dbFast = is_array($fastPayload['db'] ?? null) ? $fastPayload['db'] : [];
    $dbHeavy = is_array($heavyPayload['db'] ?? null) ? $heavyPayload['db'] : [];
    $alertsFast = is_array($fastPayload['alerts'] ?? null) ? $fastPayload['alerts'] : [];
    $alertsHeavy = is_array($heavyPayload['alerts'] ?? null) ? $heavyPayload['alerts'] : [];
    $diskFast = is_array($fc['disk'] ?? null) ? $fc['disk'] : [];
    $diskHeavy = is_array($hc['disk'] ?? null) ? $hc['disk'] : [];

    $merged['generated_at'] = $manifest['stream_generated_at']['full']
        ?? ($fastPayload['generated_at'] ?? ($heavyPayload['generated_at'] ?? null));
    $merged['current'] = [
        'cpu' => $fc['cpu'] ?? null,
        'memory' => $fc['memory'] ?? null,
        'network' => $fc['network'] ?? null,
        'timestamp' => $fc['timestamp'] ?? null,
        'host' => $fc['host'] ?? ($hc['host'] ?? null),
        'processes' => array_replace(
            is_array($hc['processes'] ?? null) ? $hc['processes'] : [],
            is_array($fc['processes'] ?? null) ? $fc['processes'] : []
        ),
        'disk' => array_replace($diskHeavy, $diskFast),
    ];
    $merged['db'] = [
        'current' => $dbFast['current'] ?? ($dbHeavy['current'] ?? null),
        'history' => $dbHeavy['history'] ?? ($dbFast['history'] ?? []),
    ];
    $merged['alerts'] = [
        'current' => $alertsFast['current'] ?? ($alertsHeavy['current'] ?? []),
        'summary' => $alertsFast['summary'] ?? ($alertsHeavy['summary'] ?? []),
        'history_recent' => $alertsHeavy['history_recent'] ?? ($alertsFast['history_recent'] ?? []),
    ];
    $merged['realtime'] = $fastPayload['realtime'] ?? [];
    foreach (['history', 'history_1h', 'history_24h', 'history_7d', 'history_30d'] as $k) {
        if (array_key_exists($k, $heavyPayload)) {
            $merged[$k] = $heavyPayload[$k];
        }
    }
    $merged['meta'] = [
        'kind' => 'full',
        'schema_version' => WARDEN_API_SCHEMA_VERSION,
        'source' => 'dedicated_snapshots',
    ];
    return $merged;
}

function warden_write_atomic(string $path, string $contents): void
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0770, true) && !is_dir($dir)) {
            throw new RuntimeException('Cannot create cache dir: ' . $dir);
        }
    }
    $tmp = $path . '.tmp-' . getmypid() . '-' . bin2hex(random_bytes(4));
    $written = @file_put_contents($tmp, $contents, LOCK_EX);
    if ($written === false) {
        @unlink($tmp);
        throw new RuntimeException('Cannot write cache temp file: ' . $tmp);
    }
    @chmod($tmp, 0660);
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Cannot move cache temp file into place: ' . $path);
    }
}

function warden_write_json_atomic(string $path, array $data): void
{
    warden_write_atomic($path, (string)json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function warden_sanitize_realtime_row(array $row): array
{
    return [
        'timestamp' => $row['timestamp'] ?? null,
        'cpu' => [
            'total_percent' => $row['cpu']['total_percent'] ?? null,
        ],
        'memory' => [
            'percent' => $row['memory']['percent'] ?? null,
        ],
        'disk' => [
            'percent' => $row['disk']['percent'] ?? null,
            'read_mb_s' => $row['disk']['read_mb_s'] ?? null,
            'write_mb_s' => $row['disk']['write_mb_s'] ?? null,
        ],
        'network' => [
            'upload_mbps' => $row['network']['upload_mbps'] ?? null,
            'download_mbps' => $row['network']['download_mbps'] ?? null,
            'packets_sent' => $row['network']['packets_sent'] ?? null,
            'packets_recv' => $row['network']['packets_recv'] ?? null,
        ],
    ];
}

function warden_sanitize_db_current($row): array
{
    $db = is_array($row) ? $row : [];
    $topSchemas = [];
    foreach ((array)($db['top_schemas'] ?? []) as $item) {
        if (!is_array($item)) continue;
        $topSchemas[] = [
            'schema' => $item['schema'] ?? null,
            'total_bytes' => $item['total_bytes'] ?? null,
            'total_gb' => $item['total_gb'] ?? null,
            'growth_gb_h' => $item['growth_gb_h'] ?? null,
        ];
    }
    $topTables = [];
    foreach ((array)($db['top_tables'] ?? []) as $item) {
        if (!is_array($item)) continue;
        $topTables[] = [
            'schema' => $item['schema'] ?? null,
            'table' => $item['table'] ?? null,
            'total_bytes' => $item['total_bytes'] ?? null,
            'total_gb' => $item['total_gb'] ?? null,
            'growth_gb_h' => $item['growth_gb_h'] ?? null,
        ];
    }
    return [
        'sampled_at' => $db['sampled_at'] ?? null,
        'qps' => $db['qps'] ?? null,
        'tps' => $db['tps'] ?? null,
        'storage_total_bytes' => $db['storage_total_bytes'] ?? null,
        'storage_total_gb' => $db['storage_total_gb'] ?? null,
        'storage_growth_gb_h' => $db['storage_growth_gb_h'] ?? null,
        'storage_write_gb_h' => $db['storage_write_gb_h'] ?? null,
        'threads_running' => $db['threads_running'] ?? null,
        'threads_connected' => $db['threads_connected'] ?? null,
        'top_schemas' => $topSchemas,
        'top_tables' => $topTables,
    ];
}

function warden_sanitize_db_history_rows($rows): array
{
    $out = [];
    foreach ((array)$rows as $row) {
        if (!is_array($row)) continue;
        $out[] = [
            'bucket' => $row['bucket'] ?? null,
            'qps_avg' => $row['qps_avg'] ?? null,
            'tps_avg' => $row['tps_avg'] ?? null,
            'storage_total_bytes_avg' => $row['storage_total_bytes_avg'] ?? null,
            'storage_total_gb_avg' => $row['storage_total_gb_avg'] ?? null,
            'storage_growth_gb_h_avg' => $row['storage_growth_gb_h_avg'] ?? null,
            'threads_running_avg' => $row['threads_running_avg'] ?? null,
            'threads_running_max' => $row['threads_running_max'] ?? null,
            'threads_connected_avg' => $row['threads_connected_avg'] ?? null,
        ];
    }
    return $out;
}

function warden_sanitize_db_history_map($historyMap): array
{
    $map = is_array($historyMap) ? $historyMap : [];
    foreach ($map as $window => $rows) {
        $map[$window] = warden_sanitize_db_history_rows($rows);
    }
    return $map;
}

function warden_alerts_summary(array $alerts): array
{
    $summary = $alerts['summary'] ?? null;
    if (is_array($summary)) return $summary;
    $current = array_values(array_filter((array)($alerts['current'] ?? []), static fn($a) => is_array($a)));
    $firing = array_values(array_filter($current, static fn($a) => (($a['status'] ?? '') === 'firing')));
    $critical = 0;
    $warning = 0;
    foreach ($firing as $row) {
        $sev = (string)($row['severity'] ?? '');
        if ($sev === 'critical') $critical++;
        elseif ($sev === 'warning') $warning++;
    }
    return [
        'firing_total' => count($firing),
        'critical' => $critical,
        'warning' => $warning,
    ];
}

function warden_build_fast_payload(array $full): array
{
    $current = is_array($full['current'] ?? null) ? $full['current'] : [];
    $disk = is_array($current['disk'] ?? null) ? $current['disk'] : [];
    unset($disk['top_consumers']);

    $alerts = is_array($full['alerts'] ?? null) ? $full['alerts'] : [];
    $realtime = [];
    foreach ((array)($full['realtime'] ?? []) as $row) {
        if (!is_array($row)) continue;
        $realtime[] = warden_sanitize_realtime_row($row);
    }

    return [
        'generated_at' => $full['generated_at'] ?? null,
        'current' => [
            'cpu' => $current['cpu'] ?? null,
            'memory' => $current['memory'] ?? null,
            'disk' => $disk,
            'network' => $current['network'] ?? null,
            'timestamp' => $current['timestamp'] ?? null,
            'host' => $current['host'] ?? null,
        ],
        'db' => [
            'current' => warden_sanitize_db_current($full['db']['current'] ?? null),
        ],
        'alerts' => [
            'current' => $alerts['current'] ?? [],
            'summary' => warden_alerts_summary($alerts),
        ],
        'realtime' => $realtime,
        'meta' => [
            'kind' => 'fast',
            'schema_version' => WARDEN_API_SCHEMA_VERSION,
        ],
    ];
}

function warden_build_heavy_payload(array $full): array
{
    $current = is_array($full['current'] ?? null) ? $full['current'] : [];
    $disk = is_array($current['disk'] ?? null) ? $current['disk'] : [];
    $alerts = is_array($full['alerts'] ?? null) ? $full['alerts'] : [];
    $db = is_array($full['db'] ?? null) ? $full['db'] : [];
    $historyMap = is_array($full['history'] ?? null) ? $full['history'] : [];
    $dbHistoryMap = warden_sanitize_db_history_map($db['history'] ?? []);
    $hist30d = [];
    if (isset($historyMap['30d']) && is_array($historyMap['30d'])) {
        $hist30d = $historyMap['30d'];
    } elseif (isset($full['history_30d']) && is_array($full['history_30d'])) {
        $hist30d = $full['history_30d'];
    }
    $db30d = [];
    if (isset($dbHistoryMap['30d']) && is_array($dbHistoryMap['30d'])) {
        $db30d = $dbHistoryMap['30d'];
    }
    if (!$hist30d || !$db30d) {
        $hostKey = warden_host_key_from_payload($full);
        try {
            $series = warden_fetch_30d_series_from_db($hostKey);
            if (!$hist30d) {
                $hist30d = is_array($series['history'] ?? null) ? $series['history'] : [];
            }
            if (!$db30d) {
                $db30d = is_array($series['db'] ?? null) ? $series['db'] : [];
            }
        } catch (Throwable $e) {
            // Keep payload resilient. The caller still gets the remaining heavy snapshot.
        }
    }
    $historyMap['30d'] = $hist30d;
    $dbHistoryMap['30d'] = warden_sanitize_db_history_rows($db30d);

    return [
        'generated_at' => $full['generated_at'] ?? null,
        'current' => [
            'host' => $current['host'] ?? null,
            'processes' => $current['processes'] ?? null,
            'disk' => [
                'top_consumers' => $disk['top_consumers'] ?? null,
            ],
        ],
        'history' => $historyMap,
        'history_1h' => $full['history_1h'] ?? null,
        'history_24h' => $full['history_24h'] ?? null,
        'history_7d' => $full['history_7d'] ?? null,
        'history_30d' => $hist30d,
        'db' => [
            'history' => $dbHistoryMap,
        ],
        'alerts' => [
            'history_recent' => $alerts['history_recent'] ?? [],
        ],
        'meta' => [
            'kind' => 'heavy',
            'schema_version' => WARDEN_API_SCHEMA_VERSION,
        ],
    ];
}

function warden_current_split_cache(array $sourceStat): array
{
    $cacheKey = warden_cache_key_for_source($sourceStat);
    $manifestPath = warden_cache_file('manifest-' . $cacheKey . '.json');
    $fastPath = warden_cache_file('fast-' . $cacheKey . '.json');
    $heavyPath = warden_cache_file('heavy-' . $cacheKey . '.json');

    $manifest = warden_read_json_file($manifestPath);
    if ($manifest
        && (int)($manifest['schema_version'] ?? 0) === WARDEN_API_SCHEMA_VERSION
        && (int)($manifest['source']['mtime'] ?? -1) === (int)$sourceStat['mtime']
        && (int)($manifest['source']['size'] ?? -1) === (int)$sourceStat['size']
        && is_file($fastPath)
        && is_file($heavyPath)
    ) {
        return [
            'cacheKey' => $cacheKey,
            'manifest' => $manifest,
            'fastPath' => $fastPath,
            'heavyPath' => $heavyPath,
            'fromCache' => true,
        ];
    }

    $raw = @file_get_contents($sourceStat['path']);
    if (!is_string($raw) || $raw === '') {
        throw new RuntimeException('Snapshot source unreadable');
    }
    $full = json_decode($raw, true);
    if (!is_array($full)) {
        throw new RuntimeException('Snapshot source JSON inválido');
    }

    // Ingest a lightweight time-series snapshot once per source snapshot key.
    warden_ingest_snapshot($full, $sourceStat, $cacheKey);
    // Opportunistic janitor (throttled by WARDEN_JANITOR_EVERY_SECONDS).
    warden_run_janitor_if_due(false);

    $generatedAt = (string)($full['generated_at'] ?? ($full['current']['timestamp'] ?? ''));
    $fast = warden_build_fast_payload($full);
    $heavy = warden_build_heavy_payload($full);
    $fastGeneratedAt = (string)($fast['generated_at'] ?? $generatedAt);
    $heavyGeneratedAt = (string)($heavy['generated_at'] ?? $generatedAt);
    $fastSampleAt = (string)(warden_payload_sample_at($fast) ?? $fastGeneratedAt);
    $heavySampleAt = (string)(warden_payload_sample_at($heavy) ?? $heavyGeneratedAt);
    $fullSampleAt = (string)(warden_payload_sample_at($full) ?? $generatedAt);

    $etagBase = 'wdr-' . $cacheKey;
    $manifest = [
        'schema_version' => WARDEN_API_SCHEMA_VERSION,
        'cache_key' => $cacheKey,
        'source' => [
            'path' => $sourceStat['path'],
            'mtime' => $sourceStat['mtime'],
            'size' => $sourceStat['size'],
        ],
        'generated_at' => $generatedAt !== '' ? $generatedAt : null,
        'stream_generated_at' => [
            'fast' => $fastGeneratedAt !== '' ? $fastGeneratedAt : null,
            'heavy' => $heavyGeneratedAt !== '' ? $heavyGeneratedAt : null,
            'full' => $generatedAt !== '' ? $generatedAt : null,
        ],
        'sample_at' => [
            'fast' => $fastSampleAt !== '' ? $fastSampleAt : null,
            'heavy' => $heavySampleAt !== '' ? $heavySampleAt : null,
            'full' => $fullSampleAt !== '' ? $fullSampleAt : null,
        ],
        'built_at' => gmdate('c'),
        'etags' => [
            'fast' => '"' . $etagBase . '-fast"',
            'heavy' => '"' . $etagBase . '-heavy"',
            'full' => '"' . $etagBase . '-full"',
        ],
        'snapshot_ids' => [
            'fast' => ($generatedAt !== '' ? preg_replace('/[^0-9A-Za-z]+/', '', $generatedAt) : ('mtime' . $sourceStat['mtime'])) . '-fast-' . substr($cacheKey, 0, 8),
            'heavy' => ($generatedAt !== '' ? preg_replace('/[^0-9A-Za-z]+/', '', $generatedAt) : ('mtime' . $sourceStat['mtime'])) . '-heavy-' . substr($cacheKey, 0, 8),
            'full' => ($generatedAt !== '' ? preg_replace('/[^0-9A-Za-z]+/', '', $generatedAt) : ('mtime' . $sourceStat['mtime'])) . '-full-' . substr($cacheKey, 0, 8),
        ],
    ];

    warden_write_json_atomic($fastPath, $fast);
    warden_write_json_atomic($heavyPath, $heavy);
    warden_write_json_atomic($manifestPath, $manifest);

    // Last valid fallback snapshots (aliases)
    warden_write_json_atomic(warden_cache_file('last_fast.json'), $fast);
    warden_write_json_atomic(warden_cache_file('last_heavy.json'), $heavy);
    warden_write_json_atomic(warden_cache_file('last_manifest.json'), $manifest);
    warden_write_atomic(warden_cache_file('last_full.json'), $raw);

    return [
        'cacheKey' => $cacheKey,
        'manifest' => $manifest,
        'fastPath' => $fastPath,
        'heavyPath' => $heavyPath,
        'fromCache' => false,
    ];
}

function warden_load_split_data(): array
{
    $fastSourcePath = warden_fast_source_path();
    $heavySourcePath = warden_heavy_source_path();
    $fastStat = warden_source_stat($fastSourcePath);
    $heavyStat = warden_source_stat($heavySourcePath);
    if ($fastStat && $heavyStat) {
        $fastPayload = warden_read_json_file($fastSourcePath);
        $heavyPayload = warden_read_json_file($heavySourcePath);
        if ($fastPayload && $heavyPayload) {
            $manifest = warden_build_manifest_for_dedicated_snapshots($fastPayload, $heavyPayload, $fastStat, $heavyStat);
            $sourceMeta = warden_dedicated_source_meta($fastSourcePath, $fastStat, $heavyStat);
            $cacheKey = warden_dedicated_cache_key($manifest, $fastStat, $heavyStat);

            try {
                // Keep Warden DB series/alerts ingest active even in dedicated split mode.
                $fullPayload = warden_merge_dedicated_payloads($fastPayload, $heavyPayload, $manifest);
                warden_ingest_snapshot($fullPayload, $sourceMeta, $cacheKey);
                warden_run_janitor_if_due(false);
            } catch (Throwable $e) {
                error_log('[Warden API] dedicated ingest failed: ' . $e->getMessage());
            }

            return [
                'ok' => true,
                'stale' => false,
                'source' => $sourceMeta,
                'cacheKey' => $cacheKey,
                'manifest' => $manifest,
                'fastPath' => $fastSourcePath,
                'heavyPath' => $heavySourcePath,
                'fromCache' => true,
                'sourceMode' => 'dedicated_snapshots',
            ];
        }
    }

    $sourcePath = warden_source_path();
    $sourceStat = warden_source_stat($sourcePath);
    if ($sourceStat) {
        try {
            return ['ok' => true, 'stale' => false, 'source' => $sourceStat] + warden_current_split_cache($sourceStat);
        } catch (Throwable $e) {
            error_log('[Warden API] split cache rebuild failed: ' . $e->getMessage());
        }
    }

    $manifest = warden_read_json_file(warden_cache_file('last_manifest.json'));
    $fastPath = warden_cache_file('last_fast.json');
    $heavyPath = warden_cache_file('last_heavy.json');
    if ($manifest && is_file($fastPath) && is_file($heavyPath)) {
        return [
            'ok' => true,
            'stale' => true,
            'source' => $sourceStat ?: ['path' => $sourcePath, 'mtime' => time(), 'size' => 0],
            'cacheKey' => (string)($manifest['cache_key'] ?? 'fallback'),
            'manifest' => $manifest,
            'fastPath' => $fastPath,
            'heavyPath' => $heavyPath,
            'fromCache' => true,
            'fallbackReason' => $sourceStat ? 'rebuild_failed' : 'source_missing',
        ];
    }

    throw new RuntimeException('Sem snapshot Warden válido disponível');
}

function warden_load_full_payload(bool &$staleOut = false, ?array &$metaOut = null): array
{
    $fastSourcePath = warden_fast_source_path();
    $heavySourcePath = warden_heavy_source_path();
    $fastStat = warden_source_stat($fastSourcePath);
    $heavyStat = warden_source_stat($heavySourcePath);
    if ($fastStat && $heavyStat) {
        $fastPayload = warden_read_json_file($fastSourcePath);
        $heavyPayload = warden_read_json_file($heavySourcePath);
        if (is_array($fastPayload) && is_array($heavyPayload)) {
            $manifest = warden_build_manifest_for_dedicated_snapshots($fastPayload, $heavyPayload, $fastStat, $heavyStat);
            $merged = warden_merge_dedicated_payloads($fastPayload, $heavyPayload, $manifest);
            $sourceMeta = warden_dedicated_source_meta($fastSourcePath, $fastStat, $heavyStat);
            $cacheKey = warden_dedicated_cache_key($manifest, $fastStat, $heavyStat);
            $etag = (string)($manifest['etags']['full'] ?? ('"wdr-ded-' . $cacheKey . '-full"'));
            if ($etag !== '' && $etag[0] !== '"') {
                $etag = '"' . trim($etag, "\" \t\r\n") . '"';
            }

            $metaOut = [
                'source' => $sourceMeta,
                'cache_key' => $cacheKey,
                'etag' => $etag,
            ];
            $staleOut = false;

            // refresh alias best-effort
            try {
                $rawMerged = json_encode($merged, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if (is_string($rawMerged) && $rawMerged !== '') {
                    warden_write_atomic(warden_cache_file('last_full.json'), $rawMerged);
                }
            } catch (Throwable $e) {}

            return $merged;
        }
    }

    $sourcePath = warden_source_path();
    $sourceStat = warden_source_stat($sourcePath);
    if ($sourceStat) {
        $raw = @file_get_contents($sourcePath);
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $metaOut = [
                    'source' => $sourceStat,
                    'cache_key' => warden_cache_key_for_source($sourceStat),
                    'etag' => '"wdr-' . warden_cache_key_for_source($sourceStat) . '-full"',
                ];
                $staleOut = false;
                // refresh alias best-effort
                try { warden_write_atomic(warden_cache_file('last_full.json'), $raw); } catch (Throwable $e) {}
                return $decoded;
            }
        }
    }

    $aliasPath = warden_cache_file('last_full.json');
    $raw = @file_get_contents($aliasPath);
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $staleOut = true;
            $mtime = is_file($aliasPath) ? ((int)(@filemtime($aliasPath) ?: time())) : time();
            $size = strlen($raw);
            $metaOut = [
                'source' => ['path' => $aliasPath, 'mtime' => $mtime, 'size' => $size],
                'cache_key' => 'alias-' . sha1((string)$mtime . '|' . (string)$size),
                'etag' => '"wdr-alias-full-' . $mtime . '-' . $size . '"',
            ];
            return $decoded;
        }
    }

    throw new RuntimeException('Snapshot full indisponível');
}

function warden_stream_headers_from_manifest(array $manifest, string $kind, array $source, bool $stale): array
{
    $etag = (string)($manifest['etags'][$kind] ?? '');
    $sourceMeta = is_array($manifest['source'] ?? null) ? $manifest['source'] : [];
    $streamMtime = (int)($sourceMeta[$kind . '_mtime'] ?? 0);
    $mtime = $streamMtime > 0 ? $streamMtime : (int)($source['mtime'] ?? time());
    $sampleAt = (string)($manifest['sample_at'][$kind] ?? ($manifest['stream_generated_at'][$kind] ?? ($manifest['generated_at'] ?? '')));
    $headers = [
        'ETag' => $etag !== '' ? $etag : ('"wdr-' . $kind . '-' . $mtime . '"'),
        'Last-Modified' => warden_http_date_from_timestamp($mtime),
        'X-Warden-Stale' => $stale ? '1' : '0',
    ];
    if (trim($sampleAt) !== '') {
        $headers['X-Warden-Sample-At'] = trim($sampleAt);
    }
    return $headers;
}

function warden_meta_payload(array $split, ?array $fullMeta = null, bool $fullStale = false): array
{
    $manifest = $split['manifest'];
    $source = $split['source'];
    $streamGenerated = is_array($manifest['stream_generated_at'] ?? null) ? $manifest['stream_generated_at'] : [];
    $sampleAt = is_array($manifest['sample_at'] ?? null) ? $manifest['sample_at'] : [];

    $generatedAt = (string)($manifest['generated_at'] ?? '');
    $generatedFast = (string)($streamGenerated['fast'] ?? $generatedAt);
    $generatedHeavy = (string)($streamGenerated['heavy'] ?? $generatedAt);
    $sampleFast = (string)($sampleAt['fast'] ?? $generatedFast);
    $sampleHeavy = (string)($sampleAt['heavy'] ?? $generatedHeavy);
    $ageFast = warden_age_ms($sampleFast !== '' ? $sampleFast : ($generatedFast !== '' ? $generatedFast : null), (int)$source['mtime']);
    $ageHeavy = warden_age_ms($sampleHeavy !== '' ? $sampleHeavy : ($generatedHeavy !== '' ? $generatedHeavy : null), (int)$source['mtime']);

    $fullSource = $fullMeta['source'] ?? $source;
    $fullGeneratedAt = (string)($streamGenerated['full'] ?? $generatedAt);
    $fullAge = warden_age_ms($fullGeneratedAt !== '' ? $fullGeneratedAt : null, (int)($fullSource['mtime'] ?? time()));

    $storageMeta = warden_storage_meta();

    return [
        'fast' => [
            'generated_at' => $generatedFast !== '' ? $generatedFast : null,
            'age_ms' => $ageFast,
            'stale' => ($split['stale'] ?? false) || $ageFast > WARDEN_FAST_STALE_MS,
            'etag' => $manifest['etags']['fast'] ?? null,
            'sample_at' => $sampleFast !== '' ? $sampleFast : null,
        ],
        'heavy' => [
            'generated_at' => $generatedHeavy !== '' ? $generatedHeavy : null,
            'age_ms' => $ageHeavy,
            'stale' => ($split['stale'] ?? false) || $ageHeavy > WARDEN_HEAVY_STALE_MS,
            'etag' => $manifest['etags']['heavy'] ?? null,
            'sample_at' => $sampleHeavy !== '' ? $sampleHeavy : null,
        ],
        'full' => [
            'generated_at' => $fullGeneratedAt !== '' ? $fullGeneratedAt : null,
            'age_ms' => $fullAge,
            'stale' => $fullStale || $fullAge > WARDEN_FULL_STALE_MS,
            'etag' => $fullMeta['etag'] ?? ($manifest['etags']['full'] ?? null),
        ],
        'sample_age_ms_fast' => $ageFast,
        'sample_age_ms_heavy' => $ageHeavy,
        'collector' => [
            'mode' => 'snapshot',
            'api_collects' => false,
        ],
        'retention_days' => WARDEN_RETENTION_DAYS,
        'storage' => $storageMeta,
    ];
}

function warden_public_actions(): array
{
    return ['ops_fast', 'ops_heavy'];
}

function warden_build_ops_fast_payload(array $payload): array
{
    $alertsCurrent = array_values(array_filter((array)($payload['alerts']['current'] ?? []), static fn($a) => is_array($a)));
    $alertsCurrent = array_slice($alertsCurrent, 0, 6);
    return [
        'generated_at' => $payload['generated_at'] ?? null,
        'current' => [
            'cpu' => $payload['current']['cpu'] ?? null,
            'memory' => $payload['current']['memory'] ?? null,
            'disk' => [
                'percent' => $payload['current']['disk']['percent'] ?? null,
                'read_mb_s' => $payload['current']['disk']['read_mb_s'] ?? null,
                'write_mb_s' => $payload['current']['disk']['write_mb_s'] ?? null,
            ],
            'network' => $payload['current']['network'] ?? null,
            'timestamp' => $payload['current']['timestamp'] ?? null,
        ],
        'db' => [
            'current' => [
                'sampled_at' => $payload['db']['current']['sampled_at'] ?? null,
                'qps' => $payload['db']['current']['qps'] ?? null,
                'tps' => $payload['db']['current']['tps'] ?? null,
                'storage_total_bytes' => $payload['db']['current']['storage_total_bytes'] ?? null,
                'storage_total_gb' => $payload['db']['current']['storage_total_gb'] ?? null,
                'storage_growth_gb_h' => $payload['db']['current']['storage_growth_gb_h'] ?? null,
                'storage_write_gb_h' => $payload['db']['current']['storage_write_gb_h'] ?? null,
                'threads_running' => $payload['db']['current']['threads_running'] ?? null,
                'threads_connected' => $payload['db']['current']['threads_connected'] ?? null,
                'top_schemas' => $payload['db']['current']['top_schemas'] ?? [],
                'top_tables' => $payload['db']['current']['top_tables'] ?? [],
            ],
        ],
        'alerts' => [
            'summary' => $payload['alerts']['summary'] ?? [],
            'current' => array_map(static function (array $a): array {
                return [
                    'key' => $a['key'] ?? null,
                    'title' => $a['title'] ?? null,
                    'severity' => $a['severity'] ?? null,
                    'status' => $a['status'] ?? null,
                    'value' => $a['value'] ?? null,
                    'threshold' => $a['threshold'] ?? null,
                    'sent_at' => $a['sent_at'] ?? null,
                ];
            }, $alertsCurrent),
        ],
        'realtime' => $payload['realtime'] ?? [],
    ];
}

function warden_build_ops_heavy_payload(array $payload): array
{
    $host = is_array($payload['current']['host'] ?? null) ? $payload['current']['host'] : [];
    return [
        'generated_at' => $payload['generated_at'] ?? null,
        'current' => [
            'host' => [
                'hostname' => $host['hostname'] ?? null,
                'os' => $host['os'] ?? null,
                'os_release' => $host['os_release'] ?? null,
                'system_uptime_seconds' => $host['system_uptime_seconds'] ?? null,
            ],
        ],
        'history_1h' => $payload['history_1h'] ?? [],
        'history_24h' => $payload['history_24h'] ?? [],
        'history_7d' => $payload['history_7d'] ?? [],
        'history_30d' => $payload['history_30d'] ?? [],
        'db' => [
            'history' => is_array($payload['db']['history'] ?? null) ? $payload['db']['history'] : [],
        ],
    ];
}

function warden_handle_ops_stream(string $kind): void
{
    try {
        $split = warden_load_split_data();
        $manifest = $split['manifest'];
        $source = $split['source'];
        $baseKind = $kind === 'ops_fast' ? 'fast' : 'heavy';
        $basePath = $baseKind === 'fast' ? $split['fastPath'] : $split['heavyPath'];
        $basePayload = warden_read_json_file($basePath);
        if (!$basePayload) {
            throw new RuntimeException('Cached split payload missing');
        }

        $opsPayload = $kind === 'ops_fast'
            ? warden_build_ops_fast_payload($basePayload)
            : warden_build_ops_heavy_payload($basePayload);

        $baseHeaders = warden_stream_headers_from_manifest($manifest, $baseKind, $source, (bool)$split['stale']);
        $rawEtag = (string)($baseHeaders['ETag'] ?? '');
        $trimmed = trim($rawEtag, "\" \t\r\n");
        $etag = '"' . $trimmed . '-ops"';

        $headers = [
            'ETag' => $etag,
            'Last-Modified' => (string)($baseHeaders['Last-Modified'] ?? warden_http_date_from_timestamp((int)($source['mtime'] ?? time()))),
            'X-Warden-Stale' => (string)($baseHeaders['X-Warden-Stale'] ?? ((bool)$split['stale'] ? '1' : '0')),
        ];
        $sampleHeader = trim((string)($baseHeaders['X-Warden-Sample-At'] ?? ''));
        if ($sampleHeader !== '') {
            $headers['X-Warden-Sample-At'] = $sampleHeader;
        }

        if (warden_etag_matches($etag)) {
            warden_send_304($headers);
        }

        $env = warden_envelope($kind, $opsPayload, [
            'generated_at' => $manifest['stream_generated_at'][$baseKind] ?? ($manifest['generated_at'] ?? ($opsPayload['generated_at'] ?? null)),
            'mtime' => (int)$source['mtime'],
            'stale' => (bool)$split['stale'],
            'stale_threshold_ms' => $baseKind === 'fast' ? WARDEN_FAST_STALE_MS : WARDEN_HEAVY_STALE_MS,
            'etag' => $etag,
            'snapshot_id' => (string)($manifest['snapshot_ids'][$baseKind] ?? ($baseKind . '-' . $split['cacheKey'])) . '-ops',
        ]);
        warden_json_out($env, 200, $headers);
    } catch (RuntimeException $e) {
        $message = strtolower(trim($e->getMessage()));
        if ($message !== '' && str_contains($message, 'snapshot')) {
            warden_json_error('snapshot_unavailable', 'Snapshot Warden indisponível.', 503);
        }
        throw $e;
    }
}

function warden_handle_stream(string $kind): void
{
    $split = warden_load_split_data();
    $manifest = $split['manifest'];
    $source = $split['source'];

    if ($kind === 'meta') {
        $fullStale = false;
        $fullMeta = null;
        try {
            $tmp = false;
            $unused = null;
            warden_load_full_payload($tmp, $unused);
            $fullStale = $tmp;
            $fullMeta = $unused;
        } catch (Throwable $e) {
            $fullStale = true;
            $fullMeta = null;
        }
        $headers = warden_stream_headers_from_manifest($manifest, 'fast', $source, (bool)$split['stale']);
        unset($headers['ETag']);
        $metaPayload = warden_meta_payload($split, $fullMeta, $fullStale);
        $env = warden_envelope('meta', $metaPayload, [
            'generated_at' => $manifest['generated_at'] ?? null,
            'mtime' => (int)$source['mtime'],
            'stale' => (bool)$split['stale'],
            'stale_threshold_ms' => WARDEN_HEAVY_STALE_MS,
            'etag' => '',
            'snapshot_id' => (string)($manifest['snapshot_ids']['heavy'] ?? ('meta-' . $split['cacheKey'])),
        ]);
        warden_json_out($env, 200, $headers);
    }

    if (!in_array($kind, ['fast', 'heavy'], true)) {
        throw new RuntimeException('Invalid stream kind');
    }

    $headers = warden_stream_headers_from_manifest($manifest, $kind, $source, (bool)$split['stale']);
    $etag = (string)($headers['ETag'] ?? '');
    if ($etag !== '' && warden_etag_matches($etag)) {
        warden_send_304($headers);
    }

    $payload = warden_read_json_file($kind === 'fast' ? $split['fastPath'] : $split['heavyPath']);
    if (!$payload) {
        throw new RuntimeException('Cached split payload missing');
    }

    $env = warden_envelope($kind, $payload, [
        'generated_at' => $manifest['stream_generated_at'][$kind] ?? ($manifest['generated_at'] ?? ($payload['generated_at'] ?? null)),
        'mtime' => (int)$source['mtime'],
        'stale' => (bool)$split['stale'],
        'stale_threshold_ms' => $kind === 'fast' ? WARDEN_FAST_STALE_MS : WARDEN_HEAVY_STALE_MS,
        'etag' => $etag,
        'snapshot_id' => (string)($manifest['snapshot_ids'][$kind] ?? ($kind . '-' . $split['cacheKey'])),
    ]);
    warden_json_out($env, 200, $headers);
}

function warden_handle_full(): void
{
    $stale = false;
    $meta = null;
    $payload = warden_load_full_payload($stale, $meta);
    $source = $meta['source'] ?? ['mtime' => time(), 'size' => 0];
    $etag = (string)($meta['etag'] ?? ('"wdr-full-' . ((int)$source['mtime']) . '-' . ((int)$source['size']) . '"'));
    $headers = [
        'ETag' => $etag,
        'Last-Modified' => warden_http_date_from_timestamp((int)($source['mtime'] ?? time())),
        'X-Warden-Stale' => $stale ? '1' : '0',
    ];
    if (warden_etag_matches($etag)) {
        warden_send_304($headers);
    }

    $generatedAt = (string)($payload['generated_at'] ?? ($payload['current']['timestamp'] ?? ''));
    $cacheKey = (string)($meta['cache_key'] ?? ('full-' . sha1((string)($source['mtime'] ?? 0) . '|' . (string)($source['size'] ?? 0))));
    $env = warden_envelope('full', $payload, [
        'generated_at' => $generatedAt !== '' ? $generatedAt : null,
        'mtime' => (int)($source['mtime'] ?? time()),
        'stale' => $stale,
        'stale_threshold_ms' => WARDEN_FULL_STALE_MS,
        'etag' => $etag,
        'snapshot_id' => preg_replace('/[^0-9A-Za-z]+/', '', $generatedAt !== '' ? $generatedAt : ('mtime' . ((int)($source['mtime'] ?? time())))) . '-full-' . substr($cacheKey, 0, 8),
    ]);
    warden_json_out($env, 200, $headers);
}

function warden_dispatch_request(): void
{
    if (warden_request_method() !== 'GET') {
        warden_json_error('method_not_allowed', 'Método não permitido', 405);
    }

    $action = warden_action();
    if (!in_array($action, warden_public_actions(), true)) {
        warden_require_auth();
    }

    if ($action === 'full') {
        warden_handle_full();
    }
    if (in_array($action, ['fast', 'heavy', 'meta'], true)) {
        warden_handle_stream($action);
    }
    if (in_array($action, warden_public_actions(), true)) {
        warden_handle_ops_stream($action);
    }

    warden_json_error('unknown_action', 'Ação inválida', 404);
}

if (!defined('WARDEN_API_NO_DISPATCH') || WARDEN_API_NO_DISPATCH !== true) {
    try {
        warden_dispatch_request();
    } catch (RuntimeException $e) {
        $message = strtolower(trim($e->getMessage()));
        if ($message !== '' && str_contains($message, 'snapshot')) {
            warden_json_error('snapshot_unavailable', 'Snapshot Warden indisponível.', 503);
        }
        error_log('[Warden API] runtime: ' . $e->getMessage());
        warden_json_error('server_error', 'Erro interno no Warden API', 500);
    } catch (Throwable $e) {
        error_log('[Warden API] fatal: ' . $e->getMessage());
        warden_json_error('server_error', 'Erro interno no Warden API', 500);
    }
}
