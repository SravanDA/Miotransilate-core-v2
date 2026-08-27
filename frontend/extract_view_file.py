import json
import re

target_files = [
    "/Users/srvns/Desktop/miotransilate/frontend/src/pages/PageDetail.tsx",
    "/Users/srvns/Desktop/miotransilate/frontend/src/pages/TagDetail.tsx",
    "/Users/srvns/Desktop/miotransilate/frontend/src/pages/CoverageDashboard.tsx",
    "/Users/srvns/Desktop/miotransilate/frontend/src/pages/MyWork.tsx",
    "/Users/srvns/Desktop/miotransilate/frontend/src/pages/Deployments.tsx",
    "/Users/srvns/Desktop/miotransilate/frontend/src/pages/Settings.tsx",
    "/Users/srvns/Desktop/miotransilate/frontend/src/pages/PageList.tsx",
    "/Users/srvns/Desktop/miotransilate/frontend/src/miosalon.css",
    "/Users/srvns/Desktop/miotransilate/frontend/tests/logical.spec.ts"
]

log_path = "/Users/srvns/.gemini/antigravity-ide/brain/edbcd7ad-3f0c-474b-89de-ffec2e1a8474/.system_generated/logs/transcript_full.jsonl"
recovered = set()

print("Scanning for initial VIEW_FILE outputs...")
try:
    with open(log_path, 'r') as f:
        for line in f:
            entry = json.loads(line)
            if entry.get('type') == 'VIEW_FILE':
                content = entry.get('content', '')
                
                # Match the file path
                for path in target_files:
                    if path in recovered:
                        continue
                    if f"File Path: `{path}`" in content or f"File Path: `file://{path}`" in content:
                        print(f"Found {path}")
                        lines = content.split('\n')
                        code_lines = []
                        for l in lines:
                            if l.startswith("The following code has been modified") or l.startswith("Showing lines") or l.startswith("Total Lines") or l.startswith("File Path") or l.startswith("Total Bytes") or l.startswith("Created At:") or l.startswith("Completed At:"):
                                continue
                            
                            # match line number: 1: ...
                            m = re.match(r'^(\d+):(.*)$', l)
                            if m:
                                code_content = m.group(2)
                                if code_content.startswith(' '):
                                    code_content = code_content[1:]
                                code_lines.append(code_content)
                            else:
                                if len(l.strip()) == 0 and len(code_lines) == 0:
                                    continue
                                if code_lines:
                                    # handle multiline if needed
                                    pass
                        
                        if code_lines:
                            with open(path, 'w') as out_f:
                                out_f.write('\n'.join(code_lines) + '\n')
                            recovered.add(path)
                            
    print(f"Recovered {len(recovered)} out of {len(target_files)} files.")
except Exception as e:
    print(f"Error: {e}")

