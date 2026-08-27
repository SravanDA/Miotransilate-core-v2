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

                target = args.get("TargetFile", "")
                
                if "MyWork.tsx" in target or "Deployments.tsx" in target or "Settings.tsx" in target or "PageDetail.tsx" in target or "TagDetail.tsx" in target:
                    if name == "write_to_file":
                        files[target] = args.get("CodeContent", "")
                    elif name == "replace_file_content":
                        t = args.get("TargetContent", "")
                        r = args.get("ReplacementContent", "")
                        if target in files:
                            files[target] = files[target].replace(t, r)
                    elif name == "multi_replace_file_content":
                        if target in files:
                            for chunk in args.get("ReplacementChunks", []):
                                t = chunk.get("TargetContent", "")
                                r = chunk.get("ReplacementContent", "")
                                files[target] = files[target].replace(t, r)
        except Exception as e:
            pass

for filepath, content in files.items():
    print(f"Writing {filepath} (len: {len(content)})")
    with open(filepath, "w") as f:
        f.write(content)
