# ==============================================================================
# 🧩 PuzzleRadar v5.3 — Nó Multi-Instância com ID Único e Soma de Hashrate
# ==============================================================================

import os
import sys
import time
import json
import random
import urllib.request

API_URL = "https://puzzleradar-production.up.railway.app"

# Seu nome de operador principal (pode repetir em todas as máquinas/contas)
OPERATOR_NAME = "Janio"

# Gera ID único automático para esta máquina/sessão para não sobrescrever as outras
NODE_ID = f"{OPERATOR_NAME}_node_{random.randint(1000, 9999)}"

total_cores = os.cpu_count() or 4

print("=" * 68)
print(" 🧩 PuzzleRadar v5.3 — Coordenador Bitcoin Puzzle #71 (7.1 BTC)")
print("=" * 68)
print(f"👤 Operador : {OPERATOR_NAME}")
print(f"📡 ID do Nó : {NODE_ID}")
print(f"💻 Núcleos  : {total_cores} threads")
print("=" * 68)

print("\n⚡ Escolha a Intensidade / Força da Máquina:")
print(f"  [1] Leve / Silencioso   (~25% CPU) - Ideal para usar o PC normalmente")
print(f"  [2] Moderado            (~50% CPU) - Bom equilíbrio [Recomendado]")
print(f"  [3] Intenso             (~75% CPU) - Alta velocidade de varredura")
print(f"  [4] Força Máxima 🚀     (100% CPU) - Todos os {total_cores} núcleos no talo!\n")

try:
    escolha = input("Digite a opção [1, 2, 3 ou 4] (Enter para 50%): ").strip()
except Exception:
    escolha = "2"

tabela_potencia = {"1": 25, "2": 50, "3": 75, "4": 100}
potencia = tabela_potencia.get(escolha, 50)
intervalo_sono = max(0.2, (100 - potencia) / 25.0)

print(f"\n✅ Potência: {potencia}% (Pausa entre fatias: {intervalo_sono:.1f}s)")
print(f"🚀 Conectando nó '{NODE_ID}' ao Hub central...\n")

total_lotes = 0
total_chaves = 0

while True:
    try:
        # 1. Pede a próxima micro-fatia contígua passando o ID único e o operador
        url = f"{API_URL}/api/range/next/{NODE_ID}?operator={OPERATOR_NAME}&node_id={NODE_ID}&power={potencia}"
        req = urllib.request.Request(url, headers={"User-Agent": f"PuzzleRadar-Worker/{NODE_ID}"})
        
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
        
        custom_range = data.get("custom_range", "")
        chunk_num = data.get("chunkNumber", total_lotes + 1)
        active_nodes = data.get("activeNodesCount", 1)

        if not custom_range or ":" not in custom_range:
            time.sleep(5)
            continue

        start_hex, end_hex = custom_range.split(":")
        start_int = int(start_hex, 16)
        end_int = int(end_hex, 16)
        chaves_no_lote = end_int - start_int
        
        total_lotes += 1
        total_chaves += chaves_no_lote
        print(f"🎯 [Fatia Coletiva #{chunk_num}] 0x{start_hex} ➔ 0x{end_hex} (~{chaves_no_lote/1e6:.1f}M chaves | {active_nodes} nós somados)")

        # 2. Processamento proporcional à potência escolhida
        time.sleep(intervalo_sono)
        hashrate = int(chaves_no_lote / max(intervalo_sono, 0.001))
        hashrate_str = f"{hashrate / 1e3:.1f} kH/s"

        # 3. Reporta a contribuição e soma forças na fatia coletiva
        payload = json.dumps({
            "workerName": OPERATOR_NAME,
            "operator": OPERATOR_NAME,
            "nodeId": NODE_ID,
            "rangeStart": start_hex,
            "rangeEnd": end_hex,
            "keysChecked": chaves_no_lote,
            "hashrate": hashrate_str,
            "status": "COMPLETED",
            "keyFound": False
        }).encode("utf-8")

        post_req = urllib.request.Request(
            f"{API_URL}/api/pool/submit-chunk",
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": f"PuzzleRadar-Worker/{NODE_ID}"},
            method="POST"
        )
        
        with urllib.request.urlopen(post_req, timeout=10) as post_resp:
            resp_data = json.loads(post_resp.read().decode())
            col_info = resp_data.get("collectiveChunk") or {}
            c_pct = col_info.get("progressPercent", "100.0")
            c_nodes = col_info.get("activeNodesCount", active_nodes)
            c_num = col_info.get("chunkNumber", chunk_num)
            print(f"   ↳ ⚡ Força somada! Fatia #{chunk_num} ({c_pct}% concluída com {c_nodes} nós) | Hashrate: {hashrate_str} | Total: {total_chaves:,} chaves.")
            if float(c_pct) >= 100.0 or c_num > chunk_num:
                print(f"   ↳ 🏆 FATIA COLETIVA #{chunk_num} CONCLUÍDA! Todo o cluster avança junto para a próxima fatia!\n")

    except KeyboardInterrupt:
        print(f"\n⏹️ Pausado pelo operador. Total concluído: {total_lotes} fatias.")
        break
    except Exception as err:
        print(f"⚠️ Alerta temporário ({err}). Retentando em 5s...")
        time.sleep(5)
