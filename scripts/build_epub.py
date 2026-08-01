import os
import zipfile
import re
from datetime import datetime

MANUSCRIPT_DIR = "manuscript"
OUTPUT_DIR = "../dist/epub"
OUTPUT_EPUB = os.path.join(OUTPUT_DIR, "logichub-v1.epub")
SOURCE_EPUB = "/Users/dharamdaxini/Downloads/via/daxini-stack-ultimate-bulletproof.epub"

def get_stylesheet():
    try:
        with zipfile.ZipFile(SOURCE_EPUB, 'r') as z:
            for name in z.namelist():
                if name.endswith('.css'):
                    return z.read(name).decode('utf-8')
    except Exception as e:
        print(f"Warning: Could not read source CSS: {e}")
    # Fallback KDP-optimized CSS
    return """
body { font-family: Georgia, serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; }
pre { white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; max-width:100%; box-sizing:border-box; padding:.8em; border:1px solid #ddd; border-radius:4px; background:#f6f6f6; font-family:Menlo,Consolas,monospace; font-size:.9em; break-inside:avoid; }
code { white-space:pre-wrap; overflow-wrap:anywhere; font-family:Menlo,Consolas,monospace; }
h1, h2, h3 { font-weight: bold; page-break-after: avoid; }
h1 { font-size: 1.8em; margin: 1.5em 0 0.6em 0; page-break-before: always; }
h2 { font-size: 1.4em; margin: 1.2em 0 0.5em 0; }
blockquote { margin: 0.8em 0; padding: 0.4em 0 0.4em 1em; border-left: 3px solid #999; font-style: italic; }
    """

def md_to_xhtml(md_content, title):
    """Convert raw markdown to EPUB 3.0 compliant XHTML with pandoc-style sections."""
    html = md_content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    
    # 1. Handle Code Blocks precisely
    def code_block_replacer(match):
        code = match.group(1).strip()
        return f'<pre><code>{code}</code></pre>'
    html = re.sub(r'```[a-zA-Z]*\n(.*?)```', code_block_replacer, html, flags=re.DOTALL)
    
    # 2. Inline Code
    html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)
    
    # 3. Bold & Italic
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)
    
    # 4. Extract headers to build sections
    lines = html.split('\n')
    wrapped_lines = []
    in_pre = False
    
    safe_id = re.sub(r'[^a-z0-9-]', '', title.lower().replace(' ', '-'))
    wrapped_lines.append(f'<section id="{safe_id}" class="level1">')
    
    for line in lines:
        if '<pre>' in line: in_pre = True
        if '</pre>' in line: in_pre = False
        
        stripped = line.strip()
        
        if stripped == '':
            continue
            
        if in_pre:
            wrapped_lines.append(line)
        elif stripped.startswith('### '):
            h3_text = stripped[4:]
            wrapped_lines.append(f'<h3>{h3_text}</h3>')
        elif stripped.startswith('## '):
            h2_text = stripped[3:]
            h2_id = re.sub(r'[^a-z0-9-]', '', h2_text.lower().replace(' ', '-'))
            wrapped_lines.append(f'<h2 id="{h2_id}">{h2_text}</h2>')
        elif stripped.startswith('# '):
            h1_text = stripped[2:]
            wrapped_lines.append(f'<h1>{h1_text}</h1>')
        elif stripped.startswith('* ') or stripped.startswith('- '):
            wrapped_lines.append(f'<ul><li>{stripped[2:]}</li></ul>')
        elif stripped.startswith('> '):
            wrapped_lines.append(f'<blockquote>{stripped[2:]}</blockquote>')
        else:
            wrapped_lines.append(f'<p>{line}</p>')

    wrapped_lines.append('</section>')
    
    # Clean up adjacent list tags
    body = '\\n'.join(wrapped_lines)
    body = body.replace('</ul>\\n<ul>', '\\n')

    xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en-US" xml:lang="en-US">
<head>
  <meta charset="utf-8" />
  <title>{title}</title>
  <link rel="stylesheet" type="text/css" href="../styles/stylesheet1.css" />
</head>
<body epub:type="bodymatter">
{body}
</body>
</html>"""
    return xhtml

def generate_title_page():
    return """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en-US" xml:lang="en-US">
<head>
  <meta charset="utf-8" />
  <title>Title Page</title>
  <link rel="stylesheet" type="text/css" href="../styles/stylesheet1.css" />
