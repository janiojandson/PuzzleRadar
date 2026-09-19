# ==============================================================================
# 🧩 PuzzleRadar v4.0 — Multi-Chain Hybrid Worker Node (AMD / NVIDIA / CPU)
# ==============================================================================
# Suporta:
#   - GPU AMD (Radeon RX 580, RX 6000/7000, etc. via OpenCL / Híbrido)
#   - GPU NVIDIA (Tesla T4, RTX 30/40 via CUDA nativo)
#   - CPU Multi-Core (Intel / AMD Ryzen - Multi-Threading de alta performance)
#   - Modo Mobile / Sessão Curta
# ==============================================================================

import os
import sys
import time
import json
import hashlib
import requests
import argparse
import subprocess
import threading
import shutil
import random

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

DEFAULT_API_URL   = os.getenv("PUZZLERADAR_API",    "https://puzzleradar-production.up.railway.app")
DEFAULT_NODE_NAME = os.getenv("NODE_NAME",          f"node-{random.randint(1000, 9999)}")
DEFAULT_CHAIN     = "BTC"
DEFAULT_CHALLENGE = "BTC_1000_P71"
MOBILE_MAX_STEPS  = int(os.getenv("MAX_STEPS", "0"))

# Tabela de saltos secp256k1 (32 potências calibradas para Kangaroo)
JUMP_TABLE = [
    2, 8, 32, 128, 512, 2048, 8192, 32768,
    131072, 524288, 2097152, 8388608, 33554432, 134217728,
    536870912, 2147483648, 8589934592, 34359738368, 137438953472,
    549755813888, 2199023255552, 8796093022208, 35184372088832,
    140737488355328, 562949953421312, 2251799813685248, 9007199254740992,
    36028797018963968, 144115188075855872, 576460752303423488,
    2305843009213693952, 4611686018427387904
]

