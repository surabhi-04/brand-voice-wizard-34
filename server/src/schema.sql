-- Brand Voice AI Database Schema
-- Compatible with MySQL 8.0+

CREATE DATABASE IF NOT EXISTS brandvoice_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE brandvoice_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  google_id VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  profile_picture TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_google_id (google_id),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  brand_name VARCHAR(255) NOT NULL,
  industry VARCHAR(255) DEFAULT '',
  campaign_objective VARCHAR(100) NOT NULL,
  product_info TEXT,
  brand_voice_profile JSON,
  tweets JSON,
  notion_url VARCHAR(500) NULL,
  notion_page_id VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaigns_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_campaigns_user_id (user_id),
  INDEX idx_campaigns_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Notion OAuth Connections table (Per-user workspace authorization)
CREATE TABLE IF NOT EXISTS user_notion_connections (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  workspace_id VARCHAR(128) NOT NULL,
  workspace_name VARCHAR(255) NOT NULL,
  workspace_icon TEXT NULL,
  bot_id VARCHAR(128) NULL,
  encrypted_access_token TEXT NOT NULL,
  destination_page_id VARCHAR(128) NULL,
  destination_page_name VARCHAR(255) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notion_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notion_user_id (user_id),
  INDEX idx_notion_workspace_id (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
