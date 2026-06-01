<?php
declare(strict_types=1);

/**
 * Finalidade: Biblioteca partilhada de sessão/autenticação usada pelas APIs MAIATRON.
 * Depende de: configuração PHP-FPM/Nginx e dos endpoints públicos de autenticação.
 * Entradas/Saídas principais: gere cookies, sessão PHP e token persistente de autenticação.
 * Efeitos laterais: inicia sessões, escreve cookies HTTP e atualiza `$_SESSION`.
 * Relação canónica: usada por `auth.php` e pelas APIs das apps para partilhar sessão.
 */
if (!defined('MAIATRON_SHARED_SESSION_NAME_DEFAULT')) {
    define('MAIATRON_SHARED_SESSION_NAME_DEFAULT', 'MAIATRONSESSID');
}
if (!defined('MAIATRON_SHARED_SESSION_KEY_DEFAULT')) {
    define('MAIATRON_SHARED_SESSION_KEY_DEFAULT', 'maiatron_auth');
}
if (!defined('MAIATRON_SHARED_REMEMBER_COOKIE_NAME_DEFAULT')) {
    define('MAIATRON_SHARED_REMEMBER_COOKIE_NAME_DEFAULT', 'MAIATRONREM');
}
if (!defined('MAIATRON_SHARED_COOKIE_PATH')) {
    define('MAIATRON_SHARED_COOKIE_PATH', '/MAIATRON/');
}
if (!defined('MAIATRON_SHARED_SESSION_TTL_SECONDS_DEFAULT')) {
    define('MAIATRON_SHARED_SESSION_TTL_SECONDS_DEFAULT', 480 * 60);
}
if (!defined('MAIATRON_SHARED_PERSISTENT_TTL_SECONDS_DEFAULT')) {
    define('MAIATRON_SHARED_PERSISTENT_TTL_SECONDS_DEFAULT', 315360000);
}

function maiatron_auth_session_name_value(): string
{
    return defined('MAIATRON_AUTH_SESSION_NAME')
        ? (string)MAIATRON_AUTH_SESSION_NAME
        : MAIATRON_SHARED_SESSION_NAME_DEFAULT;
}

function maiatron_auth_session_key_value(): string
{
    return defined('MAIATRON_AUTH_SESSION_KEY')
        ? (string)MAIATRON_AUTH_SESSION_KEY
        : MAIATRON_SHARED_SESSION_KEY_DEFAULT;
}

function maiatron_auth_remember_cookie_name_value(): string
{
    return defined('MAIATRON_AUTH_REMEMBER_COOKIE_NAME')
        ? (string)MAIATRON_AUTH_REMEMBER_COOKIE_NAME
        : MAIATRON_SHARED_REMEMBER_COOKIE_NAME_DEFAULT;
}

function maiatron_auth_session_ttl_seconds_value(): int
{
    if (defined('MAIATRON_AUTH_SESSION_TTL_MINUTES')) {
        return max(60, (int)MAIATRON_AUTH_SESSION_TTL_MINUTES * 60);
    }
    if (defined('MAIATRON_AUTH_SESSION_TTL_SECONDS')) {
        return max(60, (int)MAIATRON_AUTH_SESSION_TTL_SECONDS);
    }
    return MAIATRON_SHARED_SESSION_TTL_SECONDS_DEFAULT;
}

function maiatron_auth_persistent_ttl_seconds_value(): int
{
    if (defined('MAIATRON_AUTH_PERSISTENT_TTL_SECONDS')) {
        return max(60, (int)MAIATRON_AUTH_PERSISTENT_TTL_SECONDS);
    }
    return MAIATRON_SHARED_PERSISTENT_TTL_SECONDS_DEFAULT;
}