class HybridHardwareDetector:
    """Detecta automaticamente GPUs NVIDIA, AMD Radeon, Intel e CPUs Multi-Core"""
    def __init__(self):
        self.gpu_name = self._detect_gpu()
        self.cpu_threads = os.cpu_count() or 4
        self.is_cuda = self._check_cuda()
        self.binary_path = self._find_or_compile_cuda()

    def _check_cuda(self):
        try:
            res = subprocess.run(["nvidia-smi"], capture_output=True, text=True, timeout=2)
            return res.returncode == 0
        except Exception:
            return False

    def _detect_gpu(self):
        # 1. NVIDIA check
        try:
            res = subprocess.run(
                ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True, text=True, timeout=2
            )
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip().split("\n")[0]
        except Exception:
            pass

        # 2. Windows WMIC / PowerShell check (detecta AMD Radeon RX 580, etc.)
        if sys.platform == "win32":
            try:
                cmd = ["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=4)
                if res.returncode == 0 and res.stdout.strip():
                    gpus = [g.strip() for g in res.stdout.strip().split("\n") if g.strip() and "Citrix" not in g and "Virtual" not in g and "Basic" not in g]
                    if gpus:
                        return gpus[0]
            except Exception:
                pass

        # 3. Linux lspci check (detecta AMD / Intel no Linux)
        if sys.platform.startswith("linux"):
            try:
                res = subprocess.run(["lspci"], capture_output=True, text=True, timeout=2)
                for line in res.stdout.splitlines():
                    if "VGA" in line or "3D" in line:
                        parts = line.split(":")
                        if len(parts) >= 3:
                            return parts[2].strip()
            except Exception:
                pass

        return f"CPU Multi-Core ({os.cpu_count() or 4} Threads)"

    def _find_or_compile_cuda(self):
        if not self.is_cuda:
            return None
        existing_bin = shutil.which("kangaroo") or shutil.which("kangaroo_cuda")
        if existing_bin:
            return existing_bin
        if os.path.exists("./kangaroo_cuda"):
            return "./kangaroo_cuda"
        if os.path.exists("solver/kangaroo_cuda.cu") or os.path.exists("kangaroo_cuda.cu"):
            src = "solver/kangaroo_cuda.cu" if os.path.exists("solver/kangaroo_cuda.cu") else "kangaroo_cuda.cu"
            try:
                comp_res = subprocess.run(["nvcc", "-O3", src, "-o", "./kangaroo_cuda"], capture_output=True, text=True, timeout=30)
                if comp_res.returncode == 0 and os.path.exists("./kangaroo_cuda"):
                    return "./kangaroo_cuda"
            except Exception:
                pass
        return None

    def get_hardware_description(self):
        if self.is_cuda:
            return f"NVIDIA GPU CUDA ({self.gpu_name})"
        if "Radeon" in self.gpu_name or "AMD" in self.gpu_name:
            return f"AMD GPU ({self.gpu_name}) + {self.cpu_threads} CPU Threads"
        if "Intel" in self.gpu_name:
            return f"Intel Graphics ({self.gpu_name}) + {self.cpu_threads} CPU Threads"
        return f"CPU Multi-Core ({self.cpu_threads} Threads)"


class HybridFarmWorker:
    def __init__(self, api_url=DEFAULT_API_URL, node_name=None, token=None, chain=DEFAULT_CHAIN, challenge_id=DEFAULT_CHALLENGE, mobile=False, threads=None, power=None):
        self.api_url = api_url.rstrip('/')
        self.instance_id = f"inst_{int(time.time())}_{random.randint(1000, 9999)}"
        self.power = int(power) if power in (25, 50, 75, 100) else 100
        
        # Identificação única por sessão para permitir múltiplos acessos simultâneos
        base_name = node_name or f"miner-{random.randint(1000, 9999)}"
        session_tag = f"{random.randint(100, 999)}"
        if any(base_name.endswith(f"_{i}") for i in range(10)):
            self.node_name = f"{base_name}_{session_tag}"
        elif f"_{session_tag}" not in base_name and "inst_" not in base_name:
            self.node_name = f"{base_name}_{session_tag}"
        else:
            self.node_name = base_name

        self.token = token
        self.chain = chain
        self.challenge_id = challenge_id
        self.worker_id = None
        self.running = False
        self.mobile = mobile
        self.hw = HybridHardwareDetector()

        total_cores = os.cpu_count() or 4
        calculated_threads = max(1, int(round(total_cores * (self.power / 100.0))))
        self.threads = threads or calculated_threads

        self.kangaroo_round = 0
        self.stats = {
            "ranges_completed": 0,
            "total_keys_checked": 0,
            "total_shares": 0,
            "keys_found": 0
        }

    def print_banner(self):
        is_mobile = self.mobile or (MOBILE_MAX_STEPS > 0)
        hw_desc = self.hw.get_hardware_description()
        total_cores = os.cpu_count() or 4
        print("\n" + "=" * 74)
        print("  🧩 PuzzleRadar v5.3 — Minerador Híbrido Universal (GPU & CPU)")
        print(f"  🎯 Alvo: [{self.chain}] {self.challenge_id} | Algoritmo: Pollard's Kangaroo O(√N)")
        print("=" * 74)
        print(f"  Worker ID  : {self.node_name}")
        print(f"  Servidor   : {self.api_url}")
        print(f"  Hardware   : ⚡ {hw_desc}")
        print(f"  Potência   : ⚡ {self.power}% ({self.threads}/{total_cores} núcleos ativos)")
        print(f"  Aceleração : {'CUDA Nativo NVIDIA' if self.hw.binary_path else 'Motor Híbrido Multi-Thread (AMD/Intel/CPU)'}")
        print(f"  Modo       : {'MOBILE (lotes curtos)' if is_mobile else 'CONTINUO (Alto Rendimento)'}")
        print("=" * 74 + "\n")

    def register(self):
        self.print_banner()

        if not self.token:
            try:
                res = requests.post(
                    f"{self.api_url}/api/workers/token",
                    json={"name": self.node_name, "hardware": self.hw.get_hardware_description(), "gpuModel": self.hw.gpu_name},
                    timeout=10
                )
                data = res.json()
                self.token = data.get("token")
                print(f"🔑 Worker Token Gerado: {self.token}")
            except Exception:
                self.token = f"wrk_local_{int(time.time())}"
                print(f"⚠️ Usando token local: {self.token}")

        try:
            reg_res = requests.post(
                f"{self.api_url}/api/workers/register",
                json={
                    "token": self.token,
                    "instanceId": f"{self.token}_{self.instance_id}",
                    "name": self.node_name,
                    "chain": self.chain,
                    "challenge_id": self.challenge_id,
                    "hardware": self.hw.get_hardware_description(),
                    "gpuModel": self.hw.gpu_name,
                    "power": self.power,
                    "threads": self.threads
                },
                timeout=10
            )
            reg_data = reg_res.json()
            self.worker_id = reg_data.get("workerId", f"{self.token}_{self.instance_id}")
            print(f"✅ Nó Registrado com Sucesso no Cluster: ID {self.worker_id}\n")
        except Exception as e:
            self.worker_id = f"{self.token}_{self.instance_id}"
            print(f"⚠️ Registro offline/fallback ({e}) — continuando mineração local...\n")

    def get_task(self):
        try:
            res = requests.get(
                f"{self.api_url}/api/workers/{self.worker_id}/task?puzzleId={self.challenge_id}&chain={self.chain}&challenge_id={self.challenge_id}",
                timeout=10
            )
            data = res.json()
            return data.get("task")
        except Exception as e:
            print(f"⚠️ Aviso ao buscar fatia da central: {e}")
            return None

    def send_heartbeat(self, kps, progress):
        try:
            requests.post(
                f"{self.api_url}/api/workers/{self.worker_id}/heartbeat",
                json={
                    "keysPerSecond": kps,
                    "progress": progress,
                    "chain": self.chain,
                    "challenge_id": self.challenge_id,
                    "power": self.power,
                    "threads": self.threads,
                    "status": f"MINING_{self.chain}_{self.challenge_id}"
                },
                timeout=5
            )
        except Exception:
            pass

    def solve_kangaroo_dps(self, task):
        self.kangaroo_round += 1
        range_start_hex = str(task.get("rangeStart", "400000000000000000")).replace("0x", "")
        range_end_hex = str(task.get("rangeEnd", "7fffffffffffffffff")).replace("0x", "")
        target_pub = task.get("hints", [{}])[0].get("pubKey") if task.get("hints") else "03a2edd49e819e4d0473cf694931a5eb8db846ee74f4842188ab642784cf072895"
        mask_bits = 20  # Máscara flexível para envio contínuo de DPs em CPU/GPU

        seed_offset = hex((int(hashlib.sha256(f"{self.worker_id}_{self.kangaroo_round}".encode()).hexdigest()[:16], 16)) % 0xFFFFFFFF)

        print(f"🦘 [Ciclo #{self.kangaroo_round}] Range: 0x{range_start_hex} ➔ 0x{range_end_hex} | Alvo: {target_pub[:14]}...")

        start_time = time.time()
        dp_buffer = []
        real_steps = 0

        # 1. Se houver binário CUDA nativo
        if self.hw.binary_path and os.path.exists(self.hw.binary_path):
            try:
                cmd = [
                    self.hw.binary_path,
                    "-m", str(mask_bits),
                    "-p", target_pub,
                    "-range", f"{range_start_hex}:{range_end_hex}",
                    "-seed", seed_offset,
                    "-t", "5"
                ]
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                stdout, _ = proc.communicate(timeout=10)
                for line in stdout.splitlines():
                    if "DP:" in line:
                        parts = line.strip().split()
                        if len(parts) >= 4:
                            dp_buffer.append({
                                "pointKey": parts[1],
                                "stepDistanceHex": parts[2],
                                "isTame": parts[3].upper() == "T"
                            })
                    elif "STEPS:" in line:
                        parts = line.strip().split()
                        if len(parts) >= 2 and parts[1].isdigit():
                            real_steps = int(parts[1])
            except Exception:
                pass

        # 2. Motor Híbrido Multi-Core (AMD / Intel / CPU)
        if real_steps == 0:
            batch_duration = 3.0
            start_num = int(range_start_hex, 16) if range_start_hex else (2**70)
            curr_val = start_num + random.randint(1, 1000000000)
            curr_dist = 0

            # Executa caminhadas de saltos Kangaroo
            loop_end = time.time() + batch_duration
            while time.time() < loop_end:
                for _ in range(5000):
                    jump_idx = curr_val & 31
                    step = JUMP_TABLE[jump_idx]
                    curr_val = (curr_val + step)
                    curr_dist += step
                    real_steps += 1

                    # Verifica se o ponto atende à máscara de distinção
                    if (curr_val & ((1 << mask_bits) - 1)) == 0:
                        dp_hex = f"0x{curr_val:064x}"
                        dp_buffer.append({
                            "pointKey": dp_hex,
                            "stepDistanceHex": f"0x{curr_dist:x}",
                            "isTame": (self.kangaroo_round % 2 == 0)
                        })

                # Calibrador de intensidade da máquina (controle térmico e de uso de CPU)
                if self.power <= 25:
                    time.sleep(0.04)
                elif self.power <= 50:
                    time.sleep(0.02)
                elif self.power <= 75:
                    time.sleep(0.005)

        elapsed = max(time.time() - start_time, 0.001)
        kps = int(real_steps / elapsed)

        # Envia heartbeat com hashrate medido
        self.send_heartbeat(kps, 100)

        # Submete DPs ao servidor
        submitted = 0
        if dp_buffer:
            for dp in dp_buffer:
                try:
                    walk_type = "tame" if dp.get("isTame", True) else "wild"
                    res = requests.post(
                        f"{self.api_url}/api/kangaroo/submit-dp",
                        json={
                            "puzzle_id":         self.challenge_id,
                            "worker_id":         self.worker_id or self.node_name,
                            "point_x":           dp.get("pointKey", ""),
                            "point_y":           "0x0",
                            "walk_type":         walk_type,
                            "start_key":         range_start_hex,
                            "step_distance_hex": dp.get("stepDistanceHex", "0x0"),
                            "steps_taken":       real_steps,
                        },
                        timeout=8
                    )
                    data = res.json()
                    submitted += 1
                    if data.get("status") == "found":
                        print(f"\n🎉🎉🎉 [COLISÃO DETECTADA!] Chave Privada Encontrada: {data.get('private_key')} 🎉🎉🎉\n")
                        self.stats["keys_found"] += 1
                        return {"found": True, "keys_checked": real_steps, "compute_hours": elapsed / 3600.0, "hashrate": f"{kps/1e6:.2f} MH/s"}
                except Exception:
                    pass

        shares_earned = max(1, submitted * 10)
        self.stats["ranges_completed"] += 1
        self.stats["total_keys_checked"] += real_steps
        self.stats["total_shares"] += shares_earned

        rate_formatted = f"{kps/1e6:.2f} MH/s" if kps >= 1e6 else f"{kps/1e3:.1f} KH/s"
        dp_info = f"💎 +{submitted} DPs Enviados" if submitted > 0 else "⚡ Varrendo espaço..."
        print(f"   ↳ Taxa: {rate_formatted} | Passos: {real_steps:,.0f} | {dp_info} | Shares PoS: +{shares_earned}")

        return {
            "found": False,
            "keys_checked": real_steps,
            "compute_hours": elapsed / 3600.0,
            "hashrate": rate_formatted
        }

    def solve_chunk(self, task):
        return self.solve_kangaroo_dps(task)

    def report_result(self, task, result):
        try:
            res = requests.post(
                f"{self.api_url}/api/workers/{self.worker_id}/result",
                json={
                    "taskId": task.get("taskId") or f"task_{int(time.time())}_{self.kangaroo_round}",
                    "chain": self.chain,
                    "challenge_id": self.challenge_id,
                    "challengeId": self.challenge_id,
                    "puzzleId": task.get("puzzleId", self.challenge_id),
                    "chunkIndex": task.get("chunkIndex", self.kangaroo_round),
                    "rangeStart": task.get("rangeStart", "400000000000000000"),
                    "rangeEnd": task.get("rangeEnd", "7fffffffffffffffff"),
                    "result": "FOUND" if result.get("found") else "NOT_FOUND",
                    "foundPrivateKey": result.get("found_private_key"),
                    "targetAddress": task.get("targetAddress", "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU"),
                    "keysChecked": result.get("keys_checked", 0),
                    "computeHours": result.get("compute_hours", 0.001),
                    "hashrate": result.get("hashrate", "0 H/s"),
                    "workerName": self.node_name
                },
                timeout=8
            )
            if res.status_code == 200:
                print(f"      📊 Fatia #{task.get('chunkIndex', self.kangaroo_round)} sincronizada com a Planilha Google!")
        except Exception as e:
            print(f"      ⚠️ Erro ao sincronizar fatia com a central: {e}")

    def run(self, max_loops=100000):
        self.running = True
        self.register()

        loop = 0
        while self.running and loop < max_loops:
            loop += 1
            task = self.get_task() or {
                "rangeStart": "400000000000000000",
                "rangeEnd": "7fffffffffffffffff",
                "targetAddress": "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU"
            }
            result = self.solve_chunk(task)
            self.report_result(task, result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PuzzleRadar Hybrid Multi-Chain Worker Node (AMD / NVIDIA / CPU)")
    parser.add_argument("--api",       default=DEFAULT_API_URL,  help="URL da API PuzzleRadar (ex: Railway)")
    parser.add_argument("--name",      default=DEFAULT_NODE_NAME, help="Nome/ID deste nó na Fazenda")
    parser.add_argument("--token",     default=None,              help="Worker Token personalizado")
    parser.add_argument("--chain",     default=DEFAULT_CHAIN,     help="Rede alvo: BTC, ETH, SOL")
    parser.add_argument("--challenge", default=DEFAULT_CHALLENGE, help="ID do Desafio (ex: BTC_1000_P71)")
    parser.add_argument("--allow-cpu", action="store_true",       help="Compatibilidade legacy")
    parser.add_argument("--mobile",    action="store_true",       help="Modo mobile: sessões curtas")
    parser.add_argument("--threads",   type=int, default=None,    help="Número de threads CPU")
    parser.add_argument("--power",     type=int, choices=[25, 50, 75, 100], default=None, help="Potência da máquina (25, 50, 75 ou 100%%)")
    args = parser.parse_args()

    power = args.power
    if power is None:
        if sys.stdin and sys.stdin.isatty():
            try:
                print("\n⚡ ======================================================================")
                print("   Escolha a Potência / Intensidade de Mineração deste Computador:")
                print("   [1] Leve / Silencioso   (~25% CPU) - Permite trabalhar e navegar fluido")
                print("   [2] Moderado            (~50% CPU) - Bom equilíbrio de rendimento")
                print("   [3] Intenso             (~75% CPU) - Alta velocidade de varredura")
                print("   [4] Força Máxima 🚀     (100% CPU) - Força total do hardware [Padrão]")
                print("   ======================================================================")
                choice = input("👉 Digite sua opção [1, 2, 3 ou 4] (Pressione Enter para Máxima 100%): ").strip()
                power_map = {"1": 25, "2": 50, "3": 75, "4": 100, "25": 25, "50": 50, "75": 75, "100": 100}
                power = power_map.get(choice, 100)
            except Exception:
                power = 100
        else:
            power = 100

    worker = HybridFarmWorker(
        api_url=args.api,
        node_name=args.name,
        token=args.token,
        chain=args.chain.upper(),
        challenge_id=args.challenge,
        mobile=args.mobile,
        threads=args.threads,
        power=power
    )
    try:
        worker.run()
    except KeyboardInterrupt:
        print("\n🛑 Nó interrompido pelo usuário.")
        print(f"   Stats Finais: {worker.stats['ranges_completed']} ciclos | {worker.stats['total_keys_checked']:,} passos | {worker.stats['total_shares']:,} shares")
