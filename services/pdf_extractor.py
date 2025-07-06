import pdfplumber
import fitz  # type: ignore  # PyMuPDF
import pandas as pd
import re
from typing import Dict, List, Any, Optional, Tuple, cast
import pytesseract
from PIL import Image
import io
import os

class PDFExtractor:
    """Service d'extraction de contenu PDF pour documents d'urbanisme"""
    
    def __init__(self):
        self.urban_keywords = [
            'IBUS', 'indice', 'hauteur', 'distance', 'limite', 'zone', 
            'construction', 'bâtiment', 'gabarit', 'coefficient', 'emprise',
            'recul', 'COS', 'CES', 'PLU', 'règlement'
        ]
        
    def extract_text_pdfplumber(self, pdf_path: str) -> str:
        """Extraire le texte brut d'un PDF avec PDFPlumber"""
        text = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            print(f"Erreur PDFPlumber: {e}")
        return text
    
    def extract_with_pymupdf(self, pdf_path: str) -> Dict[str, Any]:
        """Extraire texte et tableaux avec PyMuPDF"""
        result = {
            'text': '',
            'tables': [],
            'metadata': {}
        }
        
        try:
            doc = fitz.open(pdf_path)  # type: ignore[attr-defined]
            
            # Métadonnées
            result['metadata'] = {
                'pages': doc.page_count,
                'title': doc.metadata.get('title', ''),
                'author': doc.metadata.get('author', '')
            }
            
            # Extraction du texte et des tableaux
            for page_num, page in enumerate(doc):
                # Texte
                result['text'] += page.get_text() + "\n"
                
                # Tableaux
                tables = page.find_tables()
                for table in tables:
                    df = table.to_pandas()
                    result['tables'].append({
                        'page': page_num + 1,
                        'data': df.to_dict('records')
                    })
            
            doc.close()
            
        except Exception as e:
            print(f"Erreur PyMuPDF: {e}")
            
        return result
    
    def extract_urban_data(self, text: str) -> Dict[str, Any]:
        """Extraire les données d'urbanisme structurées du texte"""
        data = {
            'zones': [],
            'rules': {},
            'coefficients': {}
        }
        
        # Patterns regex pour extraire les valeurs
        patterns = {
            'ibus': r'IBUS[\s:]*(\d+[.,]\d+)',
            'hauteur': r'hauteur\s*(?:maximale|max)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m',
            'distance': r'distance\s*(?:minimale|min)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m',
            'emprise': r'emprise\s*au\s*sol\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%',
            'cos': r'COS[\s:]*(\d+[.,]\d+)',
            'ces': r'CES[\s:]*(\d+[.,]\d+)'
        }
        
        # Recherche des valeurs
        for key, pattern in patterns.items():
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                # Convertir en float
                values = [float(m.replace(',', '.')) for m in matches]
                data['coefficients'][key] = values[0] if len(values) == 1 else values
        
        # Extraction des zones
        zone_pattern = r'zone\s+([A-Z0-9]+)'
        zones = re.findall(zone_pattern, text, re.IGNORECASE)
        data['zones'] = list(set(zones))
        
        # Extraction des règles par zone si possible
        for zone in data['zones']:
            zone_section = self._extract_zone_section(text, zone)
            if zone_section:
                data['rules'][zone] = self._extract_zone_rules(zone_section)
        
        return data
    
    def _extract_zone_section(self, text: str, zone: str) -> Optional[str]:
        """Extraire la section de texte correspondant à une zone"""
        # Rechercher le début de la section de la zone
        zone_pattern = rf'zone\s+{zone}\b(.*?)(?=zone\s+[A-Z0-9]+|$)'
        match = re.search(zone_pattern, text, re.IGNORECASE | re.DOTALL)
        return match.group(1) if match else None
    
    def _extract_zone_rules(self, zone_text: str) -> Dict[str, Any]:
        """Extraire les règles spécifiques d'une zone"""
        rules = {}
        
        # Patterns spécifiques aux règles de zone
        patterns = {
            'hauteur_max': r'hauteur\s*(?:maximale|max)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m',
            'hauteur_facade': r'hauteur\s*(?:de\s*)?facade\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m',
            'distance_limite': r'distance\s*(?:aux?\s*)?limite[s]?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m',
            'ibus': r'IBUS[\s:]*(\d+[.,]\d+)',
            'emprise_sol': r'emprise\s*au\s*sol\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*%'
        }
        
        for key, pattern in patterns.items():
            match = re.search(pattern, zone_text, re.IGNORECASE)
            if match:
                value = match.group(1).replace(',', '.')
                rules[key] = float(value)
        
        return rules
    
    def extract_tables_data(self, tables: List[Dict]) -> List[pd.DataFrame]:
        """Convertir les tableaux extraits en DataFrames structurés"""
        structured_tables = []
        
        for table_info in tables:
            df = pd.DataFrame(table_info['data'])
            
            # Nettoyer les données
            df = cast(pd.DataFrame, df.apply(lambda x: x.str.strip() if x.dtype == "object" else x))
            
            # Identifier si c'est un tableau de règles d'urbanisme
            if self._is_urban_rules_table(df):
                df_struct = self._structure_urban_table(df)
                structured_tables.append(df_struct)
        
        return structured_tables
    
    def _is_urban_rules_table(self, df: pd.DataFrame) -> bool:
        """Vérifier si le tableau contient des règles d'urbanisme"""
        # Convertir en string pour la recherche
        table_text = df.to_string().lower()
        
        # Vérifier la présence de mots-clés
        keywords_found = sum(1 for kw in self.urban_keywords if kw.lower() in table_text)
        
        return keywords_found >= 2
    
    def _structure_urban_table(self, df: pd.DataFrame) -> pd.DataFrame:
        """Structurer un tableau de règles d'urbanisme"""
        # Essayer d'identifier les colonnes importantes
        # Cette méthode peut être adaptée selon le format des tableaux
        
        # Renommer les colonnes si nécessaire
        column_mapping = {
            'zone': 'Zone',
            'hauteur': 'Hauteur_Max',
            'ibus': 'IBUS',
            'distance': 'Distance_Limite'
        }
        
        for col in df.columns:
            col_lower = col.lower()
            for key, new_name in column_mapping.items():
                if key in col_lower:
                    df.rename(columns={col: new_name}, inplace=True)
        
        return df
    
    def ocr_scanned_pdf(self, pdf_path: str) -> Tuple[str, List[str]]:
        """OCR pour les PDF scannés.
        Retourne également une liste avec le texte de chaque page pour un post-traitement plus précis.
        """
        full_text = ""
        pages_text: List[str] = []

        try:
            doc = fitz.open(pdf_path)  # type: ignore[attr-defined]

            for page_num, page in enumerate(doc):
                # Conversion de la page en image haute résolution
                mat = fitz.Matrix(2, 2)  # Zoom x2 pour améliorer la qualité du rendu
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")

                # OCR avec Tesseract
                image = Image.open(io.BytesIO(img_data))
                # Par défaut on force la langue française, possibilité de la surcharger via env var
                lang = os.getenv("TESSERACT_LANG", "fra")
                page_text = pytesseract.image_to_string(image, lang=lang)

                pages_text.append(page_text)
                full_text += f"\n--- Page {page_num + 1} ---\n{page_text}"

            doc.close()

        except Exception as e:
            print(f"Erreur OCR: {e}")

        # On retourne toujours le texte complet pour compatibilité descendante
        return full_text, pages_text
    
    def extract_complete(self, pdf_path: str, use_ocr: bool = False) -> Dict[str, Any]:
        """Extraction complète d'un PDF"""
        result = {
            'raw_text': '',
            'structured_data': {},
            'tables': [],
            'metadata': {}
        }
        
        # Extraction avec PyMuPDF
        pymupdf_result = self.extract_with_pymupdf(pdf_path)
        result['raw_text'] = pymupdf_result['text']
        result['tables'] = pymupdf_result['tables']
        result['metadata'] = pymupdf_result['metadata']
        
        # Si le texte est vide ou trop court, essayer l'OCR
        if (not result['raw_text'].strip() or len(result['raw_text']) < 100) and use_ocr:
            print("Texte insuffisant, utilisation de l'OCR...")
            ocr_full, ocr_pages = self.ocr_scanned_pdf(pdf_path)
            result['raw_text'] = ocr_full
            result['pages_text'] = ocr_pages
        
        # Extraction des données structurées
        if result['raw_text']:
            result['structured_data'] = self.extract_urban_data(result['raw_text'])
        
        # Structurer les tableaux
        if result['tables']:
            result['structured_tables'] = self.extract_tables_data(result['tables'])  # type: ignore[arg-type]
        
        return result 