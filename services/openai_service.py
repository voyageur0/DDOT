import openai
from typing import List, Dict, Any, Optional
import tiktoken
from config import Config
import numpy as np

class OpenAIService:
    """Service pour gérer les interactions avec l'API OpenAI"""
    
    def __init__(self):
        openai.api_key = Config.OPENAI_API_KEY
        self.embedding_model = Config.EMBEDDING_MODEL
        self.chat_model = getattr(Config, 'CHAT_MODEL', 'o3')  # utilise "o3" par défaut
        self.encoder = tiktoken.get_encoding("cl100k_base")
        
    def count_tokens(self, text: str) -> int:
        """Compter le nombre de tokens dans un texte"""
        return len(self.encoder.encode(text))
    
    def split_text_into_chunks(self, text: str, max_tokens: int = 2000, overlap: int = 200) -> List[str]:
        """Diviser le texte en chunks avec chevauchement"""
        sentences = text.split('. ')
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for sentence in sentences:
            sentence_tokens = self.count_tokens(sentence)
            
            if current_tokens + sentence_tokens > max_tokens and current_chunk:
                # Créer le chunk
                chunk_text = '. '.join(current_chunk) + '.'
                chunks.append(chunk_text)
                
                # Garder les dernières phrases pour le chevauchement
                overlap_sentences = []
                overlap_tokens = 0
                for s in reversed(current_chunk):
                    s_tokens = self.count_tokens(s)
                    if overlap_tokens + s_tokens <= overlap:
                        overlap_sentences.insert(0, s)
                        overlap_tokens += s_tokens
                    else:
                        break
                
                current_chunk = overlap_sentences
                current_tokens = overlap_tokens
            
            current_chunk.append(sentence)
            current_tokens += sentence_tokens
        
        # Ajouter le dernier chunk
        if current_chunk:
            chunk_text = '. '.join(current_chunk) + '.'
            chunks.append(chunk_text)
        
        return chunks
    
    def generate_embedding(self, text: str) -> List[float]:
        """Générer un embedding pour un texte"""
        try:
            response = openai.Embedding.create(
                model=self.embedding_model,
                input=text
            )
            return response['data'][0]['embedding']
        except Exception as e:
            print(f"Erreur lors de la génération d'embedding: {e}")
            return []
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Générer des embeddings pour plusieurs textes"""
        try:
            response = openai.Embedding.create(
                model=self.embedding_model,
                input=texts
            )
            return [item['embedding'] for item in response['data']]
        except Exception as e:
            print(f"Erreur lors de la génération d'embeddings batch: {e}")
            return []
    
    def generate_summary(self, text: str, max_tokens: int = 500) -> Dict[str, Any]:
        """Générer un résumé du texte"""
        try:
            # Si le texte est trop long, le diviser en chunks
            if self.count_tokens(text) > 3000:
                chunks = self.split_text_into_chunks(text, max_tokens=2000)
                summaries = []
                
                # Résumer chaque chunk
                for chunk in chunks[:10]:  # Limiter à 10 chunks pour éviter les coûts excessifs
                    chunk_summary = self._generate_chunk_summary(chunk)
                    if chunk_summary:
                        summaries.append(chunk_summary)
                
                # Combiner les résumés
                combined_text = "\n\n".join(summaries)
                final_summary = self._generate_final_summary(combined_text)
                
                return {
                    'summary': final_summary,
                    'chunks_processed': len(summaries),
                    'tokens_used': self.count_tokens(text)
                }
            else:
                # Texte court, résumer directement
                summary = self._generate_chunk_summary(text)
                return {
                    'summary': summary,
                    'chunks_processed': 1,
                    'tokens_used': self.count_tokens(text)
                }
                
        except Exception as e:
            print(f"Erreur lors de la génération du résumé: {e}")
            return {
                'summary': None,
                'error': str(e)
            }
    
    def _generate_chunk_summary(self, text: str) -> Optional[str]:
        """Générer un résumé pour un chunk de texte"""
        try:
            response = openai.ChatCompletion.create(
                model=self.chat_model,
                messages=[
                    {
                        "role": "system",
                        "content": "Tu es un assistant spécialisé en urbanisme qui produit des résumés clairs et concis des règlements d'urbanisme. Concentre-toi sur les éléments clés : zones, coefficients (IBUS, COS, CES), hauteurs maximales, distances aux limites, et autres contraintes importantes."
                    },
                    {
                        "role": "user",
                        "content": f"Résume les points clés de ce règlement d'urbanisme:\n\n{text}"
                    }
                ],
                max_tokens=500,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Erreur chunk summary: {e}")
            return None
    
    def _generate_final_summary(self, combined_summaries: str) -> str:
        """Générer un résumé final à partir des résumés de chunks"""
        try:
            response = openai.ChatCompletion.create(
                model=self.chat_model,
                messages=[
                    {
                        "role": "system",
                        "content": "Tu es un assistant spécialisé en urbanisme. Combine les résumés partiels suivants en une synthèse cohérente et structurée du règlement d'urbanisme."
                    },
                    {
                        "role": "user",
                        "content": f"Combine ces résumés en une synthèse unique et cohérente:\n\n{combined_summaries}"
                    }
                ],
                max_tokens=800,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Erreur final summary: {e}")
            return combined_summaries
    
    def generate_feasibility_table(self, rules_data: Dict[str, Any], project_data: Optional[Dict[str, Any]] = None) -> str:
        """Générer un tableau de faisabilité en Markdown"""
        try:
            # Préparer le contexte
            rules_text = self._format_rules_data(rules_data)
            
            if project_data:
                project_text = self._format_project_data(project_data)
                prompt = f"""En te basant sur les règles d'urbanisme suivantes:

