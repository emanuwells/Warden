-- ============================================
-- Warden — Database Setup
-- Run this script on your MariaDB server.
-- ============================================

-- 1. Create database
CREATE DATABASE IF NOT EXISTS Warden
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE Warden;

-- 2. Create metrics table
CREATE TABLE IF NOT EXISTS warden_metrics (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY,
    captured_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    metrics     JSON         NOT NULL,
    INDEX idx_captured_at (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create service user (adjust password!)
-- CREATE USER IF NOT EXISTS 'warden'@'%' IDENTIFIED BY 'CHANGE_ME';
-- GRANT SELECT, INSERT, DELETE ON Warden.* TO 'warden'@'%';
-- FLUSH PRIVILEGES;

-- 4. Verify
SELECT 'Warden DB setup complete.' AS status;
