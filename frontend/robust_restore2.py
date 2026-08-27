import json

log_file = "/Users/srvns/.gemini/antigravity-ide/brain/edbcd7ad-3f0c-474b-89de-ffec2e1a8474/.system_generated/logs/transcript_full.jsonl"
files = {}

with open(log_file) as f:
    for line in f:
        try:
            data = json.loads(line)
            if "tool_calls" not in data: continue
            for tc in data["tool_calls"]:
                name = tc.get("name")
                args = tc.get("args")
                if not args or not isinstance(args, dict): continue

                target_raw = args.get("TargetFile", "")
                
                # Unpack json encoded strings
                target = target_raw
                try: target = json.loads(target_raw)
                except: pass
                
                if "MyWork.tsx" in target or "Deployments.tsx" in target or "Settings.tsx" in target or "PageDetail.tsx" in target or "TagDetail.tsx" in target:
                    
                    code = args.get("CodeContent", "")
                    try: code = json.loads(code)
                    except: pass
                    
                    if name == "write_to_file":
                        files[target] = code
                        
                    elif name == "replace_file_content":
                        t = args.get("TargetContent", "")
                        try: t = json.loads(t)
                        except: pass
                        
                        r = args.get("ReplacementContent", "")
                        try: r = json.loads(r)
                        except: pass
                        
                        if target in files:
                            files[target] = files[target].replace(t, r)
                            
                    elif name == "multi_replace_file_content":
                        if target in files:
                            chunks = args.get("ReplacementChunks", [])
                            try: chunks = json.loads(chunks)
                            except: pass
                            
                            if isinstance(chunks, list):
                                for chunk in chunks:
                                    t = chunk.get("TargetContent", "")
                                    try: t = json.loads(t)
                                    except: pass
                                    r = chunk.get("ReplacementContent", "")
                                    try: r = json.loads(r)
                                    except: pass
                                    files[target] = files[target].replace(t, r)
        except Exception as e:
            pass

for filepath, content in files.items():
    print(f"Writing {filepath} (len: {len(content)})")
    with open(filepath, "w") as f:
        f.write(content)
