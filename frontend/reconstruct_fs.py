import json
import sys

log_path = "/Users/srvns/.gemini/antigravity-ide/brain/edbcd7ad-3f0c-474b-89de-ffec2e1a8474/.system_generated/logs/transcript_full.jsonl"

file_states = {} # { filepath: [(step_index, content)] }

print("Reconstructing file history from transcript...")
try:
    with open(log_path, 'r') as f:
        for line in f:
            entry = json.loads(line)
            step_index = entry.get('step_index', 0)
            
            if entry.get('type') == 'PLANNER_RESPONSE':
                for tc in entry.get('tool_calls', []):
                    args = tc.get('arguments', {})
                    if tc['name'] == 'default_api:write_to_file':
                        filepath = args.get('TargetFile')
                        content = args.get('CodeContent', '')
                        if filepath:
                            if filepath not in file_states: file_states[filepath] = []
                            file_states[filepath].append((step_index, content))
                            
                    elif tc['name'] in ['default_api:replace_file_content', 'default_api:multi_replace_file_content']:
                        filepath = args.get('TargetFile')
                        # It's too complex to apply the replacements accurately in python if it relies on exact line matches that might have spacing differences,
                        # but wait, we can just save the states when write_to_file was called. 
                        # If I just want to find when the files were originally created!
                        pass

    # Print out the files we tracked and their step indexes
    for filepath, states in file_states.items():
        if "frontend/src/pages" in filepath or "miosalon.css" in filepath:
            print(f"{filepath}: {[s[0] for s in states]}")
            
except Exception as e:
    print(f"Error: {e}")

