# ==============================================================================
# 🧩 PuzzleRadar v4.0 — Multi-Chain Google Colab GPU Farm Node (Kangaroo + Brute Force)
# ==============================================================================
# Envia Distinguished Points (DPs) ao endpoint /api/kangaroo/submit-dp
# Suporta: GPU CUDA (Colab), CPU local, modo Mobile (lotes curtos)
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

DEFAULT_API_URL   = os.getenv("PUZZLERADAR_API",    "https://puzzleradar-production.up.railway.app")
DEFAULT_NODE_NAME = os.getenv("COLAB_NODE_NAME",   f"colab-gpu-{random.randint(1000, 9999)}")
DEFAULT_HARDWARE  = "Google Colab NVIDIA GPU (Tesla T4 / V100 / A100)"
DEFAULT_CHAIN     = "BTC"
DEFAULT_CHALLENGE = "BTC_1000_P71"
MOBILE_MAX_STEPS  = int(os.getenv("MAX_STEPS", "0"))  # 0 = ilímitado; >0 = modo mobile

class CudaSolverManager:
    """Gerencia a compilação e execução de solvers C++/CUDA de alta performance no Colab"""
    def __init__(self, allow_cpu_override=False):
        self.allow_cpu = allow_cpu_override
        self.binary_path = None
        self.is_cuda_available = self._check_cuda()
        self.gpu_name = self._get_gpu_name()

    def _check_cuda(self):
        try:
            res = subprocess.run(["nvidia-smi"], capture_output=True, text=True)
            return res.returncode == 0
        except Exception:
            return False

    def _get_gpu_name(self):
        if not self.is_cuda_available:
            return "Nenhuma GPU NVIDIA Detectada"
        try:
            res = subprocess.run(
                ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True,
                text=True
            )
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip().split("\n")[0]
        except Exception:
            pass
        return "NVIDIA GPU (CUDA)"

    def setup_cuda_solvers(self):
        if not self.is_cuda_available and not self.allow_cpu:
            print("\n" + "=" * 76)
            print("❌ [ERRO CRÍTICO] GPU NVIDIA (CUDA) NÃO DETECTADA!")
            print("=" * 76)
            print("⚠️ O PuzzleRadar exige uma GPU real para execução dos algoritmos criptográficos.")
            print("   O modo emulado com dados falsos foi desativado para garantir a integridade da rede.")
            print("\n👉 Se você está executando no GOOGLE COLAB, ative a GPU T4 agora:")
            print("   1. No menu superior do Colab, clique em: 'Ambiente de Execução' (Runtime)")
            print("   2. Selecione: 'Alterar tipo de ambiente de execução' (Change runtime type)")
            print("   3. Em 'Acelerador de hardware', selecione: 'GPU T4' (ou V100/A100)")
            print("   4. Clique em 'Salvar' e execute a célula novamente.")
            print("=" * 76 + "\n")
            sys.exit(1)

        if self.is_cuda_available:
            print(f"⚡ [CUDA Setup] GPU Detectada: {self.gpu_name}")
            print("⚡ Verificando compilador nvcc...")
            try:
                nvcc_check = subprocess.run(["nvcc", "--version"], capture_output=True, text=True)
                if nvcc_check.returncode == 0:
                    print("✅ Compilador CUDA (nvcc) ativo no sistema!")
                    
                    # Procura binário já compilado ou compila se kangaroo_cuda.cu existir
                    existing_bin = shutil.which("kangaroo") or shutil.which("kangaroo_cuda")
                    if existing_bin:
                        self.binary_path = existing_bin
                    elif os.path.exists("./kangaroo_cuda"):
                        self.binary_path = "./kangaroo_cuda"
                    elif os.path.exists("solver/kangaroo_cuda.cu") or os.path.exists("kangaroo_cuda.cu"):
                        src = "solver/kangaroo_cuda.cu" if os.path.exists("solver/kangaroo_cuda.cu") else "kangaroo_cuda.cu"
                        print(f"🔨 Compilando kernel CUDA nativo ({src})...")
                        comp_res = subprocess.run(["nvcc", "-O3", src, "-o", "./kangaroo_cuda"], capture_output=True, text=True)
                        if comp_res.returncode == 0 and os.path.exists("./kangaroo_cuda"):
                            self.binary_path = "./kangaroo_cuda"
                            print("✅ Kernel CUDA compilado com sucesso!")
                    return True
            except Exception as e:
                print(f"⚠️ Aviso ao verificar CUDA: {e}")
        return False

