import json

log_file = "/Users/srvns/.gemini/antigravity-ide/brain/edbcd7ad-3f0c-474b-89de-ffec2e1a8474/.system_generated/logs/transcript_full.jsonl"
files = {}

with open(log_file) as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get("step_index")
            if "tool_calls" in data:
                for tc in data["tool_calls"]:
                    name = tc.get("name")
                    args = tc.get("args", {})
                    
                    parsed_args = {}
                    for k, v in args.items():
                        if isinstance(v, str):
                            try: parsed_args[k] = json.loads(v)
                            except: parsed_args[k] = v
                        else:
                            parsed_args[k] = v
                            
                    target = parsed_args.get("TargetFile", "")
                    
                    if not target.endswith((".tsx",)):
                        continue
                        
                    if name == "write_to_file":
                        files[target] = parsed_args.get("CodeContent", "")
                        print(f"Step {step}: {target} -> length {len(files[target].splitlines())}")
                    elif name == "replace_file_content":
                        if target in files:
                            target_content = parsed_args.get("TargetContent", "")
                            replacement = parsed_args.get("ReplacementContent", "")
                            files[target] = files[target].replace(target_content, replacement)
                            print(f"Step {step}: {target} -> length {len(files[target].splitlines())}")
                    elif name == "multi_replace_file_content":
                        if target in files:
                            for chunk in parsed_args.get("ReplacementChunks", []):
                                target_content = chunk.get("TargetContent", "")
                                replacement = chunk.get("ReplacementContent", "")
                                files[target] = files[target].replace(target_content, replacement)
                            print(f"Step {step}: {target} -> length {len(files[target].splitlines())}")
        except Exception as e:
            pass