{rules_text}

Et sur les caractéristiques du projet:

{project_text}

Génère un tableau de faisabilité en Markdown avec les colonnes suivantes:
| Critère | Exigence du règlement | Projet envisagé | Conforme ? |

Ne fournis QUE le tableau Markdown, sans texte additionnel."""
            else:
                prompt = f"""En te basant sur les règles d'urbanisme suivantes:

{rules_text}

Génère un tableau récapitulatif des contraintes en Markdown avec les colonnes suivantes:
| Critère | Valeur réglementaire | Remarques |

Ne fournis QUE le tableau Markdown, sans texte additionnel."""
            
            response = openai.ChatCompletion.create(
                model=self.chat_model,
                messages=[
                    {
                        "role": "system",
                        "content": "Tu es un assistant expert en urbanisme. Génère uniquement des tableaux Markdown structurés sans commentaire additionnel."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=800,
                temperature=0.2
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Erreur génération tableau: {e}")
            return "Erreur lors de la génération du tableau"
    
    def _format_rules_data(self, rules_data: Dict[str, Any]) -> str:
        """Formater les données de règles pour le prompt"""
        formatted = []
        
        if 'zones' in rules_data:
            formatted.append(f"Zones identifiées: {', '.join(rules_data['zones'])}")
        
        if 'coefficients' in rules_data:
            formatted.append("\nCoefficients généraux:")
            for key, value in rules_data['coefficients'].items():
                formatted.append(f"- {key.upper()}: {value}")
        
        if 'rules' in rules_data:
            for zone, zone_rules in rules_data['rules'].items():
                formatted.append(f"\nRègles pour Zone {zone}:")
                for key, value in zone_rules.items():
                    formatted.append(f"- {key.replace('_', ' ').title()}: {value}")
        
        return '\n'.join(formatted)
    
    def _format_project_data(self, project_data: Dict[str, Any]) -> str:
        """Formater les données du projet pour le prompt"""
        formatted = []
        
        mapping = {
            'zone': 'Zone du projet',
            'hauteur': 'Hauteur prévue',
            'ibus': 'IBUS prévu',
            'emprise': 'Emprise au sol',
            'distance_limite': 'Distance aux limites'
        }
        
        for key, label in mapping.items():
            if key in project_data:
                formatted.append(f"- {label}: {project_data[key]}")
        
        return '\n'.join(formatted)
    
    def answer_question(self, question: str, context: str, max_tokens: int = 500) -> str:
        """Répondre à une question basée sur le contexte fourni"""
        try:
            response = openai.ChatCompletion.create(
                model=self.chat_model,
                messages=[
                    {
                        "role": "system",
                        "content": "Tu es un assistant expert en urbanisme. Réponds aux questions en te basant uniquement sur le contexte fourni. Si l'information n'est pas dans le contexte, indique-le clairement."
                    },
                    {
                        "role": "user",
                        "content": f"Contexte:\n{context}\n\nQuestion: {question}"
                    }
                ],
                max_tokens=max_tokens,
                temperature=0.3
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Erreur answer question: {e}")
            return f"Erreur lors de la génération de la réponse: {str(e)}"
    
    def calculate_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Calculer la similarité cosinus entre deux embeddings"""
        # Convertir en numpy arrays
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        # Calculer la similarité cosinus
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2) 