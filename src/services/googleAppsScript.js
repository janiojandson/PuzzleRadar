/**
 * 🧩 PuzzleRadar — Google Apps Script Oficial v5.3 (Live API & Multi-Tab Hub)
 * Planilha ID: 1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg
 */

const USER_TOKEN = "DTQxtNrgkIfWmRznVmfBfksGgpHUfgqkRUTppuukOiOSkqDAENSmtHEWTGkVLFGleNXiraBJqgEdstaeGSRaTTcYMmdIxkQwdUsVCtsNXRFjdeslPSDbsclsWnDSZoMS";
const PUZZLE_CODE = "71";

/**
 * Cria menu personalizado na interface do Google Sheets ao abrir
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🧩 PuzzleRadar")
    .addItem("🔄 Sincronizar Pool ao Vivo (btcpuzzle.info)", "sincronizarMetricasPoolLive")
    .addItem("📊 Atualizar Tabela de Benchmarks de GPU", "popularTabelaBenchmarksGPU")
    .addSeparator()
    .addItem("⚡ Repovoar Dados Puzzles 1000 BTC", "popularPlanilhaPuzzles1000BTC")
    .addToUi();
}

/**
 * Endpoint Webhook HTTP POST/GET principal para recepção de batched ranges e telemetria
 */
function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (contents.action === "batch_ranges" || contents.batchMode) {
      let sheet = ss.getSheetByName(contents.targetSheet || contents.sheetName || "Ranges_Varredura");
      const headers = [
        "Timestamp", "Rede / Chain", "Desafio / Challenge ID", "Chunk #", 
        "Range Início (Hex)", "Range Fim (Hex)", "Worker / Operador", "Status da Varredura", 
        "Fatia Pai & PoW Oficial", "Hashrate", "Descoberta"
      ];
      if (!sheet) {
        sheet = ss.insertSheet(contents.targetSheet || contents.sheetName || "Ranges_Varredura");
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else if (sheet.getLastColumn() < 11) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }

      const rowsToInsert = (contents.rows || []).map(r => {
        var cleanStatus = r.status || r.scanStatus || "COMPLETED";
        if (cleanStatus.includes(" | Pai:")) cleanStatus = cleanStatus.split(" | Pai:")[0].trim();
        var officialPoW = r.officialParentPoW || r.parentPoW || "Pai: 0x4000000 (PoW: 0/6)";

        return [
          r.timestamp || new Date().toISOString(),
          (r.chain || "BTC").toUpperCase(),
          r.challenge_id || r.challengeId || "BTC_1000_P71",
          r.chunkLabel || `Chunk #${r.chunkIndex || r.chunkNumber || 1}`,
          "'" + (r.startHex || r.rangeStart || "").replace(/^0x/i, ''),
          "'" + (r.endHex || r.rangeEnd || "").replace(/^0x/i, ''),
          r.workerName || r.worker || "Anonimo",
          cleanStatus,
          officialPoW,
          r.hashrate || r.hashrateStr || "0 GH/s",
          r.keyFound ? "🚨 CHAVE ENCONTRADA!" : (r.discoveryStatus || "NENHUMA")
        ];
      });

      if (rowsToInsert.length > 0) {
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow + 1, 1, rowsToInsert.length, 11).setValues(rowsToInsert);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", inserted: rowsToInsert.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "ONLINE", service: "PuzzleRadar Apps Script v5.3" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Consultador ao vivo da API oficial btcpuzzle.info
 */
function sincronizarMetricasPoolLive() {
  const url = `https://api.btcpuzzle.info/puzzle/${PUZZLE_CODE}/stats`;
  const options = {
    headers: {
      "UserToken": USER_TOKEN,
      "Accept": "application/json"
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetStats = ss.getSheetByName("Metricas_Pool_Live");
    if (!sheetStats) sheetStats = ss.insertSheet("Metricas_Pool_Live");

    sheetStats.clear();
    sheetStats.appendRow(["Parâmetro", "Valor"]);
    sheetStats.appendRow(["Puzzle #", PUZZLE_CODE]);
    sheetStats.appendRow(["Fatias Globais Escaneadas", data.scannedRanges || "N/A"]);
    sheetStats.appendRow(["Porcentagem Concluída", (data.completionPercent || 0) + "%"]);
    sheetStats.appendRow(["Hashrate Estimado", data.hashrate || "N/A"]);
    sheetStats.appendRow(["Última Sincronização", new Date().toISOString()]);

    SpreadsheetApp.getUi().alert("✅ Métricas da Pool Oficial (btcpuzzle.info) sincronizadas com sucesso!");
  } catch (e) {
    SpreadsheetApp.getUi().alert("❌ Erro ao consultar API oficial: " + e.message);
  }
}

/**
 * Tabela oficial de Benchmarks de GPU para o Puzzle 71
 */
function popularTabelaBenchmarksGPU() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetGpu = ss.getSheetByName("Benchmarks_GPU");
  if (!sheetGpu) sheetGpu = ss.insertSheet("Benchmarks_GPU");

  sheetGpu.clear();
  const headers = ["Modelo de GPU", "VRAM", "Hashrate Estimado (Keyhunt / BitCrack)", "Fatias/Dia (2^40)", "Custo de Energia Estimado"];
  sheetGpu.appendRow(headers);

  const benchmarks = [
    ["NVIDIA RTX 4090", "24 GB", "2.8 GKey/s", "220", "$1.20/dia"],
    ["NVIDIA RTX 4080", "16 GB", "1.9 GKey/s", "150", "$0.85/dia"],
    ["NVIDIA RTX 3090 Ti", "24 GB", "1.7 GKey/s", "135", "$1.40/dia"],
    ["NVIDIA RTX 3080", "10 GB", "1.2 GKey/s", "95", "$0.90/dia"],
    ["Tesla T4 (Google Colab)", "16 GB", "350 MKey/s", "28", "Gratuito / Nuvens"],
    ["NVIDIA A100 SXM4", "80 GB", "4.5 GKey/s", "350", "$2.50/dia"]
  ];

  sheetGpu.getRange(2, 1, benchmarks.length, headers.length).setValues(benchmarks);
  SpreadsheetApp.getUi().alert("📊 Tabela de Benchmarks de GPU atualizada!");
}