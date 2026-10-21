import re
import sys
from pathlib import Path

EM=chr(0x2014)
EN=chr(0x2013)
MINUS=chr(0x2212)
HBAR=chr(0x2015)
BANNED=EM + EN + MINUS + HBAR

BULLET=re.compile(r"^([ \t]*(?:\*|//)?[ \t]*)[" + BANNED + r"][ \t]*")
RANGE=re.compile(r"(?<=[0-9A-Za-z])[" + EN + MINUS + r"](?=[0-9A-Za-z])")
ANY=re.compile(r"[ \t]*[" + BANNED + r"][ \t]*")

def convert_line(body: str) -> str:
 body=BULLET.sub(lambda m: m.group(1) + "- ", body)
 body=RANGE.sub(" to ", body)
 body=ANY.sub(", ", body)
 body=re.sub(r",[ \t]+$", ",", body)
 return body

def convert(text: str) -> str:
 out=[]
 for line in text.splitlines(keepends=True):
  if line.endswith("\r\n"):
   body, end = line[:-2], "\r\n"
  elif line.endswith("\n"):
   body, end = line[:-1], "\n"
  else:
   body, end = line, ""
  out.append(convert_line(body) + end)
 return "".join(out)

def main() -> int:
 check="--check" in sys.argv
 roots=[Path(a) for a in sys.argv[1:] if not a.startswith("--")]
 files=sorted(
  {p for r in roots for p in ([r] if r.is_file() else r.rglob("*.ts"))}
 )
 if not files:
  print("no .ts files found")
  return 1

 if check:
  offenders=[
   f"{f}:{i}: {ln.strip()[:90]}"
   for f in files
   for i, ln in enumerate(f.read_text(encoding="utf-8").splitlines(), 1)
   if any(c in ln for c in BANNED)
  ]
  if offenders:
   print(f"FAIL: {len(offenders)} banned dash occurrences remain")
   for o in offenders[:20]:
    print("  " + o)
   return 1
  print(f"OK: no banned dashes in {len(files)} files")
  return 0

 changed=0
 for f in files:
  text=f.read_text(encoding="utf-8")
  new=convert(text)
  if new != text:
   f.write_text(new, encoding="utf-8")
   changed += 1
 print(f"rewrote {changed} of {len(files)} files")
 return 0

if __name__ == "__main__":
 sys.exit(main())
