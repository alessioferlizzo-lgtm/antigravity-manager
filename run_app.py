import subprocess
import time
import sys
import os
import signal

def kill_process_on_port(port):
    try:
        # Trova il PID del processo sulla porta specificata
        result = subprocess.check_output(["lsof", "-ti", f":{port}"]).decode().strip()
        if result:
            pids = result.split("\n")
            for pid in pids:
                print(f"⚠️  Terminazione processo esistente sulla porta {port} (PID: {pid})...")
                os.kill(int(pid), signal.SIGKILL)
            time.sleep(1)
    except subprocess.CalledProcessError:
        # Nessun processo trovato sulla porta
        pass
    except Exception as e:
        print(f"❌ Errore durante la pulizia della porta {port}: {e}")

def run_app():
    print("\n" + "="*50)
    print("🚀 DATABASE CLIENTI ANTIGRAVITY - AVVIO")
    print("="*50 + "\n")
    
    # Pulizia porte
    kill_process_on_port(8001)
    kill_process_on_port(3001)
    
    # Get the correct python executable from venv if available
    python_exe = os.path.join(os.getcwd(), ".venv", "bin", "python")
    if not os.path.exists(python_exe):
        python_exe = sys.executable

    # Start Backend
    print("📦 Avvio Backend (FastAPI) su http://localhost:8001...")
    try:
        backend_proc = subprocess.Popen(
            [python_exe, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"],
            cwd=os.getcwd()
        )
    except Exception as e:
        print(f"❌ Errore critico avvio Backend: {e}")
        return

    # Wait for backend
    print("⏳ Attendo che il backend sia pronto...")
    time.sleep(3)
    
    # Start Frontend
    print("🎨 Avvio Frontend (Next.js) su http://localhost:3001...")
    try:
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=os.path.join(os.getcwd(), "frontend")
        )
    except Exception as e:
        print(f"❌ Errore critico avvio Frontend: {e}")
        backend_proc.terminate()
        return
    
    print("\n✅ Applicazione avviata con successo!")
    print("👉 Accedi al Dashboard: http://localhost:3001")
    print("👉 Premi CTRL+C per fermare tutto.\n")
    
    try:
        while True:
            # Check if processes are still running
            if backend_proc.poll() is not None:
                print("❌ Il Backend si è interrotto inaspettatamente.")
                break
            if frontend_proc.poll() is not None:
                print("❌ Il Frontend si è interrotto inaspettatamente.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Arresto in corso...")
    finally:
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Done.")

if __name__ == "__main__":
    run_app()
