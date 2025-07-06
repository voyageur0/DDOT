from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import bcrypt

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """Modèle utilisateur avec gestion des abonnements"""
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Abonnement Stripe
    stripe_customer_id = db.Column(db.String(100))
    stripe_subscription_id = db.Column(db.String(100))
    is_premium = db.Column(db.Boolean, default=False)
    subscription_end_date = db.Column(db.DateTime)
    
    # Relations
    documents = db.relationship('Document', backref='owner', lazy=True)
    analyses = db.relationship('Analysis', backref='user', lazy=True)
    
    def set_password(self, password):
        """Hasher le mot de passe"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Vérifier le mot de passe"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def __repr__(self):
        return f'<User {self.email}>'

class Document(db.Model):
    """Modèle pour stocker les documents PDF analysés"""
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255))
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Métadonnées du document
    commune = db.Column(db.String(100))
    document_type = db.Column(db.String(50))  # 'reglement', 'cadastre', etc.
    
    # Contenu extrait
    raw_text = db.Column(db.Text)
    extracted_data = db.Column(db.JSON)  # Données structurées extraites
    
    # Relations
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    embeddings = db.relationship('DocumentEmbedding', backref='document', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Document {self.filename}>'

class DocumentEmbedding(db.Model):
    """Modèle pour stocker les embeddings des chunks de documents"""
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('document.id'), nullable=False)
    chunk_index = db.Column(db.Integer, nullable=False)
    chunk_text = db.Column(db.Text, nullable=False)
    embedding = db.Column(db.PickleType)  # Vecteur d'embedding
    metadata = db.Column(db.JSON)  # Métadonnées additionnelles
    
    def __repr__(self):
        return f'<DocumentEmbedding doc={self.document_id} chunk={self.chunk_index}>'

class Analysis(db.Model):
    """Modèle pour stocker les analyses générées par l'IA"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    document_id = db.Column(db.Integer, db.ForeignKey('document.id'), nullable=False)
    
    # Type d'analyse
    analysis_type = db.Column(db.String(50))  # 'summary', 'feasibility_table', 'custom_query'
    
    # Données de l'analyse
    input_data = db.Column(db.JSON)  # Paramètres d'entrée
    result = db.Column(db.Text)  # Résultat de l'analyse
    
    # Métadonnées
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    tokens_used = db.Column(db.Integer)
    cost_usd = db.Column(db.Float)
    
    # Relation
    document = db.relationship('Document', backref='analyses')
    
    def __repr__(self):
        return f'<Analysis {self.analysis_type} for doc={self.document_id}>' 