import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.local')
load_dotenv('.env')
load_dotenv()

class Config:
    # Configuration Flask
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    FLASK_ENV = os.environ.get('FLASK_ENV') or 'development'
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    # Configuration OpenAI
    # IMPORTANT: Utiliser temporairement la clé fournie - À REMPLACER EN PRODUCTION
    OPENAI_API_KEY = "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"
    
    # Configuration Base de données
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///urban_analysis.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Configuration Stripe
    STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY') or 'sk_test_your_stripe_secret_key'
    STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY') or 'pk_test_your_stripe_publishable_key'
    STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET') or 'whsec_your_stripe_webhook_secret'
    
    # Configuration CORS
    CORS_ORIGIN = os.environ.get('CORS_ORIGIN') or 'http://localhost:3000'
    
    # Configuration de l'upload
    UPLOAD_FOLDER = 'uploads'
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}
    
    # Configuration des embeddings
    EMBEDDING_MODEL = "text-embedding-ada-002"
    MAX_TOKENS_PER_CHUNK = 2000
    CHUNK_OVERLAP = 200 