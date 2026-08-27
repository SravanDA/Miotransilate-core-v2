import json

log_file = "/Users/srvns/.gemini/antigravity-ide/brain/edbcd7ad-3f0c-474b-89de-ffec2e1a8474/.system_generated/logs/transcript_full.jsonl"
files = {}

with open(log_file) as f:
    for line in f:
        try:
            data = json.loads(line)
            if "tool_calls" in data:
                for tc in data["tool_calls"]:
                    name = tc.get("name")
                    args = tc.get("args", {})
                    
                    # Unescape arguments
                    parsed_args = {}
                    for k, v in args.items():
                        if isinstance(v, str):
                            try:
                                parsed_args[k] = json.loads(v)
                            except:
                                parsed_args[k] = v
                        else:
                            parsed_args[k] = v
                            
                    target = parsed_args.get("TargetFile", "")
                    
                    if not target.endswith((".tsx",)):
                        continue
                        
                    if name == "write_to_file":
                        files[target] = parsed_args.get("CodeContent", "")
                    elif name == "replace_file_content":
                        if target in files:
                            target_content = parsed_args.get("TargetContent", "")
                            replacement = parsed_args.get("ReplacementContent", "")
                            files[target] = files[target].replace(target_content, replacement)
                    elif name == "multi_replace_file_content":
                        if target in files:
                            for chunk in parsed_args.get("ReplacementChunks", []):
                                target_content = chunk.get("TargetContent", "")
                                replacement = chunk.get("ReplacementContent", "")
                                files[target] = files[target].replace(target_content, replacement)
        except Exception as e:
            print("Error parsing line:", e)

for filepath, content in files.items():
    if filepath.endswith(("MyWork.tsx", "Settings.tsx", "PageDetail.tsx", "TagDetail.tsx", "Deployments.tsx")):
        print(f"Restoring {filepath}")
        with open(filepath, "w") as f:
            f.write(content)
