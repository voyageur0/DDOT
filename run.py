#!/usr/bin/env python
"""
Script de lancement de l'application Urban IA
"""

from app import app

if __name__ == '__main__':
    print("Démarrage de l'application Urban IA...")
    print("Accédez à l'application sur http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000) 