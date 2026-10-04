import http.server
import socketserver
import webbrowser
import socket
import sys
import os

# Support UTF-8 encoding in Windows console
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Force execution directory to the project directory
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

def find_available_port(start_port=8000):
    for port in range(start_port, start_port + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_DIR, **kwargs)

    def do_GET(self):
        # Rediriger la racine vers index.html
        if self.path == '/' or self.path == '':
            self.path = '/index.html'
        # Eviter le message d'erreur 404 pour favicon.ico dans le terminal
        elif self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        return super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def start_server():
    os.chdir(PROJECT_DIR)
    port = find_available_port(8000)
    url = f"http://localhost:{port}"
    ip_url = f"http://127.0.0.1:{port}"

    print("\n" + "=" * 72)
    print(" >>> SERVEUR WEB DE SIMULATION DEMARRE AVEC SUCCES ! <<<")
    print("=" * 72)
    print(f" [!] LIEN POUR ACCEDER AU SITE WEB :  {url}")
    print(f" [!] LIEN ALTERNATIF               :  {ip_url}")
    print("=" * 72)
    print(" [*] INSTRUCTIONS :")
    print("     1. Maintenez la touche Ctrl et CLIQUEZ sur le lien http://localhost:8000")
    print("     2. Ou ouvrez votre navigateur (Chrome/Edge/Firefox) et tapez : http://localhost:8000")
    print(" [i] Pour fermer le serveur web, appuyez sur Ctrl+C dans ce terminal.")
    print("=" * 72 + "\n")

    # Ouverture automatique dans le navigateur par defaut
    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        with socketserver.TCPServer(("127.0.0.1", port), CustomHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Serveur web arrete.")
        sys.exit(0)

if __name__ == "__main__":
    start_server()
