/**
 * 🧩 PuzzleRadar — Google Apps Script Oficial v5.3 (Live Multi-Tab Hub & Payout Ledger)
 * Planilha ID: 1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg
 */

const USER_TOKEN = "DTQxtNrgkIfWmRznVmfBfksGgpHUfgqkRUTppuukOiOSkqDAENSmtHEWTGkVLFGleNXiraBJqgEdstaeGSRaTTcYMmdIxkQwdUsVCtsNXRFjdeslPSDbsclsWnDSZoMS";
const PUZZLE_CODE = "71";
const SECRET_TOKEN = "puzzleradar_super_secret_jwt_key_2026_production";

/**
 * Função utilitária para exibir alertas com segurança (funciona tanto dentro do editor quanto na planilha)
 */
function showAlert(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(msg.split('\n')[0], "PuzzleRadar", 6);
    } catch (_) {}
  }
}

/**
 * Cria menu personalizado na interface do Google Sheets ao abrir
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("🧩 PuzzleRadar")
      .addItem("⚡ Reinstalar e Restaurar Todas as Abas (v5.3)", "reinstalarTudo")
      .addSeparator()
      .addItem("🔄 Sincronizar Pool ao Vivo (btcpuzzle.info)", "sincronizarMetricasPoolLive")
      .addItem("📜 Exibir Regras de Rateio (85% / 15%)", "popularContratoRegrasRateio")
      .addItem("📊 Atualizar Tabela de Benchmarks de GPU", "popularTabelaBenchmarksGPU")
      .addToUi();
  } catch (_) {}
}

/**
 * Endpoint Webhook HTTP POST principal
 */
