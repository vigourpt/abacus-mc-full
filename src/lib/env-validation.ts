// =====================================================
// Environment Variable Validation
// Ensures all required configuration is present at startup
// =====================================================

import { createChildLogger } from './logger';

const logger = createChildLogger('env-validation');

interface EnvVar {
  name: string;
  required: boolean;
  default?: string;
  description: string;
  sensitive?: boolean;
  validate?: (value: string) => boolean;
}

const ENV_SCHEMA: EnvVar[] = [
  // Core
  { name: 'NODE_ENV', required: false, default: 'development', description: 'Node environment (development|production)' },
  { name: 'PORT', required: false, default: '3000', description: 'Server port' },
  { name: 'LOG_LEVEL', required: false, default: 'info', description: 'Logging level (debug|info|warn|error)' },

  // Database
  { name: 'DATABASE_PATH', required: false, default: '.data/startup.db', description: 'SQLite database file path' },

  // Authentication
  { name: 'AUTH_USER', required: false, default: 'admin', description: 'Admin username for dashboard access' },
  { name: 'AUTH_PASS', required: false, description: 'Admin password (change from default!)', sensitive: true },
  { name: 'API_KEY', required: false, description: 'API key for programmatic access', sensitive: true },

  // OpenClaw Gateway
  { name: 'OPENCLAW_GATEWAY_HOST', required: false, description: 'OpenClaw Gateway hostname or IP' },
  { name: 'OPENCLAW_GATEWAY_PORT', required: false, default: '18789', description: 'OpenClaw Gateway port', validate: (v) => !isNaN(parseInt(v)) },
  { name: 'OPENCLAW_GATEWAY_TOKEN', required: false, description: 'OpenClaw Gateway auth token', sensitive: true },
  { name: 'OPENCLAW_CONFIG_PATH', required: false, description: 'Path to openclaw.json config file' },
  { name: 'OPENCLAW_STATE_DIR', required: false, description: 'Path to .openclaw state directory' },
  { name: 'OPENCLAW_MEMORY_DIR', required: false, description: 'Path to clawd-agents memory directory' },

  // AI Model
  { name: 'DEFAULT_MODEL', required: false, default: 'claude-3-opus', description: 'Default AI model for agent operations' },
  { name: 'FALLBACK_MODEL', required: false, default: 'claude-3-sonnet', description: 'Fallback AI model' },

  // Network Security
  { name: 'MC_ALLOWED_HOSTS', required: false, description: 'Comma-separated allowed hostnames' },
  { name: 'MC_ALLOW_ANY_HOST', required: false, description: 'Set to "true" to allow any host (not recommended for production)' },

  // Data Retention
  { name: 'MC_RETAIN_ACTIVITIES_DAYS', required: false, default: '90', description: 'Days to retain activity logs' },
  { name: 'MC_RETAIN_AUDIT_DAYS', required: false, default: '365', description: 'Days to retain audit logs' },
  { name: 'MC_RETAIN_TOKEN_USAGE_DAYS', required: false, default: '90', description: 'Days to retain token usage data' },

  // External APIs
  { name: 'OPENAI_API_KEY', required: false, description: 'OpenAI API key (for knowledge embeddings)', sensitive: true },
  { name: 'METRICS_PORT', required: false, default: '9090', description: 'Metrics API port (Python orchestration)' },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  configured: Record<string, boolean>;
}

/**
 * Validate all environment variables against schema
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const configured: Record<string, boolean> = {};

  for (const envVar of ENV_SCHEMA) {
    const value = process.env[envVar.name];
    configured[envVar.name] = !!value;

    if (envVar.required && !value) {
      errors.push(`Missing required env var: ${envVar.name} - ${envVar.description}`);
    }

    if (value && envVar.validate && !envVar.validate(value)) {
      errors.push(`Invalid value for ${envVar.name}: "${value}"`);
    }
  }

  // Production-specific warnings
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.AUTH_PASS || process.env.AUTH_PASS === 'changeme' || process.env.AUTH_PASS === 'change-me-on-first-login') {
      warnings.push('AUTH_PASS is using default value - please set a strong password');
    }

    if (!process.env.API_KEY) {
      warnings.push('API_KEY is not set - programmatic API access will be unrestricted');
    }

    if (process.env.MC_ALLOW_ANY_HOST === 'true') {
      warnings.push('MC_ALLOW_ANY_HOST is true - this is not recommended for production');
    }

    if (!process.env.OPENCLAW_GATEWAY_HOST) {
      warnings.push('OPENCLAW_GATEWAY_HOST is not set - OpenClaw integration will not work');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    configured,
  };
}

/**
 * Log environment validation results at startup
 */
export function logEnvironmentStatus(): void {
  const result = validateEnvironment();

  if (result.errors.length > 0) {
    logger.error({ errors: result.errors }, '❌ Environment validation failed');
  }

  if (result.warnings.length > 0) {
    logger.warn({ warnings: result.warnings }, '⚠️ Environment warnings');
  }

  // Log OpenClaw configuration status
  const openclawConfigured = result.configured['OPENCLAW_GATEWAY_HOST'];
  if (openclawConfigured) {
    logger.info({
      host: process.env.OPENCLAW_GATEWAY_HOST,
      port: process.env.OPENCLAW_GATEWAY_PORT || '18789',
    }, '🔗 OpenClaw Gateway configured');
  } else {
    logger.info('ℹ️ OpenClaw Gateway not configured - running in standalone mode');
  }

  const configuredCount = Object.values(result.configured).filter(Boolean).length;
  logger.info(
    { configured: configuredCount, total: ENV_SCHEMA.length },
    `✅ Environment loaded (${configuredCount}/${ENV_SCHEMA.length} variables configured)`
  );
}

/**
 * Get environment configuration summary (safe for API responses - no secrets)
 */
export function getEnvironmentSummary(): Record<string, unknown> {
  const result = validateEnvironment();

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    valid: result.valid,
    warnings: result.warnings.length,
    configured: Object.entries(result.configured)
      .filter(([key]) => {
        const schema = ENV_SCHEMA.find(s => s.name === key);
        return !schema?.sensitive;
      })
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
    openclaw: {
      configured: !!process.env.OPENCLAW_GATEWAY_HOST,
      host: process.env.OPENCLAW_GATEWAY_HOST || null,
      port: parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789'),
    },
  };
}
