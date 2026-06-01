<?php
declare(strict_types=1);

/**
 * Finalidade: Biblioteca partilhada de autoriza??o e resolu??o de permiss?es MAIATRON.
 * Depende de: ficheiros e servi?os can?nicos associados a esta responsabilidade.
 * Entradas/Sa?das principais: Recebe pedidos HTTP ou par?metros de execu??o e devolve resposta, efeitos de backend ou dados serializados.
 * Efeitos laterais: Pode ler/escrever sess?o, base de dados, ficheiros locais e cabe?alhos HTTP conforme a opera??o.
 * Rela??o can?nica: Implementa??o can?nica de backend/opera??o; os paths p?blicos limitam-se a delegar para aqui quando necess?rio.
 */
if (!defined('MAIATRON_AUTH_GLOBAL_ADMIN_USERNAME')) {
    define('MAIATRON_AUTH_GLOBAL_ADMIN_USERNAME', getenv('MAIATRON_GLOBAL_ADMIN') ?: 'emanuel.ferreira');
}

// Normalização base: estes helpers garantem que usernames, apps, roles e scopes
// entram em formas previsíveis antes de qualquer decisão de autorização.
if (!function_exists('maiatron_authz_norm_global_tier')) {
    function maiatron_authz_norm_global_tier($value): string
    {
        $tier = strtolower(trim((string)$value));
        return $tier === 'global_admin' ? 'global_admin' : 'member';
    }
}

if (!function_exists('maiatron_authz_norm_user_type')) {
    function maiatron_authz_norm_user_type($value): string
    {
        $type = strtolower(trim((string)$value));
        return $type === 'temp_user' ? 'temp_user' : 'standard';
    }
}

if (!function_exists('maiatron_authz_norm_app_key')) {
    function maiatron_authz_norm_app_key($value): string
    {
        $key = strtolower(trim((string)$value));
        $key = preg_replace('/[^a-z0-9_\-]/', '', $key) ?? '';
        return substr($key, 0, 64);
    }
}

if (!function_exists('maiatron_authz_norm_app_role')) {
    function maiatron_authz_norm_app_role($value): string
    {
        $role = strtolower(trim((string)$value));
        if ($role === 'user') $role = 'viewer';
        if (in_array($role, ['viewer', 'editor', 'admin'], true)) {
            return $role;
        }
        return 'viewer';
    }
}

if (!function_exists('maiatron_authz_norm_scope_key')) {
    function maiatron_authz_norm_scope_key($value): string
    {
        $key = strtolower(trim((string)$value));
        $key = preg_replace('/[^a-z0-9_:\-]/', '', $key) ?? '';
        return substr($key, 0, 64);
    }
}

if (!function_exists('maiatron_authz_norm_scope_value')) {
    function maiatron_authz_norm_scope_value($value): string
    {
        return substr(trim((string)$value), 0, 255);
    }
}

if (!function_exists('maiatron_authz_parse_datetime')) {
    function maiatron_authz_parse_datetime($value): ?int
    {
        $raw = trim((string)$value);
        if ($raw === '') return null;
        $ts = strtotime($raw);
        return $ts === false ? null : $ts;
    }
}

if (!function_exists('maiatron_authz_is_expired')) {
    function maiatron_authz_is_expired($value, ?int $now = null): bool
    {
        $ts = maiatron_authz_parse_datetime($value);
        if ($ts === null) return false;
        $cmp = $now ?? time();
        return $ts <= $cmp;
    }
}

if (!function_exists('maiatron_authz_default_alias_map')) {
    function maiatron_authz_default_alias_map(): array
    {
        return [
            'data-tron' => 'datatron',
            'data_tron' => 'datatron',
            'overseer-app' => 'overseer',
            'ops_overseer' => 'overseer',
            'webapp-medidata' => 'webapp_medidata',
            'medidata' => 'webapp_medidata',
            'maiatron_hub' => 'hub',
        ];
    }
}

