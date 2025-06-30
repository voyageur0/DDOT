"""
Module de génération PDF pour les rapports d'analyse Urban-AI Valais
Génère des rapports PDF professionnels avec mise en page avancée
"""

import os
from datetime import datetime
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.platypus import Image, KeepTogether, PageTemplate, Frame, NextPageTemplate
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
from pathlib import Path

class PDFGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = output_dir
        Path(output_dir).mkdir(exist_ok=True)
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Configure les styles personnalisés pour le rapport."""
        # Style pour le titre principal
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=HexColor('#2c3e50'),
            fontName='Helvetica-Bold'
        ))
        
        # Style pour les sous-titres
        self.styles.add(ParagraphStyle(
            name='CustomHeading2',
            parent=self.styles['Heading2'],
            fontSize=16,
            spaceAfter=12,
            spaceBefore=20,
            textColor=HexColor('#34495e'),
            fontName='Helvetica-Bold'
        ))
        
        # Style pour les informations importantes
        self.styles.add(ParagraphStyle(
            name='InfoBox',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            leftIndent=20,
            textColor=HexColor('#2c3e50'),
            fontName='Helvetica'
        ))
        
        # Style pour les tableaux
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            textColor=white,
            fontName='Helvetica-Bold'
        ))
    
    def create_header_footer(self, canvas, doc):
        """Crée l'en-tête et pied de page du document."""
        # En-tête
        canvas.saveState()
        canvas.setFont('Helvetica-Bold', 12)
        canvas.setFillColor(HexColor('#2c3e50'))
        canvas.drawString(2*cm, A4[1]-2*cm, "Urban-AI Valais")
        
        # Ligne de séparation
        canvas.setStrokeColor(HexColor('#667eea'))
        canvas.setLineWidth(1)
        canvas.line(2*cm, A4[1]-2.5*cm, A4[0]-2*cm, A4[1]-2.5*cm)
        
        # Pied de page
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(HexColor('#7f8c8d'))
        canvas.drawString(2*cm, 1*cm, f"Généré le {datetime.now().strftime('%d.%m.%Y à %H:%M')}")
        canvas.drawRightString(A4[0]-2*cm, 1*cm, f"Page {doc.page}")
        canvas.drawCentredString(A4[0]/2, 1*cm, "DDOT - Système d'analyse urbaine pour le Valais")
        
        canvas.restoreState()
    
    def generate_report(self, analysis_data: Dict[str, Any], filename: Optional[str] = None) -> str:
        """
        Génère un rapport PDF complet.
        
        Args:
            analysis_data: Données de l'analyse (commune, parcelle, rdppf, rules, report)
            filename: Nom du fichier (optionnel)
        
        Returns:
            Chemin vers le fichier PDF généré
        """
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"rapport_{analysis_data['commune']}_{analysis_data['parcelle']}_{timestamp}.pdf"
        
        filepath = os.path.join(self.output_dir, filename)
        
        # Créer le document
        doc = SimpleDocTemplate(
            filepath,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=3*cm,
            bottomMargin=2*cm
        )
        
        # Configuration de l'en-tête et pied de page
        frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
        template = PageTemplate(id='CustomTemplate', frames=frame, onPage=self.create_header_footer)
        doc.addPageTemplates([template])
        
        # Contenu du rapport
        story = []
        
        # Page de titre
        story.extend(self._create_title_page(analysis_data))
        story.append(PageBreak())
        
        # Table des matières (simplifiée)
        story.extend(self._create_table_of_contents())
        story.append(PageBreak())
        
        # Synthèse rapide
        story.extend(self._create_summary_section(analysis_data))
        story.append(PageBreak())
        
        # Détails de l'analyse
        story.extend(self._create_analysis_details(analysis_data))
        story.append(PageBreak())
        
        # Données RDPPF
        story.extend(self._create_rdppf_section(analysis_data))
        story.append(PageBreak())
        
        # Règlement communal
        story.extend(self._create_regulation_section(analysis_data))
        story.append(PageBreak())
        
        # Informations importantes
        story.extend(self._create_important_info_section())
        
        # Générer le PDF
        doc.build(story)
        
        return filepath
    
    def _create_title_page(self, analysis_data: Dict[str, Any]) -> list:
        """Crée la page de titre."""
        story = []
        
        # Titre principal
        story.append(Paragraph("RAPPORT D'ANALYSE URBAINE", self.styles['CustomTitle']))
        story.append(Spacer(1, 2*cm))
        
        # Informations de la parcelle
        story.append(Paragraph(f"Commune : {analysis_data['commune'].upper()}", self.styles['CustomHeading2']))
        story.append(Paragraph(f"Parcelle : {analysis_data['parcelle']}", self.styles['CustomHeading2']))
        story.append(Spacer(1, 1*cm))
        
        # Date de génération
        story.append(Paragraph(f"Date d'analyse : {datetime.now().strftime('%d.%m.%Y à %H:%M')}", self.styles['InfoBox']))
        story.append(Spacer(1, 3*cm))
        
        # Logo ou information système
        story.append(Paragraph("Urban-AI Valais", self.styles['CustomHeading2']))
        story.append(Paragraph("Système d'analyse urbaine intelligent", self.styles['InfoBox']))
        story.append(Paragraph("Données RDPPF • Règlements communaux • IA", self.styles['InfoBox']))
        
        return story
    
    def _create_table_of_contents(self) -> list:
        """Crée la table des matières."""
        story = []
        
        story.append(Paragraph("TABLE DES MATIÈRES", self.styles['CustomHeading2']))
        story.append(Spacer(1, 1*cm))
        
        contents = [
            "1. Synthèse rapide",
            "2. Détails de l'analyse",
            "3. Données RDPPF",
            "4. Règlement communal",
            "5. Informations importantes"
        ]
        
        for content in contents:
            story.append(Paragraph(f"• {content}", self.styles['InfoBox']))
        
        return story
    
    def _create_summary_section(self, analysis_data: Dict[str, Any]) -> list:
        """Crée la section de synthèse rapide."""
        story = []
        
        story.append(Paragraph("1. SYNTHÈSE RAPIDE", self.styles['CustomHeading2']))
        story.append(Spacer(1, 0.5*cm))
        
        # Extraire la zone depuis les données RDPPF
        zone = "Zone non déterminée"
        if analysis_data.get('rdppf'):
            try:
                restrictions = analysis_data['rdppf'].get('Extract', {}).get('RealEstate', {}).get('RestrictionOnLandownership', [])
                for restriction in restrictions:
                    legend_texts = restriction.get('LegendText', [])
                    for legend in legend_texts:
                        if legend.get('Language') == 'fr':
                            text = legend.get('Text', '')
                            if 'zone' in text.lower():
                                zone = text
                                break
            except:
                pass
        
        # Tableau de synthèse
        summary_data = [
            ['Élément', 'Valeur'],
            ['Commune', analysis_data['commune']],
            ['Parcelle', analysis_data['parcelle']],
            ['Zone d\'affectation', zone],
            ['Date d\'analyse', datetime.now().strftime('%d.%m.%Y')],
            ['Source des données', 'RDPPF officiel + Règlement communal']
        ]
        
        summary_table = Table(summary_data, colWidths=[4*cm, 8*cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor('#667eea')),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), HexColor('#f8f9fa')),
            ('GRID', (0, 0), (-1, -1), 1, black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 1*cm))
        
        return story
    
    def _create_analysis_details(self, analysis_data: Dict[str, Any]) -> list:
        """Crée la section des détails d'analyse."""
        story = []
        
        story.append(Paragraph("2. DÉTAILS DE L'ANALYSE", self.styles['CustomHeading2']))
        story.append(Spacer(1, 0.5*cm))
        
        # Afficher le rapport généré par l'IA
        if analysis_data.get('report'):
            # Diviser le rapport en sections
            report_lines = analysis_data['report'].split('\n')
            current_section = []
            
            for line in report_lines:
                if line.strip().startswith('📋') or line.strip().startswith('🎯'):
                    # Nouvelle section, traiter la précédente
                    if current_section:
                        story.extend(self._format_report_section(current_section))
                        current_section = []
                current_section.append(line)
            
            # Traiter la dernière section
            if current_section:
                story.extend(self._format_report_section(current_section))
        else:
            story.append(Paragraph("Aucun rapport détaillé disponible.", self.styles['InfoBox']))
        
        return story
    
    def _format_report_section(self, lines: list) -> list:
        """Formate une section du rapport."""
        story = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.startswith('📋') or line.startswith('🎯') or line.startswith('📋') or line.startswith('📊'):
                # Titre de section
                clean_title = line.replace('📋', '').replace('🎯', '').replace('📊', '').strip()
                story.append(Paragraph(clean_title, self.styles['CustomHeading2']))
            elif line.startswith('•'):
                # Point de liste
                story.append(Paragraph(line, self.styles['InfoBox']))
            elif line.startswith('|'):
                # Tableau (simplifié)
                story.append(Paragraph(line, self.styles['InfoBox']))
            else:
                # Texte normal
                story.append(Paragraph(line, self.styles['InfoBox']))
            
            story.append(Spacer(1, 0.2*cm))
        
        return story
    
    def _create_rdppf_section(self, analysis_data: Dict[str, Any]) -> list:
        """Crée la section des données RDPPF."""
        story = []
        
        story.append(Paragraph("3. DONNÉES RDPPF", self.styles['CustomHeading2']))
        story.append(Spacer(1, 0.5*cm))
        
        if analysis_data.get('rdppf'):
            rdppf = analysis_data['rdppf']
            
            # Thèmes concernés
            themes = []
            try:
                concerned_themes = rdppf.get('Extract', {}).get('ConcernedTheme', [])
                for theme in concerned_themes:
                    for text in theme.get('Text', []):
                        if text.get('Language') == 'fr':
                            themes.append(text.get('Text', ''))
            except:
                themes = ["Thèmes non disponibles"]
            
            story.append(Paragraph("Thèmes RDPPF concernés :", self.styles['CustomHeading2']))
            for theme in themes[:5]:  # Limiter à 5 thèmes
                story.append(Paragraph(f"• {theme}", self.styles['InfoBox']))
            
            story.append(Spacer(1, 0.5*cm))
            
            # Restrictions foncières
            story.append(Paragraph("Restrictions foncières :", self.styles['CustomHeading2']))
            try:
                restrictions = rdppf.get('Extract', {}).get('RealEstate', {}).get('RestrictionOnLandownership', [])
                for i, restriction in enumerate(restrictions[:3], 1):  # Limiter à 3 restrictions
                    part = restriction.get('PartInPercent', 'N/A')
                    legend_texts = restriction.get('LegendText', [])
                    for legend in legend_texts:
                        if legend.get('Language') == 'fr':
                            text = legend.get('Text', '')
                            story.append(Paragraph(f"{i}. {text} ({part}%)", self.styles['InfoBox']))
                            break
            except:
                story.append(Paragraph("Restrictions non disponibles", self.styles['InfoBox']))
        else:
            story.append(Paragraph("Aucune donnée RDPPF disponible.", self.styles['InfoBox']))
        
        return story
    
    def _create_regulation_section(self, analysis_data: Dict[str, Any]) -> list:
        """Crée la section du règlement communal."""
        story = []
        
        story.append(Paragraph("4. RÈGLEMENT COMMUNAL", self.styles['CustomHeading2']))
        story.append(Spacer(1, 0.5*cm))
        
        if analysis_data.get('rules'):
            rules = analysis_data['rules']
            
            # Zone d'affectation
            if rules.get('zone'):
                story.append(Paragraph(f"Zone d'affectation : {rules['zone']}", self.styles['CustomHeading2']))
                story.append(Spacer(1, 0.3*cm))
            
            # Règles extraites
            if rules.get('rules'):
                story.append(Paragraph("Règles principales :", self.styles['CustomHeading2']))
                for query, passages in rules['rules'].items():
                    if passages:
                        clean_query = query.replace(' en ', ' : ').title()
                        story.append(Paragraph(f"• {clean_query}", self.styles['InfoBox']))
                        # Afficher le premier passage
                        if passages[0]:
                            story.append(Paragraph(f"  {passages[0][:200]}...", self.styles['InfoBox']))
                        story.append(Spacer(1, 0.2*cm))
        else:
            story.append(Paragraph("Aucune règle communale extraite.", self.styles['InfoBox']))
        
        return story
    
    def _create_important_info_section(self) -> list:
        """Crée la section des informations importantes."""
        story = []
        
        story.append(Paragraph("5. INFORMATIONS IMPORTANTES", self.styles['CustomHeading2']))
        story.append(Spacer(1, 0.5*cm))
        
        important_info = [
            "• Ce rapport est généré automatiquement et doit être vérifié",
            "• Les données RDPPF proviennent du service officiel valaisan",
            "• Le règlement communal peut avoir été mis à jour",
            "• Consultez toujours les services communaux pour confirmation",
            "• Ce rapport ne remplace pas une expertise professionnelle"
        ]
        
        for info in important_info:
            story.append(Paragraph(info, self.styles['InfoBox']))
        
        story.append(Spacer(1, 1*cm))
        
        # Signature
        story.append(Paragraph("Généré par Urban-AI Valais", self.styles['CustomHeading2']))
        story.append(Paragraph("Système d'analyse urbaine intelligent", self.styles['InfoBox']))
        
        return story

# Instance globale du générateur PDF
pdf_generator = PDFGenerator() 