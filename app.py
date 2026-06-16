from flask import Flask, render_template, jsonify, request
import urllib.request
import ssl
import xml.etree.ElementTree as ET
import re
import hashlib
import time

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for parsed notes
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION = 900 # 15 minutes

def generate_id(date_str, item_type, content_html):
    """Generates a stable unique ID for a release note item."""
    raw_str = f"{date_str}|{item_type}|{content_html}"
    return hashlib.md5(raw_str.encode('utf-8')).hexdigest()

def fetch_and_parse_feed():
    """Fetches the RSS feed and parses it into flattened release note items."""
    try:
        # Disable SSL verification to prevent issues with local setups
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(FEED_URL, context=context, timeout=10) as response:
            xml_data = response.read()
            
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(xml_data)
        
        flattened_items = []
        
        for entry in root.findall('atom:entry', namespaces):
            date_str = entry.find('atom:title', namespaces).text # E.g., June 15, 2026
            updated_str = entry.find('atom:updated', namespaces).text # E.g., 2026-06-15T00:00:00-07:00
            
            link_elem = entry.find('atom:link', namespaces)
            # Find link with rel='alternate' or just take the first link
            link = ""
            if link_elem is not None:
                link = link_elem.attrib.get('href', '')
                
            content_elem = entry.find('atom:content', namespaces)
            content_html = content_elem.text if content_elem is not None else ""
            
            # Google release notes content is structured as:
            # <h3>Type of update</h3> <p>Details...</p>
            # We split by <h3> tags using regex
            parts = re.split(r'<h3>(.*?)</h3>', content_html)
            
            if len(parts) > 1:
                # parts[0] is the content before the first h3 (usually empty)
                # Then parts[1] is the type, parts[2] is the content, parts[3] is the type, etc.
                for i in range(1, len(parts), 2):
                    item_type = parts[i].strip()
                    item_content = parts[i+1].strip() if i+1 < len(parts) else ""
                    
                    unique_id = generate_id(date_str, item_type, item_content)
                    
                    flattened_items.append({
                        "id": unique_id,
                        "date": date_str,
                        "updated": updated_str,
                        "link": f"{link}#{date_str.replace(' ', '_')}" if link else "",
                        "type": item_type,
                        "content": item_content
                    })
            else:
                # If there are no <h3> tags, treat the whole content as one item
                unique_id = generate_id(date_str, "Update", content_html)
                flattened_items.append({
                    "id": unique_id,
                    "date": date_str,
                    "updated": updated_str,
                    "link": link,
                    "type": "Update",
                    "content": content_html.strip()
                })
                
        return flattened_items, None
    except Exception as e:
        return None, str(e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Check if cache is valid
    if cache["data"] is not None and not force_refresh and (current_time - cache["last_fetched"] < CACHE_DURATION):
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_fetched": cache["last_fetched"],
            "data": cache["data"]
        })
        
    # Fetch new data
    data, error = fetch_and_parse_feed()
    if error:
        # If fetch fails but we have cached data, return the cached data with a warning
        if cache["data"] is not None:
            return jsonify({
                "status": "warning",
                "message": f"Failed to fetch fresh data: {error}. Serving cached data.",
                "source": "cache",
                "last_fetched": cache["last_fetched"],
                "data": cache["data"]
            })
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch release notes: {error}"
        }), 500
        
    # Update cache
    cache["data"] = data
    cache["last_fetched"] = current_time
    
    return jsonify({
        "status": "success",
        "source": "network",
        "last_fetched": cache["last_fetched"],
        "data": data
    })

@app.route('/api/refresh', methods=['POST'])
def refresh_notes():
    data, error = fetch_and_parse_feed()
    if error:
        return jsonify({
            "status": "error",
            "message": f"Failed to refresh release notes: {error}"
        }), 500
        
    cache["data"] = data
    cache["last_fetched"] = time.time()
    
    return jsonify({
        "status": "success",
        "source": "network",
        "last_fetched": cache["last_fetched"],
        "data": data
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