function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Registro de Minerador e Carteira Bitcoin (Payout Profile)
    if (contents.action === "register_payout" || contents.payoutAddress) {
      let sheetCad = ss.getSheetByName("Cadastros_Mineradores");
      const headersCad = [
        "Data de Registro", "Apelido / Worker", "Carteira Bitcoin (Payout BTC)", 
        "Equipamento / Hardware", "Contato (Telegram/Email)", "Status da Conta", 
        "Fatias Concluídas", "Cota Estimada (%)"
      ];

      if (!sheetCad) {
        sheetCad = ss.insertSheet("Cadastros_Mineradores");
        sheetCad.getRange(1, 1, 1, headersCad.length).setValues([headersCad])
          .setBackground("#064e3b").setFontColor("#34d399").setFontWeight("bold").setHorizontalAlignment("center");
        sheetCad.setFrozenRows(1);
      }

      const cleanWallet = contents.payoutAddress || "N/A";
      const cleanWorker = contents.workerName || "Anonimo";
      const cleanHw = contents.hardwareType || "GPU / Cluster";
      const cleanContact = contents.contactInfo || "—";

      let foundRow = -1;
      const data = sheetCad.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] && String(data[i][1]).toLowerCase() === cleanWorker.toLowerCase()) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow > 0) {
        sheetCad.getRange(foundRow, 3).setValue("'" + cleanWallet);
        sheetCad.getRange(foundRow, 4).setValue(cleanHw);
        sheetCad.getRange(foundRow, 5).setValue(cleanContact);
        sheetCad.getRange(foundRow, 6).setValue("ATIVO");
      } else {
        sheetCad.insertRowBefore(2);
        sheetCad.getRange(2, 1, 1, headersCad.length).setValues([[
          new Date(),
          cleanWorker,
          "'" + cleanWallet,
          cleanHw,
          cleanContact,
          "ATIVO",
          0,
          "Calculando..."
        ]]);
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Carteira de Payout registrada com sucesso na aba Cadastros_Mineradores!" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Recepção de Lote de Fatias de Varredura (Batch Ranges)
    if (contents.action === "batch_ranges" || contents.batchMode) {
      let sheet = ss.getSheetByName(contents.targetSheet || contents.sheetName || "Ranges_Varredura");
      const headers = [
        "Timestamp", "Rede / Chain", "Desafio / Challenge ID", "Chunk #", 
        "Range Início (Hex)", "Range Fim (Hex)", "Worker / Operador", "Status da Varredura", 
        "Fatia Pai & PoW Oficial", "Hashrate", "Descoberta"
      ];
      if (!sheet) {
        sheet = ss.insertSheet(contents.targetSheet || contents.sheetName || "Ranges_Varredura");
        sheet.getRange(1, 1, 1, headers.length).setValues([headers])
          .setBackground("#0f172a").setFontColor("#38bdf8").setFontWeight("bold").setHorizontalAlignment("center");
        sheet.setFrozenRows(1);
      }

      const rowsToInsert = (contents.rows || []).map(r => {
        var cleanStatus = r.status || r.scanStatus || "COMPLETED";
        if (cleanStatus.includes(" | Pai:")) cleanStatus = cleanStatus.split(" | Pai:")[0].trim();
        var officialPoW = r.officialParentPoW || r.parentPoW || "Pai: 0x4000000 [Marcos: 0/60 | PoW: 0/6]";

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
        sheet.insertRowsBefore(2, rowsToInsert.length);
        sheet.getRange(2, 1, rowsToInsert.length, headers.length).setValues(rowsToInsert);
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
  return ContentService.createTextOutput(JSON.stringify({ 
    status: "ONLINE", 
    service: "PuzzleRadar Apps Script v5.3",
    features: ["Ranges_Varredura", "Cadastros_Mineradores", "Contrato_Rateio_Regras", "Status_Pool_Live"] 
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ⚡ REINSTALAR E RESTAURAR TODAS AS ABAS DO ZERO (v5.3)
 */
function reinstalarTudo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Aba Ranges_Varredura
  let sRanges = ss.getSheetByName("Ranges_Varredura");
  if (!sRanges) sRanges = ss.insertSheet("Ranges_Varredura");
  sRanges.clear();
  const hRanges = [
    "Timestamp", "Rede / Chain", "Desafio / Challenge ID", "Chunk #", 
    "Range Início (Hex)", "Range Fim (Hex)", "Worker / Operador", "Status da Varredura", 
    "Fatia Pai & PoW Oficial", "Hashrate", "Descoberta"
  ];
  sRanges.getRange(1, 1, 1, hRanges.length).setValues([hRanges])
    .setBackground("#0f172a").setFontColor("#38bdf8").setFontWeight("bold").setHorizontalAlignment("center");
  sRanges.setFrozenRows(1);
  sRanges.setColumnWidth(1, 160);
  sRanges.setColumnWidth(5, 190);
  sRanges.setColumnWidth(6, 190);
  sRanges.setColumnWidth(9, 260);

  // 2. Aba Cadastros_Mineradores (Payout Ledger)
  let sCad = ss.getSheetByName("Cadastros_Mineradores");
  if (!sCad) sCad = ss.insertSheet("Cadastros_Mineradores");
  sCad.clear();
  const hCad = [
    "Data de Registro", "Apelido / Worker", "Carteira Bitcoin (Payout BTC)", 
    "Equipamento / Hardware", "Contato (Telegram/Email)", "Status da Conta", 
    "Fatias Concluídas", "Cota Estimada (%)"
  ];
  sCad.getRange(1, 1, 1, hCad.length).setValues([hCad])
    .setBackground("#064e3b").setFontColor("#34d399").setFontWeight("bold").setHorizontalAlignment("center");
  sCad.setFrozenRows(1);
  sCad.setColumnWidth(1, 150);
  sCad.setColumnWidth(2, 160);
  sCad.setColumnWidth(3, 310);
  sCad.setColumnWidth(4, 200);
  sCad.setColumnWidth(5, 180);

  // 3. Aba Contrato_Rateio_Regras
  popularContratoRegrasRateio();

  // 4. Aba Status_Pool_Live
  let sStatus = ss.getSheetByName("Status_Pool_Live");
  if (!sStatus) sStatus = ss.insertSheet("Status_Pool_Live");
  sStatus.clear();
  const hStatus = ["Parâmetro Oficial da Pool", "Valor Atual", "Notas / Regras"];
  sStatus.getRange(1, 1, 1, hStatus.length).setValues([hStatus])
    .setBackground("#1e1b4b").setFontColor("#a78bfa").setFontWeight("bold").setHorizontalAlignment("center");
  sStatus.setFrozenRows(1);

  const statusRows = [
    ["Desafio Alvo", "Bitcoin Puzzle #71", "7.10 BTC em disputa pública"],
    ["Endereço Alvo Bitcoin", "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU", "Carteira do prêmio"],
    ["Prêmio Estimado", "7.1000 BTC (~R$ 2.500.000 / $461.500 USD)", "Valor bruto"],
    ["Divisão da Comunidade (85%)", "6.0350 BTC (~R$ 2.125.000)", "Rateio proporcional para os mineradores"],
    ["Taxa da Casa (15%)", "1.0650 BTC (~R$ 375.000)", "Infraestrutura, servidores e IA"],
    ["Mínimo para Recebimento On-Chain", "100 Milhões de Chaves (~10 Micro-lotes)", "Cláusula Anti-Poeira para poupar miner fee"],
    ["Algoritmo Principal", "Kangaroo Pollard O(√N) + IA Keyspace", "Exclusão ativa de blocos lidos"]
  ];
  sStatus.getRange(2, 1, statusRows.length, hStatus.length).setValues(statusRows);
  sStatus.setColumnWidth(1, 240);
  sStatus.setColumnWidth(2, 320);
  sStatus.setColumnWidth(3, 300);

  // 5. Aba Benchmarks_GPU
  popularTabelaBenchmarksGPU();

  showAlert("🎉 [PuzzleRadar v5.3] Todas as abas foram instaladas e formatadas com sucesso!\n\n1. Ranges_Varredura\n2. Cadastros_Mineradores\n3. Contrato_Rateio_Regras\n4. Status_Pool_Live\n5. Benchmarks_GPU");
}

/**
 * 📜 Regras Oficiais do Rateio e Contrato Comunitário
 */
function popularContratoRegrasRateio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Contrato_Rateio_Regras");
  if (!sheet) sheet = ss.insertSheet("Contrato_Rateio_Regras");
  sheet.clear();

  const headers = ["Cláusula do Contrato", "Definição Oficial", "Regulamento Técnico"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground("#78350f").setFontColor("#fde68a").setFontWeight("bold").setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  const regras = [
    ["1. Divisão do Prêmio (85% / 15%)", "85% para a Comunidade de Mineradores e 15% Taxa da Casa", "No momento do resgate dos 7.10 BTC, 85% (6.035 BTC) é dividido proporcionalmente às fatias checadas. 15% sustenta a infraestrutura da IA."],
    ["2. Cláusula Anti-Poeira (Mínimo de Trabalho)", "Mínimo de 100 Milhões de Chaves Validadas (~10 Micro-lotes)", "Para evitar queimar fundos pagando taxa de rede da blockchain Bitcoin (R$ 20 a R$ 50 de miner fee) para quem minerou por 1 minuto e saiu, apenas quem atingir o mínimo recebe envio on-chain."],
    ["3. Payout Direto em Carteira Bitcoin", "Endereço Próprio do Minerador (P2PKH, SegWit, Bech32)", "O pagamento é enviado diretamente para a carteira Bitcoin cadastrada pelo minerador na aba 'Cadastros_Mineradores'."],
    ["4. Toda Chave Verificada Conta", "Chaves Reais Validadas", "Mesmo que a fatia de 2^45 não seja fechada na pool oficial, toda chave checada contra o endereço do Bitcoin pontua normalmente."],
    ["5. Zero Barreira / Sem Aluguel", "100% Gratuito e Participativo", "Nenhum participante paga taxa adiantada ou aluguel. O alinhamento é total no êxito."]
  ];

  sheet.getRange(2, 1, regras.length, headers.length).setValues(regras);
  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidth(2, 330);
  sheet.setColumnWidth(3, 450);
}

/**
 * 🔄 Sincronizar Métricas ao Vivo da Pool Oficial btcpuzzle.info
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
    let sheetStats = ss.getSheetByName("Status_Pool_Live");
    if (!sheetStats) sheetStats = ss.insertSheet("Status_Pool_Live");

    sheetStats.appendRow(["--- Sincronização API Oficial ---", new Date().toISOString(), "Consulta Automática"]);
    sheetStats.appendRow(["Fatias Globais btcpuzzle.info", data.scannedRanges || "N/A", "Fatias completadas mundialmente"]);
    sheetStats.appendRow(["Porcentagem da Pool Oficial", (data.completionPercent || 0) + "%", "Progresso da pool central"]);

    showAlert("✅ Métricas da Pool Oficial sincronizadas com sucesso!");
  } catch (e) {
    showAlert("❌ Erro ao consultar API oficial: " + e.message);
  }
}

/**
 * 📊 Tabela de Benchmarks de GPU
 */
function popularTabelaBenchmarksGPU() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetGpu = ss.getSheetByName("Benchmarks_GPU");
  if (!sheetGpu) sheetGpu = ss.insertSheet("Benchmarks_GPU");

  sheetGpu.clear();
  const headers = ["Modelo de GPU", "VRAM", "Hashrate Estimado", "Fatias/Dia (2^40)", "Custo de Energia Estimado"];
  sheetGpu.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground("#312e81").setFontColor("#c7d2fe").setFontWeight("bold").setHorizontalAlignment("center");
  sheetGpu.setFrozenRows(1);

  const benchmarks = [
    ["NVIDIA RTX 4090", "24 GB", "2.8 GKey/s", "220", "$1.20/dia"],
    ["NVIDIA RTX 4080", "16 GB", "1.9 GKey/s", "150", "$0.85/dia"],
    ["NVIDIA RTX 3090 Ti", "24 GB", "1.7 GKey/s", "135", "$1.40/dia"],
    ["NVIDIA RTX 3080", "10 GB", "1.2 GKey/s", "95", "$0.90/dia"],
    ["Tesla T4 (Nuvens / Colab)", "16 GB", "350 MKey/s", "28", "Gratuito / Nuvens"],
    ["NVIDIA A100 SXM4", "80 GB", "4.5 GKey/s", "350", "$2.50/dia"]
  ];

  sheetGpu.getRange(2, 1, benchmarks.length, headers.length).setValues(benchmarks);
  sheetGpu.setColumnWidth(1, 200);
  sheetGpu.setColumnWidth(3, 160);
}