if (!function_exists('maiatron_authz_default_apps_catalog')) {
    function maiatron_authz_default_apps_catalog(): array
    {
        return [
            ['app_key' => 'hub', 'display_name' => 'HUB', 'description' => 'Portal central MAIATRON'],
            ['app_key' => 'datatron', 'display_name' => 'DATATRON', 'description' => 'Exploracao e administracao de datasets'],
            ['app_key' => 'overseer', 'display_name' => 'OVERSEER', 'description' => 'Orquestracao e operacoes'],
            ['app_key' => 'warden', 'display_name' => 'WARDEN', 'description' => 'Monitorizacao de infraestrutura'],
            ['app_key' => 'webapp_medidata', 'display_name' => 'WEBAPP MEDIDATA', 'description' => 'Consola Medidata'],
        ];
    }
}

if (!function_exists('maiatron_authz_table_exists')) {
    function maiatron_authz_table_exists(PDO $pdo, string $table): bool
    {
        static $cache = [];
        $key = spl_object_hash($pdo) . '|' . $table;
        if (array_key_exists($key, $cache)) {
            return $cache[$key];
        }
        try {
            $stmt = $pdo->prepare(
                "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?"
            );
            $stmt->execute([$table]);
            $cache[$key] = (int)$stmt->fetchColumn() > 0;
        } catch (Throwable $e) {
            $cache[$key] = false;
        }
        return $cache[$key];
    }
}

if (!function_exists('maiatron_authz_fetch_alias_map')) {
    function maiatron_authz_fetch_alias_map(PDO $pdo): array
    {
        $map = maiatron_authz_default_alias_map();
        if (!maiatron_authz_table_exists($pdo, 'auth_app_aliases')) {
            return $map;
        }
        try {
            $rows = $pdo->query(
                'SELECT alias_key, app_key FROM `MAIATRON`.`auth_app_aliases` WHERE is_active = 1'
            )->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($rows as $row) {
                $alias = maiatron_authz_norm_app_key($row['alias_key'] ?? '');
                $appKey = maiatron_authz_norm_app_key($row['app_key'] ?? '');
                if ($alias === '' || $appKey === '') continue;
                $map[$alias] = $appKey;
            }
        } catch (Throwable $e) {
            // Em incidente de leitura, mantém-se o mapa default para não
            // transformar um erro auxiliar num bloqueio total de autenticação.
        }
        return $map;
    }
}

if (!function_exists('maiatron_authz_canonical_app_key')) {
    function maiatron_authz_canonical_app_key(string $appKey, array $aliasMap = []): string
    {
        $normalized = maiatron_authz_norm_app_key($appKey);
        if ($normalized === '') return '';
        return $aliasMap[$normalized] ?? $normalized;
    }
}

if (!function_exists('maiatron_authz_app_key_candidates')) {
    function maiatron_authz_app_key_candidates(string $canonicalKey, array $aliasMap = []): array
    {
        $keys = [];
        if ($canonicalKey !== '') $keys[] = $canonicalKey;
        foreach ($aliasMap as $alias => $target) {
            if ($target === $canonicalKey && !in_array($alias, $keys, true)) {
                $keys[] = $alias;
            }
        }
        return $keys;
    }
}

if (!function_exists('maiatron_authz_fetch_user_row')) {
    function maiatron_authz_fetch_user_row(PDO $pdo, string $username): ?array
    {
        $username = trim($username);
        if ($username === '') return null;

        $stmt = $pdo->prepare(
            'SELECT id, username, display_name, global_tier, user_type, is_active, account_expires_at
               FROM `MAIATRON`.`auth_users`
              WHERE username = ?
              LIMIT 1'
        );
        $stmt->execute([$username]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) return null;

        return [
            'id' => (int)($row['id'] ?? 0),
            'username' => (string)($row['username'] ?? ''),
            'display_name' => (string)($row['display_name'] ?? ''),
            'global_tier' => maiatron_authz_norm_global_tier($row['global_tier'] ?? 'member'),
            'user_type' => maiatron_authz_norm_user_type($row['user_type'] ?? 'standard'),
            'is_active' => (int)($row['is_active'] ?? 0) === 1,
            'account_expires_at' => $row['account_expires_at'] ?? null,
        ];
    }
}

