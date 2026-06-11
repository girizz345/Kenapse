import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet

def generate_pdf(title: str, explanation: str, example: str, key_points: list, output_filename: str):
    doc = SimpleDocTemplate(output_filename, pagesize=letter)
    styles = getSampleStyleSheet()
    Story = []

    # Title
    Story.append(Paragraph(title, styles['Title']))
    Story.append(Spacer(1, 12))

    # Explanation
    Story.append(Paragraph("Explanation:", styles['Heading2']))
    Story.append(Paragraph(explanation, styles['Normal']))
    Story.append(Spacer(1, 12))

    # Example
    Story.append(Paragraph("Example:", styles['Heading2']))
    Story.append(Paragraph(example, styles['Normal']))
    Story.append(Spacer(1, 12))

    # Key Points
    Story.append(Paragraph("Key Points:", styles['Heading2']))
    list_items = [ListItem(Paragraph(point, styles['Normal'])) for point in key_points]
    Story.append(ListFlowable(list_items, bulletType='bullet'))
    
    doc.build(Story)
    return output_filename