</head>
<body epub:type="frontmatter">
  <section class="level1" style="text-align: center; margin-top: 20%;">
    <h1 class="title">The Daxini Stack</h1>
    <p class="subtitle">Engineering LogicHub: Deterministic Hardware Virtualization</p>
    <p class="author">Daxini Labs</p>
  </section>
</body>
</html>"""

def build_epub():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    print(f"Building {OUTPUT_EPUB} (EPUB 3.0 Standard)...")
    
    if not os.path.exists(MANUSCRIPT_DIR):
        print(f"Error: {MANUSCRIPT_DIR} not found.")
        return
        
    chapters = sorted([f for f in os.listdir(MANUSCRIPT_DIR) if f.endswith('.md')])
    timestamp = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    
    with zipfile.ZipFile(OUTPUT_EPUB, 'w', zipfile.ZIP_DEFLATED) as epub:
        # 1. mimetype (Uncompressed)
        epub.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        
        # 2. META-INF
        container = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"""
        epub.writestr('META-INF/container.xml', container)
        
        # 3. CSS
        css = get_stylesheet()
        epub.writestr('EPUB/styles/stylesheet1.css', css)
        
        # 4. Title Page
        epub.writestr('EPUB/text/title_page.xhtml', generate_title_page())
        
        manifest_items = []
        spine_items = []
        nav_points = []
        nav_li_items = []
        
        manifest_items.append('<item id="title_page_xhtml" href="text/title_page.xhtml" media-type="application/xhtml+xml" />')
        spine_items.append('<itemref idref="title_page_xhtml" />')
        
        # 5. Process Chapters
        for idx, filename in enumerate(chapters):
            ch_num = idx + 1
            ch_id = f"ch{ch_num:03d}_xhtml"
            file_path = os.path.join(MANUSCRIPT_DIR, filename)
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract title
            title = filename.replace('.md', '').replace('_', ' ').title()
            title_match = re.search(r'^# (.*?)$', content, re.MULTILINE)
            if title_match:
                title = title_match.group(1)
                
            xhtml = md_to_xhtml(content, title)
            epub.writestr(f"EPUB/text/ch{ch_num:03d}.xhtml", xhtml)
            
            manifest_items.append(f'<item id="{ch_id}" href="text/ch{ch_num:03d}.xhtml" media-type="application/xhtml+xml" />')
            spine_items.append(f'<itemref idref="{ch_id}" />')
            
            nav_points.append(f"""    <navPoint id="navPoint-{ch_num}" playOrder="{ch_num}">
      <navLabel><text>{title}</text></navLabel>
      <content src="text/ch{ch_num:03d}.xhtml" />
    </navPoint>""")
            
            nav_li_items.append(f'        <li><a href="text/ch{ch_num:03d}.xhtml">{title}</a></li>')

        # 6. EPUB 3 Navigation Document (nav.xhtml)
        nav_xhtml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en-US" xml:lang="en-US">
<head>
  <meta charset="utf-8" />
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="../styles/stylesheet1.css" />
</head>
<body epub:type="frontmatter">
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ul>
{chr(10).join(nav_li_items)}
    </ul>
  </nav>
</body>
</html>"""
        epub.writestr('EPUB/nav.xhtml', nav_xhtml)
        
        # 7. EPUB 2 Fallback Navigation (toc.ncx)
        ncx = f"""<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:logichub-epub-v1"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>The Daxini Stack: Engineering LogicHub</text></docTitle>
  <navMap>
{chr(10).join(nav_points)}
  </navMap>
</ncx>"""
        epub.writestr('EPUB/toc.ncx', ncx)

        # 8. EPUB 3.0 content.opf
        opf = f"""<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="epub-id-1">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="epub-id-1">urn:uuid:logichub-epub-v1</dc:identifier>
    <dc:title>The Daxini Stack: Engineering LogicHub</dc:title>
    <dc:creator>Daxini Labs</dc:creator>
    <dc:language>en-US</dc:language>
    <meta property="dcterms:modified">{timestamp}</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="stylesheet1" href="styles/stylesheet1.css" media-type="text/css" />
    {chr(10).join(manifest_items)}
  </manifest>
  <spine toc="ncx">
    {chr(10).join(spine_items)}
  </spine>
</package>"""
        epub.writestr('EPUB/content.opf', opf)

    print(f"Successfully built {OUTPUT_EPUB} with EPUB 3.0 formatting.")

if __name__ == "__main__":
    build_epub()
