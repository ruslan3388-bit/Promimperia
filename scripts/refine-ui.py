from pathlib import Path
p=Path(__file__).resolve().parents[1]/'public'/'app-v3.js'
s=p.read_text(encoding='utf-8')
s=s.replace("const ratio=Math.min(1,own.stock[c.resource]/c.amount);return", "const ratio=Math.min(1,own.stock[c.resource]/c.amount);const waiting=c.readyAt>now();return")
s=s.replace("${ratio<1?'disabled':''}>Поставить ↗", "${ratio<1||waiting?'disabled':''}>${waiting?remaining(c.readyAt):'Поставить ↗'}")
p.write_text(s,encoding='utf-8')
