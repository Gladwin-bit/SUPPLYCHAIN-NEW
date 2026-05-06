#!/usr/bin/env python3
"""
Convert supply chain documentation to PDF - Windows compatible version
"""

import markdown
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
        page-break-before: always;
    }

    h1:first-child {
        page-break-before: avoid;
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
        page-break-inside: avoid;
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
        page-break-inside: avoid;
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
        page-break-inside: avoid;
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
        page-break-inside: avoid;
    }

    .flow-diagram {
        font-family: 'Courier New', monospace;
        background-color: #f1f3f4;
        padding: 1em;
        border-radius: 5px;
        margin: 1em 0;
        font-size: 9pt;
        white-space: pre;
        page-break-inside: avoid;
    }

    .anti-counterfeit {
        background-color: #ffeef0;
        border: 2px solid #e74c3c;
        border-radius: 8px;
        padding: 1em;
        margin: 1em 0;
        page-break-inside: avoid;
    }

    /* Print-specific styles */
    @media print {
        body { margin: 1.5cm; font-size: 10pt; }
        h1 { font-size: 20pt; }
        h2 { font-size: 16pt; }
        h3 { font-size: 13pt; }
        h4 { font-size: 11pt; }
    }

    /* Status indicators */
    .status-pass { color: #27ae60; font-weight: bold; }
    .status-fail { color: #e74c3c; font-weight: bold; }
    .status-warn { color: #f39c12; font-weight: bold; }

    /* Header styling */
    .header {
        text-align: center;
        border-bottom: 2px solid #2c5aa0;
        padding-bottom: 1em;
        margin-bottom: 2em;
    }

    .header h1 {
        color: #2c5aa0;
        margin: 0;
        border: none;
        page-break-before: avoid;
    }

    .header p {
        color: #666;
        font-style: italic;
        margin: 0.5em 0;
    }

    /* Table of contents */
    .toc {
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 5px;
        padding: 1em;
        margin: 1em 0 2em 0;
    }

    .toc h2 {
        margin-top: 0;
        color: #495057;
        border: none;
        font-size: 16pt;
    }

    .toc ul {
        list-style-type: none;
        padding-left: 0;
    }

    .toc li {
        margin: 0.3em 0;
        padding-left: 1em;
    }

    .toc a {
        text-decoration: none;
        color: #007bff;
    }

    .toc a:hover {
        text-decoration: underline;
    }
    </style>
    """

    # Add document header
    header_html = """
    <div class="header">
        <h1>Kasaragod Handloom Supply Chain System</h1>
        <h2>Test Cases, Flow Diagrams & Anti-Counterfeiting Documentation</h2>
        <p>Version 1.0 | Generated: March 14, 2026</p>
        <p>Blockchain-based Authenticity & Provenance Tracking Platform</p>
    </div>
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
        {header_html}
        {html_content}
    </body>
    </html>
    """

    return full_html

def create_pdf_via_weasyprint():
    """Alternative PDF generation using WeasyPrint"""
    try:
        import weasyprint

        html_content = create_html_with_styling()

        # Write HTML to file for debugging
        with open('Supply_Chain_Documentation.html', 'w', encoding='utf-8') as f:
            f.write(html_content)

        # Convert to PDF
        weasyprint.HTML(string=html_content).write_pdf('Supply_Chain_Documentation.pdf')

        print("SUCCESS: PDF generated using WeasyPrint")
        return True

    except ImportError:
        print("WeasyPrint not available, trying alternative method...")
        return False
    except Exception as e:
        print(f"WeasyPrint error: {str(e)}")
        return False

def create_html_only():
    """Fallback: Create HTML version if PDF generation fails"""
    try:
        html_content = create_html_with_styling()

        with open('Supply_Chain_Documentation.html', 'w', encoding='utf-8') as f:
            f.write(html_content)

        print("SUCCESS: HTML documentation generated")
        print("File: Supply_Chain_Documentation.html")
        print("You can open this in a browser and print to PDF manually")
        return True

    except Exception as e:
        print(f"HTML generation error: {str(e)}")
        return False

def main():
    """Main function"""
    print("Converting supply chain documentation...")

    # Check if markdown file exists
    if not os.path.exists('supply_chain_documentation.md'):
        print("ERROR: supply_chain_documentation.md not found")
        return False

    # Try WeasyPrint first
    if create_pdf_via_weasyprint():
        print("\nPDF GENERATED SUCCESSFULLY!")
        print("File: Supply_Chain_Documentation.pdf")
        print("\nDocument contains:")
        print("- Complete test cases for single & bulk registration")
        print("- Detailed flow diagrams")
        print("- Anti-counterfeiting architecture")
        print("- Security features and system capabilities")
        print("- Technical specifications and examples")
        return True

    # Fallback to HTML
    if create_html_only():
        print("\nHTML GENERATED (PDF conversion failed)")
        print("You can manually convert the HTML to PDF using:")
        print("1. Open Supply_Chain_Documentation.html in Chrome")
        print("2. Print -> Save as PDF")
        return True

    print("ERROR: Documentation generation failed")
    return False

if __name__ == "__main__":
    main()