function maiatron_auth_cookie_path_value(): string
{
    $configuredPath = getenv('MAIATRON_AUTH_COOKIE_PATH');
    if (is_string($configuredPath)) {
        $configuredPath = trim($configuredPath);
        if ($configuredPath !== '' && $configuredPath[0] === '/') {
            return substr($configuredPath, -1) === '/' ? $configuredPath : $configuredPath . '/';
        }
    }

    return MAIATRON_SHARED_COOKIE_PATH;
}

function maiatron_auth_is_https_request(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if ((string)($_SERVER['SERVER_PORT'] ?? '') === '443') {
        return true;
    }
    return strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function maiatron_auth_cookie_options(int $expires = 0): array
{
    return [
        'expires' => $expires,
        'path' => maiatron_auth_cookie_path_value(),
        'domain' => '',
        'secure' => maiatron_auth_is_https_request(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

function maiatron_auth_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $gcTtl = max(maiatron_auth_session_ttl_seconds_value(), maiatron_auth_persistent_ttl_seconds_value());
    @ini_set('session.use_only_cookies', '1');
    @ini_set('session.use_strict_mode', '1');
    @ini_set('session.gc_maxlifetime', (string)$gcTtl);

    session_name(maiatron_auth_session_name_value());
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => maiatron_auth_cookie_path_value(),
        'domain' => '',
        'secure' => maiatron_auth_is_https_request(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function maiatron_auth_session_touch(array $data): array
{
    maiatron_auth_session_start();

    $now = time();
    $remember = !empty($data['remember_session']);
    $ttl = $remember ? maiatron_auth_persistent_ttl_seconds_value() : maiatron_auth_session_ttl_seconds_value();
    $data['expires_at'] = $now + $ttl;
    $data['_session_touched_at'] = $now;
    $data['_session_touch_seq'] = (int)($data['_session_touch_seq'] ?? 0) + 1;
    $_SESSION[maiatron_auth_session_key_value()] = $data;

    return $data;
}

function maiatron_auth_session_get_raw(bool $touch = true): ?array
{
    maiatron_auth_session_start();

    $data = $_SESSION[maiatron_auth_session_key_value()] ?? null;
    if (!is_array($data)) {
        return null;
    }

    $username = trim((string)($data['username'] ?? ''));
    $expiresAt = (int)($data['expires_at'] ?? 0);
    if ($username === '' || $expiresAt <= time()) {
        maiatron_auth_session_destroy(false);
        return null;
    }

    return $touch ? maiatron_auth_session_touch($data) : $data;
}

function maiatron_auth_session_set_raw(array $data): array
{
    maiatron_auth_session_start();
    $_SESSION[maiatron_auth_session_key_value()] = $data;
    return maiatron_auth_session_touch($data);
}

function maiatron_auth_session_destroy(bool $clearCookie = true): void
{
    maiatron_auth_session_start();
    $_SESSION = [];

    if ($clearCookie && ini_get('session.use_cookies')) {
        setcookie(maiatron_auth_session_name_value(), '', maiatron_auth_cookie_options(time() - 3600));
    }

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function maiatron_auth_remember_cookie_get(): ?string
{
    $raw = $_COOKIE[maiatron_auth_remember_cookie_name_value()] ?? null;
    if (!is_string($raw)) {
        return null;
    }
    $raw = trim($raw);
    return $raw !== '' ? $raw : null;
}

function maiatron_auth_remember_cookie_set(string $tokenValue, int $ttlSeconds): void
{
    $expires = time() + max(60, $ttlSeconds);
    setcookie(maiatron_auth_remember_cookie_name_value(), $tokenValue, maiatron_auth_cookie_options($expires));
    $_COOKIE[maiatron_auth_remember_cookie_name_value()] = $tokenValue;
}

function maiatron_auth_remember_cookie_clear(): void
{
    setcookie(maiatron_auth_remember_cookie_name_value(), '', maiatron_auth_cookie_options(time() - 3600));
    unset($_COOKIE[maiatron_auth_remember_cookie_name_value()]);
}
