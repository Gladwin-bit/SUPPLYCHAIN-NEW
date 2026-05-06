#!/usr/bin/env python3
"""
Convert supply chain documentation to PDF with proper formatting
"""

import markdown
import pdfkit
import sys
import os
from pathlib import Path

def create_html_with_styling():
    """Convert markdown to HTML with custom CSS styling"""

    # Read the markdown file
    with open('supply_chain_documentation.md', 'r', encoding='utf-8') as f:
        markdown_content = f.read()

    # Convert markdown to HTML
    html_content = markdown.markdown(markdown_content, extensions=['tables', 'fenced_code', 'toc'])

    # Custom CSS for professional PDF formatting
    css_styles = """
    <style>
    body {
        font-family: 'Segoe UI', Arial, sans-serif;
        line-height: 1.6;
        margin: 2cm;
        color: #333;
        font-size: 11pt;
    }

    h1 {
        color: #2c5aa0;
        border-bottom: 3px solid #2c5aa0;
        padding-bottom: 0.5em;
        font-size: 24pt;
        margin-top: 1.5em;
    }

    h2 {
        color: #34495e;
        border-bottom: 2px solid #e74c3c;
        padding-bottom: 0.3em;
        margin-top: 1.2em;
        font-size: 18pt;
    }

    h3 {
        color: #27ae60;
        margin-top: 1em;
        font-size: 14pt;
    }

    h4 {
        color: #8e44ad;
        font-size: 12pt;
    }

    code {
        background-color: #f4f4f4;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 9pt;
    }

    pre {
        background-color: #2c3e50;
        color: #ecf0f1;
        padding: 1em;
        border-radius: 5px;
        overflow-x: auto;
        font-family: 'Courier New', monospace;
        font-size: 9pt;
        margin: 1em 0;
    }

    blockquote {
        border-left: 4px solid #3498db;
        margin: 1em 0;
        padding-left: 1em;
        color: #555;
        font-style: italic;
    }

    table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
        font-size: 10pt;
    }

    table, th, td {
        border: 1px solid #ddd;
    }

    th {
        background-color: #34495e;
        color: white;
        padding: 8px;
        text-align: left;
    }

    td {
        padding: 8px;
    }

    .test-case {
        background-color: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 5px;
        padding: 1em;
        margin: 1em 0;
    }

    .pass-criteria {
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        border-radius: 5px;
        padding: 0.5em;
        margin: 0.5em 0;
    }

    .security-feature {
        background-color: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 5px;
        padding: 0.5em;
        margin: 0.5em 0;
    }

    .flow-diagram {
        font-family: 'Courier New', monospace;
        background-color: #f1f3f4;
        padding: 1em;
        border-radius: 5px;
        margin: 1em 0;
        font-size: 9pt;
        white-space: pre;
    }

    .anti-counterfeit {
        background-color: #ffeef0;
        border: 2px solid #e74c3c;
        border-radius: 8px;
        padding: 1em;
        margin: 1em 0;
    }

    /* Print-specific styles */
    @media print {
        body { margin: 1.5cm; }
        h1 { page-break-before: always; }
        h1:first-child { page-break-before: avoid; }
        .test-case, .security-feature, .anti-counterfeit {
            page-break-inside: avoid;
        }
        pre, code {
            page-break-inside: avoid;
        }
    }

    /* Status indicators */
    .status-pass { color: #27ae60; font-weight: bold; }
    .status-fail { color: #e74c3c; font-weight: bold; }
    .status-warn { color: #f39c12; font-weight: bold; }

    /* Emojis and symbols */
    .emoji { font-size: 120%; }
    </style>
    """

    # Wrap HTML with proper document structure
    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Kasaragod Handloom Supply Chain System - Documentation</title>
        {css_styles}
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """

    return full_html

def convert_to_pdf():
    """Convert HTML to PDF using wkhtmltopdf"""

    try:
        # Create styled HTML
        html_content = create_html_with_styling()

        # Write HTML to temporary file
        with open('temp_documentation.html', 'w', encoding='utf-8') as f:
            f.write(html_content)

        # PDF options for professional output
        options = {
            'page-size': 'A4',
            'margin-top': '2cm',
            'margin-right': '2cm',
            'margin-bottom': '2cm',
            'margin-left': '2cm',
            'encoding': "UTF-8",
            'enable-local-file-access': True,
            'print-media-type': True,
            'disable-smart-shrinking': True,
            'header-html': None,
            'footer-right': '[page] of [topage]',
            'footer-font-size': '8',
            'footer-spacing': '5',
        }

        # Convert to PDF
        output_file = 'Supply_Chain_Documentation.pdf'
        pdfkit.from_file('temp_documentation.html', output_file, options=options)

        # Clean up temporary file
        os.remove('temp_documentation.html')

        print(f"✅ PDF generated successfully: {output_file}")
        return True

    except FileNotFoundError as e:
        print("❌ Error: wkhtmltopdf not found. Please install it first.")
        print("   Windows: Download from https://wkhtmltopdf.org/downloads.html")
        print("   Linux: sudo apt-get install wkhtmltopdf")
        print("   macOS: brew install wkhtmltopdf")
        return False

    except Exception as e:
        print(f"❌ Error generating PDF: {str(e)}")
        return False

def main():
    """Main function"""
    print("🔄 Converting supply chain documentation to PDF...")

    # Check if markdown file exists
    if not os.path.exists('supply_chain_documentation.md'):
        print("❌ Error: supply_chain_documentation.md not found")
        return False

    # Convert to PDF
    success = convert_to_pdf()

    if success:
        print("📄 PDF contains:")
        print("   • Complete test cases for single & bulk registration")
        print("   • Detailed flow diagrams")
        print("   • Anti-counterfeiting architecture")
        print("   • Security features and system capabilities")
        print("   • Technical specifications and examples")

    return success

if __name__ == "__main__":
    main()