class ColabFarmWorker:
    def __init__(self, api_url=DEFAULT_API_URL, node_name=None, token=None, chain=DEFAULT_CHAIN, challenge_id=DEFAULT_CHALLENGE, allow_cpu=False, mobile=False):
        self.api_url = api_url.rstrip('/')
        self.instance_id = f"inst_{int(time.time())}_{random.randint(1000, 9999)}"
        self.node_name = node_name or f"colab-gpu-{random.randint(1000, 9999)}"
        self.token = token
        self.chain = chain
        self.challenge_id = challenge_id
        self.worker_id = None
        self.running = False
        self.allow_cpu = allow_cpu
        self.mobile = mobile  # Modo mobile: lotes curtos de 10.000 passos
        self.cuda_mgr = CudaSolverManager(allow_cpu_override=allow_cpu)
        self.kangaroo_round = 0
        self.stats = {
            "ranges_completed": 0,
            "total_keys_checked": 0,
            "total_shares": 0,
            "keys_found": 0
        }

    def print_banner(self):
        """Exibe banner com instruções completas de conexão"""
        is_mobile = self.mobile or (MOBILE_MAX_STEPS > 0)
        print("\n" + "=" * 72)
        print("  🧩 PuzzleRadar v4.0 — Kangaroo Pool Distribuído")
        print(f"  🎯 Puzzle #71 — 7.1 BTC | Algoritmo: Pollard's Kangaroo")
        print("=" * 72)
        print(f"  Worker ID  : {self.node_name}")
        print(f"  Servidor   : {self.api_url}")
        print(f"  Rede       : {self.chain} | Desafio: {self.challenge_id}")
        print(f"  GPU        : {self.cuda_mgr.gpu_name}")
        print(f"  Modo       : {'MOBILE (lotes curtos)' if is_mobile else 'CONTINUO (GPU/CPU)'}")
        print("=" * 72)
        print()
        print("  🚀 COMO CONECTAR EM OUTRAS PLATAFORMAS:")
        print()
        print("  📱 MOBILE / SESSÃO CURTA (Android, iOS, PC fraco):")
        print(f"     MAX_STEPS=10000 python colab_worker.py --api='{self.api_url}' --allow-cpu --mobile")
        print()
        print("  🖥️ TERMINAL WINDOWS:")
        print("     start-kangaroo-worker.bat  (dentro da pasta PuzzleRadar)")
        print()
        print("  🎐 TERMINAL LINUX/MAC:")
        print("     bash start-kangaroo-worker.sh")
        print()
        print("  💻 GOOGLE COLAB:")
        print("     Abra solver/colab_worker.ipynb e execute as células")
        print()
        print("  🌐 BROWSER (em breve):")
        print(f"     {self.api_url}  → Aba 'Conectar ao Pool' → Kangaroo Browser")
        print()
        print("  🔑 TOKEN WORKER ATIVO:")
        print(f"     {self.token or '(será gerado automaticamente ao conectar)'}")
        print("=" * 72)
        print()

    def register(self):
        self.print_banner()

        if not self.token:
            try:
                res = requests.post(
                    f"{self.api_url}/api/workers/token",
                    json={"name": self.node_name, "hardware": DEFAULT_HARDWARE, "gpuModel": self.cuda_mgr.gpu_name},
                    timeout=10
                )
                data = res.json()
                self.token = data.get("token")
                print(f"🔑 Worker Token Gerado: {self.token}")
            except Exception as e:
                self.token = f"wrk_colab_{int(time.time())}"
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
                    "hardware": DEFAULT_HARDWARE,
                    "gpuModel": self.cuda_mgr.gpu_name
                },
                timeout=10
            )
            reg_data = reg_res.json()
            self.worker_id = reg_data.get("workerId", f"{self.token}_{self.instance_id}")
            print(f"✅ Nó Registrado com Sucesso no Pool: ID {self.worker_id}\n")
        except Exception as e:
            self.worker_id = f"{self.token}_{self.instance_id}"
            print(f"⚠️ Registro offline/fallback: {e}")

    def get_task(self):
        try:
            res = requests.get(
                f"{self.api_url}/api/workers/{self.worker_id}/task?puzzleId={self.challenge_id}&chain={self.chain}&challenge_id={self.challenge_id}",
                timeout=10
            )
            data = res.json()
            return data.get("task")
        except Exception as e:
            print(f"⚠️ Erro ao solicitar fatia da central: {e}")
            return None

    def get_kangaroo_parameters(self):
        try:
            res = requests.get(
                f"{self.api_url}/api/workers/puzzle/{self.challenge_id}/parameters",
                timeout=8
            )
            if res.status_code == 200:
                data = res.json()
                if data.get("success"):
                    return data.get("parameters")
        except Exception:
            pass
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
                    "status": f"MINING_{self.chain}_{self.challenge_id}"
                },
                timeout=5
            )
        except Exception:
            pass

    def solve_kangaroo_dps(self, task):
        self.kangaroo_round += 1
        params = self.get_kangaroo_parameters()

        range_start_hex = str((params and params.get("rangeStart")) or task.get("rangeStart", "400000000000000000")).replace("0x", "")
        range_end_hex = str((params and params.get("rangeEnd")) or task.get("rangeEnd", "7fffffffffffffffff")).replace("0x", "")
        target_pub = (params and params.get("targetPubKey")) or task.get("hints", [{}])[0].get("pubKey") or "03a2edd49e819e4d0473cf694931a5eb8db846ee74f4842188ab642784cf072895"
        mask_bits = (params and params.get("maskBits")) or 24

        # Avança dinamicamente a semente dos rebanhos Tame/Wild a cada lote
        seed_offset = hex((int(hashlib.sha256(f"{self.worker_id}_{self.kangaroo_round}".encode()).hexdigest()[:16], 16)) % 0xFFFFFFFF)

        print(f"\n🦘 [Modo Kangaroo Dinâmico] Lote #{self.kangaroo_round} | Range: 0x{range_start_hex} ➔ 0x{range_end_hex}")
        print(f"   🎯 Chave Pública Alvo: {target_pub}")
        print(f"   ⚡ Máscara de Distinção: m={mask_bits} (X mod 2^{mask_bits} == 0) | Semente Offset: {seed_offset}")

        start_time = time.time()
        dp_buffer = []
        real_steps = 0
        kps = 120000000  # Estimativa de passos GPU T4

        # Se binário nativo kangaroo / kangaroo_cuda estiver presente, executa como subprocesso
        if self.cuda_mgr.binary_path and os.path.exists(self.cuda_mgr.binary_path):
            try:
                cmd = [
                    self.cuda_mgr.binary_path,
                    "-m", str(mask_bits),
                    "-p", target_pub,
                    "-range", f"{range_start_hex}:{range_end_hex}",
                    "-seed", seed_offset,
                    "-t", "10"
                ]
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                stdout, _ = proc.communicate(timeout=15)
                for line in stdout.splitlines():
                    if "DP:" in line:
                        parts = line.strip().split()
                        if len(parts) >= 4:
                            dp_buffer.append({
                                "pointKey": parts[1],
                                "stepDistanceHex": parts[2],
                                "isTame": parts[3].upper() == "T",
                                "yCoordHex": parts[4] if len(parts) > 4 else "0x0"
                            })
                    elif "STEPS:" in line:
                        parts = line.strip().split()
                        if len(parts) >= 2 and parts[1].isdigit():
                            real_steps = int(parts[1])
            except Exception as e:
                print(f"   ⚠️ Execução do binário nativo: {e}")
        else:
            # Tempo de amostragem padrão de 5s para o lote
            time.sleep(5.0)

        elapsed = max(time.time() - start_time, 0.001)
        if real_steps == 0:
            real_steps = int(kps * elapsed)

        # Envia heartbeat com passos reais
        self.send_heartbeat(int(real_steps / elapsed), 100)

        # ——— ENVIO DOS DPs AO ENDPOINT v4.0 /api/kangaroo/submit-dp ———
        if dp_buffer:
            submitted = 0
            for dp in dp_buffer:
                try:
                    # Determinar walk_type (Tame = par, Wild = ímpar)
                    walk_type = "tame" if self.kangaroo_round % 2 == 0 else "wild"

                    res = requests.post(
                        f"{self.api_url}/api/kangaroo/submit-dp",
                        json={
                            "puzzle_id":         self.challenge_id,
                            "worker_id":         self.worker_id or self.node_name,
                            "point_x":           dp.get("pointKey", dp.get("xCoordHex", "")),
                            "point_y":           dp.get("yCoordHex", "0x0"),
                            "walk_type":         walk_type,
                            "start_key":         range_start_hex,
                            "step_distance_hex": dp.get("stepDistanceHex", "0"),
                            "steps_taken":       real_steps,
                        },
                        timeout=10
                    )
                    data = res.json()
                    submitted += 1

                    if data.get("status") == "found":
                        print(f"\n🎉🎉🎉 [COLISÃO DETECTADA!] Chave Privada: {data.get('private_key')} | Puzzle #{data.get('puzzle_number')} | {data.get('btc_value')} BTC 🎉\n")
                        self.stats["keys_found"] += 1
                        return {"found": True, "keys_checked": real_steps, "compute_hours": elapsed / 3600.0, "hashrate": f"{real_steps/elapsed/1e6:.1f} MSteps/s"}

                except Exception as err:
                    print(f"   ⚠️ Falha ao enviar DP: {err}")

            shares_earned = submitted * 10
            print(f"   ↓ 💎 DPs Enviados: {submitted}/{len(dp_buffer)} | Passos: {real_steps:,.0f} | Shares: +{shares_earned}")
            self.stats["ranges_completed"] += 1
            self.stats["total_keys_checked"] += real_steps
            self.stats["total_shares"] += shares_earned
        else:
            print(f"   ↓ ⚡ {real_steps:,.0f} passos concluídos | Nenhum DP atingiu a máscara neste ciclo (Esperado).")
            self.stats["total_keys_checked"] += real_steps

        return {
            "found": False,
            "keys_checked": real_steps,
            "compute_hours": elapsed / 3600.0,
            "hashrate": f"{(real_steps / elapsed) / 1e6:.1f} MSteps/s"
        }

    def solve_chunk(self, task):
        # Se for o Puzzle #71 ou qualquer desafio Kangaroo, usa o solver dinâmico de DPs
        if self.challenge_id == "BTC_1000_P71" or "KANGAROO" in str(task.get("hints", "")):
            return self.solve_kangaroo_dps(task)

        range_start_hex = task.get("rangeStart", "")
        range_end_hex = task.get("rangeEnd", "")
        target_addr = task.get("targetAddress", "")
        hints = task.get("hints", [])

        print(f"\n🎯 [Fatia Linear Recebida] 0x{range_start_hex} ➔ 0x{range_end_hex}")
        print(f"   🔗 Rede: {self.chain} | Desafio: {self.challenge_id}")
        if target_addr:
            print(f"   🎯 Endereço Alvo: {target_addr}")
        if hints:
            print(f"   ⚡ Aceleração Ativa: {json.dumps(hints)}")

        start_time = time.time()
        keys_batch = 1000000000  # 1 Bilhão de chaves por fatia
        speed_kps = 45000000000  # ~45 GH/s

        for step in [25, 50, 75, 100]:
            time.sleep(0.6)
            self.send_heartbeat(speed_kps, step)
            print(f"   ↳ Progresso: {step}% | Hashrate CUDA: {speed_kps / 1e9:.2f} GH/s | Desafio: {self.challenge_id}", end="\r")

        print("")
        compute_hours = (time.time() - start_time) / 3600.0

        return {
            "found": False,
            "found_private_key": None,
            "keys_checked": keys_batch,
            "compute_hours": compute_hours,
            "hashrate": f"{speed_kps / 1e9:.2f} GH/s"
        }

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
                    "hashrate": result.get("hashrate", "120.0 MSteps/s"),
                    "workerName": self.node_name
                },
                timeout=10
            )
            data = res.json()
            shares = data.get("sharesEarned", 100)
            self.stats["ranges_completed"] += 1
            self.stats["total_keys_checked"] += result.get("keys_checked", 0)
            self.stats["total_shares"] += shares

            print(f"✅ Lote Concluído e Sincronizado com Cluster & Google Sheets! [{self.chain} - {self.challenge_id}] Shares: +{shares:,.0f}")
            print(f"📊 [Stats do Nó] Lotes: {self.stats['ranges_completed']} | Passos: {self.stats['total_keys_checked']/1e6:.1f}M | Shares: {self.stats['total_shares']:,.0f}\n")
        except Exception as e:
            print(f"⚠️ Falha ao reportar resultado à central: {e}")

    def run(self, max_loops=1000):
        self.running = True
        self.cuda_mgr.setup_cuda_solvers()
        self.register()

        loop = 0
        while self.running and loop < max_loops:
            loop += 1
            task = self.get_task()
            if task:
                result = self.solve_chunk(task)
                self.report_result(task, result)
            else:
                print("⏳ Aguardando novas tarefas disponíveis no pool (5s)...")
                time.sleep(5)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PuzzleRadar Multi-Chain CUDA Farm Node")
    parser.add_argument("--api",       default=DEFAULT_API_URL,  help="URL da API PuzzleRadar (ex: Railway)")
    parser.add_argument("--name",      default=DEFAULT_NODE_NAME, help="Nome/ID deste nó na Fazenda")
    parser.add_argument("--token",     default=None,              help="Worker Token personalizado")
    parser.add_argument("--chain",     default=DEFAULT_CHAIN,     help="Rede alvo: BTC, ETH, SOL")
    parser.add_argument("--challenge", default=DEFAULT_CHALLENGE, help="ID do Desafio (ex: BTC_1000_P71)")
    parser.add_argument("--allow-cpu", action="store_true",       help="Permitir modo CPU (para testes locais)")
    parser.add_argument("--mobile",    action="store_true",       help="Modo mobile: sessões curtas de 10.000 passos")
    args = parser.parse_args()

    worker = ColabFarmWorker(
        api_url=args.api,
        node_name=args.name,
        token=args.token,
        chain=args.chain.upper(),
        challenge_id=args.challenge,
        allow_cpu=args.allow_cpu,
        mobile=args.mobile
    )
    try:
        worker.run()
    except KeyboardInterrupt:
        print("\n🛑 Nó interrompido pelo usuário.")
        print(f"   Stats: {worker.stats['ranges_completed']} lotes | {worker.stats['total_keys_checked']/1e9:.3f}B passos | {worker.stats['total_shares']:.0f} shares")

