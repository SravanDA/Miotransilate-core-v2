import json

log_path = "/Users/srvns/.gemini/antigravity-ide/brain/edbcd7ad-3f0c-474b-89de-ffec2e1a8474/.system_generated/logs/transcript_full.jsonl"
edits = []

# Collect all edits in order
print("Collecting edits...")
with open(log_path, 'r') as f:
    for line in f:
        try:
            entry = json.loads(line)
            if entry.get('type') == 'PLANNER_RESPONSE':
                for tc in entry.get('tool_calls', []):
                    name = tc.get('name')
                    args = tc.get('arguments', {})
                    if name in ['default_api:replace_file_content', 'replace_file_content']:
                        edits.append({
                            'file': args.get('TargetFile'),
                            'target': args.get('TargetContent'),
                            'replacement': args.get('ReplacementContent')
                        })
                    elif name in ['default_api:multi_replace_file_content', 'multi_replace_file_content']:
                        chunks = args.get('ReplacementChunks', [])
                        for chunk in chunks:
                            edits.append({
                                'file': args.get('TargetFile'),
                                'target': chunk.get('TargetContent'),
                                'replacement': chunk.get('ReplacementContent')
                            })
        except Exception:
            pass

edits.reverse()

print(f"Applying {len(edits)} edits in reverse...")

for edit in edits:
    filepath = edit['file']
    old_content = edit['replacement'] # The new text
    new_content = edit['target']      # The old text that we want back
    
    if not filepath or not old_content or not new_content:
        continue
        
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            
        # Revert the edit
        if old_content in content:
            content = content.replace(old_content, new_content)
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"Reverted edit in {filepath}")
        else:
            pass
            # print(f"Could not find exact text to revert in {filepath}")
    except Exception as e:
        print(f"Error reverting {filepath}: {e}")