if (!function_exists('maiatron_authz_fetch_permission')) {
    /**
     * Resolve a permissão efetiva de um utilizador para uma app, aplicando a
     * cascata canónica: expiração da conta -> global admin -> grant por app ->
     * scopes por domínio -> deny-by-default.
     */
    function maiatron_authz_fetch_permission(PDO $pdo, string $username, string $appKey, array $options = []): array
    {
        $aliasMap = isset($options['aliasMap']) && is_array($options['aliasMap'])
            ? $options['aliasMap']
            : maiatron_authz_fetch_alias_map($pdo);
        $canonicalAppKey = maiatron_authz_canonical_app_key($appKey, $aliasMap);
        $keyCandidates = maiatron_authz_app_key_candidates($canonicalAppKey, $aliasMap);

        $user = maiatron_authz_fetch_user_row($pdo, $username);
        if (!$user || !$user['is_active']) {
            return [
                'appKey' => $canonicalAppKey,
                'matchedAppKey' => null,
                'isAllowed' => false,
                'appRole' => 'viewer',
                'source' => 'no_auth_user',
                'globalTier' => 'member',
                'userType' => 'standard',
                'accountExpiresAt' => null,
                'accessExpiresAt' => null,
                'scopes' => [],
                'userId' => 0,
                'username' => $username,
            ];
        }

        $now = time();
        $globalTier = (string)$user['global_tier'];
        $userType = (string)$user['user_type'];
        $accountExpiresAt = $user['account_expires_at'] ?? null;

        if (maiatron_authz_is_expired($accountExpiresAt, $now)) {
            return [
                'appKey' => $canonicalAppKey,
                'matchedAppKey' => null,
                'isAllowed' => false,
                'appRole' => 'viewer',
                'source' => 'account_expired',
                'globalTier' => $globalTier,
                'userType' => $userType,
                'accountExpiresAt' => $accountExpiresAt,
                'accessExpiresAt' => null,
                'scopes' => [],
                'userId' => (int)$user['id'],
                'username' => (string)$user['username'],
            ];
        }

        if ($globalTier === 'global_admin' || strcasecmp((string)$user['username'], MAIATRON_AUTH_GLOBAL_ADMIN_USERNAME) === 0) {
            return [
                'appKey' => $canonicalAppKey,
                'matchedAppKey' => null,
                'isAllowed' => true,
                'appRole' => 'admin',
                'source' => 'global_admin',
                'globalTier' => 'global_admin',
                'userType' => $userType,
                'accountExpiresAt' => $accountExpiresAt,
                'accessExpiresAt' => null,
                'scopes' => [],
                'userId' => (int)$user['id'],
                'username' => (string)$user['username'],
            ];
        }

        $effectiveAllowed = false;
        $effectiveRole = 'viewer';
        $source = 'default_deny';
        $matchedAppKey = null;
        $accessExpiresAt = null;

        if (!empty($keyCandidates)) {
            $placeholders = implode(',', array_fill(0, count($keyCandidates), '?'));
            $params = array_merge([(int)$user['id']], $keyCandidates, [$canonicalAppKey]);
            $stmt = $pdo->prepare(
                "SELECT app_key, is_allowed, app_role, access_expires_at
                   FROM `MAIATRON`.`auth_user_app_access`
                  WHERE user_id = ? AND app_key IN ($placeholders)
                  ORDER BY (CASE WHEN app_key = ? THEN 0 ELSE 1 END), id DESC
                  LIMIT 1"
            );
            $stmt->execute($params);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (is_array($row)) {
                $matchedAppKey = maiatron_authz_norm_app_key($row['app_key'] ?? '');
                $effectiveAllowed = (int)($row['is_allowed'] ?? 0) === 1;
                $effectiveRole = maiatron_authz_norm_app_role($row['app_role'] ?? 'viewer');
                $accessExpiresAt = $row['access_expires_at'] ?? null;
                $source = 'explicit';
                if (maiatron_authz_is_expired($accessExpiresAt, $now)) {
                    $effectiveAllowed = false;
                    $source = 'explicit_expired';
                }
            }
        }

        $scopes = [];
        if (!empty($keyCandidates)) {
            $placeholders = implode(',', array_fill(0, count($keyCandidates), '?'));
            $params = array_merge([(int)$user['id']], $keyCandidates);
            $stmt = $pdo->prepare(
                "SELECT app_key, scope_key, scope_value
                   FROM `MAIATRON`.`auth_user_app_scopes`
                  WHERE user_id = ? AND app_key IN ($placeholders)
               ORDER BY app_key, scope_key, scope_value"
            );
            $stmt->execute($params);
            foreach (($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) as $row) {
                $scopeKey = maiatron_authz_norm_scope_key($row['scope_key'] ?? '');
                $scopeValue = maiatron_authz_norm_scope_value($row['scope_value'] ?? '');
                if ($scopeKey === '' || $scopeValue === '') continue;
                if (!isset($scopes[$scopeKey])) $scopes[$scopeKey] = [];
                if (!in_array($scopeValue, $scopes[$scopeKey], true)) {
                    $scopes[$scopeKey][] = $scopeValue;
                }
            }
        }

        return [
            'appKey' => $canonicalAppKey,
            'matchedAppKey' => $matchedAppKey,
            'isAllowed' => $effectiveAllowed,
            'appRole' => $effectiveRole,
            'source' => $source,
            'globalTier' => $globalTier,
            'userType' => $userType,
            'accountExpiresAt' => $accountExpiresAt,
            'accessExpiresAt' => $accessExpiresAt,
            'scopes' => $scopes,
            'userId' => (int)$user['id'],
            'username' => (string)$user['username'],
        ];
    }
}

