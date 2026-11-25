from pathlib import Path
from zipfile import ZipFile
import subprocess,shutil
src=Path('/workspace/sites-validation')
docs=Path('/workspace/Founder2K')
out=Path('/workspace/shared/downloads')
def run(*args,cwd=src):return subprocess.check_output(args,cwd=cwd)
files=run('git','ls-files','--cached','--others','--exclude-standard','-z').split(b'\0')
for f in filter(None,files):
 assert not any(s in f.decode().split('/') for s in ['.dev.vars','.git','node_modules','.sites-runtime','dist','.wrangler'])
run('git','add','--','app','scripts/venue-clock.mjs','tests','db','drizzle','package.json','package-lock.json')
(out/'Founder2K-Sites-venue.patch').write_bytes(run('git','diff','--binary','HEAD'))
run('git','-c','user.name=Founder2K integration','-c','user.email=local@invalid','commit','-qm','Integrate private event venue, media controls and rehearsal workflow') if subprocess.run(['git','diff','--cached','--quiet'],cwd=src).returncode else None
zipfile=out/'Founder2K-Sites-venue.zip'
run('git','archive','--format=zip','--output='+str(zipfile),'HEAD')
with ZipFile(zipfile) as z:
 assert z.testzip() is None
 for n in ['app/venue/page.tsx','app/api/venue/route.ts','drizzle/0003_venue_execution.sql','tests/rehearsal/run.mjs','app/api/venue/webhook/route.ts','package-lock.json']:assert z.read(n)==(src/n).read_bytes()
print('ZIP verified',zipfile.stat().st_size)
