from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import subprocess as sp,tempfile,hashlib,shutil
out=Path('/workspace/shared/downloads');r=Path('/workspace/sites-validation');d=Path('/workspace/Founder2K')
def git(repo,*a):return sp.check_output(['git','-C',repo,*a])
def digest(b):return hashlib.sha256(b).hexdigest()
src=out/'Founder2K-Sites-venue.zip';patch=out/'Founder2K-Sites-venue.patch'
base=next(Path('/workspace/attachments').rglob('Founder2K-Sites-source-8205b68.zip'))
expected='8205b6801de8017dbb9ed23033bddb8971822a52'
assert not git(r,'status','--porcelain').strip(), 'unstaged changes'
head=git(r,'rev-parse','HEAD').decode().strip()
assert digest(git(r,'diff','--binary','99b29af','HEAD'))==digest(patch.read_bytes())
with tempfile.TemporaryDirectory() as tmp,ZipFile(base) as orig,ZipFile(src) as z:
 assert orig.comment.decode()==expected
 assert z.comment.decode()==head
 assert z.testzip() is None
 orig.extractall(tmp)
 sp.run(['git','apply','--check',str(patch)],cwd=tmp,check=True)
 sp.run(['git','-c','apply.whitespace=nowarn','apply',str(patch)],cwd=tmp,check=True)
 actual={p.relative_to(tmp).as_posix():p for p in Path(tmp).rglob('*') if p.is_file()}
 assert set(actual)=={i.filename for i in z.infolist() if not i.is_dir()}
 assert all(p.read_bytes()==z.read(n) for n,p in actual.items())
 print('Verified',len(actual),'source files on',head)
files={f.name:f.read_bytes() for f in [src,patch]}
for f in d.glob('docs/venue-*.md'):files['docs/'+f.name]=f.read_bytes()
files['Founder2K-collaboration.patch']=git(d,'diff','--binary','c213e96','HEAD','--','README.md','docs')
files['SHA256SUMS']=('\n'.join(digest(b)+'  '+n for n,b in files.items())+'\n').encode()
target=out/'Founder2K-venue-handoff.zip'
with ZipFile(target,'w',ZIP_DEFLATED) as z:
 for n,b in files.items():z.writestr(n,b)
with ZipFile(target) as z:
 assert z.testzip() is None
 assert all(z.read(n)==b for n,b in files.items())
print(target.name,target.stat().st_size,digest(target.read_bytes()))
