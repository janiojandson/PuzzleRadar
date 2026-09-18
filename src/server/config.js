// =========================================================================
// 🧩 PuzzleRadar — Configuração Central de Credenciais & Vaults
// =========================================================================

require('dotenv').config();

const config = {
  PORT: process.env.PORT || 3010,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // btcpuzzle.info Pool Credentials
  BTCPUZZLE_USER_TOKEN: process.env.BTCPUZZLE_USER_TOKEN || 'a71e847c1b5a593e8a4bbde415ecddf2',
  BTCPUZZLE_API_BASE: process.env.BTCPUZZLE_API_BASE || 'https://api.btcpuzzle.info',
  
  // Cold Vaults Imutáveis
  COLD_VAULT_BTC: process.env.COLD_VAULT_BTC || process.env.RESCUE_VAULT_BTC_ADDRESS || 'bc1q4ea075c0ypxuw7w28j5cl8k7l6ga7qzsaxda56',
  COLD_VAULT_ETH: process.env.COLD_VAULT_ETH || process.env.RESCUE_VAULT_ETH_ADDRESS || '0xf5f3e4750c1bFa26677daD29FcdeaD6f71A742e0',
  COLD_VAULT_SOL: process.env.COLD_VAULT_SOL || process.env.RESCUE_VAULT_SOL_ADDRESS || 'FBx2SKLDLsdeLM8owxU8MNVPKAfJpLpmpHHRgiZDqBoi',
  
  // Google Sheets & Apps Script Webhook
  GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID || '1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg',
  GOOGLE_APPS_SCRIPT_WEBHOOK_URL: process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || process.env.GOOGLE_SHEETS_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbyxObip-jQvbdpv1vqoaKAEI2turdjaJI-cBJ8MwID164VzXD8uoXhVfTXEXRTy0khC/exec',
  SHEETS_WEBHOOK_SECRET: process.env.SHEETS_WEBHOOK_SECRET || 'puzzleradar_super_secret_jwt_key_2026_production',
  
  // JWT & Admin
  JWT_SECRET: process.env.JWT_SECRET || 'puzzleradar_super_secret_jwt_key_2026_production',
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@puzzleradar.io').trim().toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123456',
  ADMIN_WORKER_TOKEN: process.env.ADMIN_WORKER_TOKEN || 'pzk_admin_master_gpu_token',
};

module.exports = config;