if (!function_exists('maiatron_authz_actor_context')) {
    function maiatron_authz_actor_context(PDO $pdo, string $username, string $requestedAppKey = ''): array
    {
        $aliasMap = maiatron_authz_fetch_alias_map($pdo);
        $canonicalRequestedApp = maiatron_authz_canonical_app_key($requestedAppKey, $aliasMap);
        $user = maiatron_authz_fetch_user_row($pdo, $username);
        if (!$user || !$user['is_active'] || maiatron_authz_is_expired($user['account_expires_at'] ?? null)) {
            return [
                'isAuthenticatedActor' => false,
                'isGlobalAdmin' => false,
                'isAppAdmin' => false,
                'requestedAppKey' => $canonicalRequestedApp,
                'permission' => null,
                'user' => $user,
            ];
        }

        $isGlobalAdmin = ((string)$user['global_tier'] === 'global_admin')
            || strcasecmp((string)$user['username'], MAIATRON_AUTH_GLOBAL_ADMIN_USERNAME) === 0;
        $permission = null;
        $isAppAdmin = false;
        if ($canonicalRequestedApp !== '') {
            $permission = maiatron_authz_fetch_permission($pdo, (string)$user['username'], $canonicalRequestedApp, [
                'aliasMap' => $aliasMap,
            ]);
            $isAppAdmin = !empty($permission['isAllowed']) && (string)($permission['appRole'] ?? '') === 'admin';
        }

        return [
            'isAuthenticatedActor' => true,
            'isGlobalAdmin' => $isGlobalAdmin,
            'isAppAdmin' => $isAppAdmin,
            'requestedAppKey' => $canonicalRequestedApp,
            'permission' => $permission,
            'user' => $user,
        ];
    }
}
