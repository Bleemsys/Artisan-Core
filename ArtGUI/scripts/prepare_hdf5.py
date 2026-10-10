"""Prepare native HDF5 runtime dependencies for a Windows ArtGUI build.

Run from ArtGUI: python scripts/prepare_hdf5.py --hdf5-dir C:\\ProgramData\\Anaconda3
This copies DLLs, records their hashes/licenses and maps them beside the installed EXE.
It does not install or modify the HDF5 installation.
"""
from pathlib import Path
import argparse, hashlib, json, os, shutil, struct

def dll_imports(path):
    data=path.read_bytes();pe=struct.unpack_from('<I',data,0x3c)[0]
    if data[pe:pe+4]!=b'PE\0\0':raise ValueError(f'Not a PE library: {path}')
    machine,count,_,_,_,size,_=struct.unpack_from('<HHIIIHH',data,pe+4)
    if machine!=0x8664:raise ValueError(f'Expected x64 DLL: {path}')
    optional=pe+24;magic=struct.unpack_from('<H',data,optional)[0]
    directory=optional+(112 if magic==0x20b else 96)
    sections=[]
    for i in range(count):
        at=optional+size+i*40;virtual_size,rva,raw_size,raw=struct.unpack_from('<IIII',data,at+8);sections.append((rva,max(virtual_size,raw_size),raw))
    def offset(rva):
        for start,length,raw in sections:
            if start<=rva<start+length:return raw+rva-start
        raise ValueError(f'Invalid import RVA in {path}')
    def name(rva):
        at=offset(rva);return data[at:data.index(b'\0',at)].decode('ascii').lower()
    imports=[]
    rva=struct.unpack_from('<I',data,directory+8)[0]
    if rva:
        at=offset(rva)
        while any(data[at:at+20]):imports.append(name(struct.unpack_from('<I',data,at+12)[0]));at+=20
    # Delay-load descriptors also contain a DLL-name RVA.
    rva=struct.unpack_from('<I',data,directory+13*8)[0]
    if rva:
        at=offset(rva)
        while any(data[at:at+32]):
            flags,name_rva=struct.unpack_from('<II',data,at)
            if flags&1:imports.append(name(name_rva))
            at+=32
    return imports

def prepare(root,app):
    library=root/'Library' if (root/'Library/include/hdf5.h').is_file() else root
    if not (library/'include/hdf5.h').is_file() or not (library/'lib/hdf5.lib').is_file():raise ValueError('HDF5_DIR must contain include/hdf5.h, lib/hdf5.lib and bin/hdf5.dll (or an Anaconda Library folder).')
    source=library/'bin';available={p.name.lower():p for p in source.glob('*.dll')}
    pending=['hdf5.dll'];found={};system=Path(os.environ.get('SystemRoot',r'C:\Windows'))/'System32'
    while pending:
        name=pending.pop()
        if name in found:continue
        if name not in available:
            if name.startswith(('api-ms-','ext-ms-')) or (system/name).is_file():continue
            raise ValueError(f'Missing runtime dependency: {name}')
        path=available[name];found[name]=path;pending.extend(dll_imports(path))
    destination=app/'src-tauri/resources/hdf5';destination.mkdir(parents=True,exist_ok=True)
    records=[]
    # Retain available redistributable licenses from the Conda package cache.
    owners={}
    for metadata in (root/'conda-meta').glob('*.json'):
        item=json.loads(metadata.read_text(encoding='utf-8'))
        for filename in item.get('files',[]):
            if filename.lower().startswith('library/bin/') and filename.lower().endswith('.dll'):owners[Path(filename).name.lower()]=item
    packages=set()
    for name,path in sorted(found.items()):
        shutil.copy2(path,destination/name)
        owner=owners.get(name);license_files=[]
        if owner:
            package=owner.get('name','unknown')+'-'+owner.get('version','unknown')
            cached=Path(owner.get('extracted_package_dir',''))/'info/licenses'
            if cached.is_dir():
                for license in cached.rglob('*'):
                    if license.is_file():
                        relative=Path('licenses')/package/license.relative_to(cached);target=destination/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(license,target);license_files.append(relative.as_posix())
            packages.add(package)
        records.append({'filename':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source':str(path),'package':package if owner else None,'licenses':license_files})
    (destination/'runtime-manifest.json').write_text(json.dumps({'hdf5Dir':str(root),'dlls':records},indent=2)+'\n',encoding='utf-8')
    config_path=app/'src-tauri/tauri.conf.json';config=json.loads(config_path.read_text(encoding='utf-8'))
    resources=config['bundle']['resources']
    for key in list(resources):
        if key.startswith('resources/hdf5/'):del resources[key]
    for record in records:resources['resources/hdf5/'+record['filename']]=record['filename']
    resources['resources/hdf5/runtime-manifest.json']='hdf5-runtime-manifest.json'
    if (destination/'licenses').is_dir():resources['resources/hdf5/licenses/']='hdf5-licenses/'
    config_path.write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8')
    # Cargo/Tauri development executables and unit tests need DLLs beside the EXE.
    for folder in ('debug','debug/deps','release'):
        target=app/'src-tauri/target'/folder;target.mkdir(parents=True,exist_ok=True)
        for name,path in found.items():shutil.copy2(path,target/name)
    return {'library':str(library),'dlls':sorted(found),'licensePackages':sorted(packages),'runtimeBytes':sum(p.stat().st_size for p in found.values())}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hdf5-dir',type=Path,default=Path(os.environ['HDF5_DIR']) if 'HDF5_DIR' in os.environ else None)
    args=parser.parse_args()
    if args.hdf5_dir is None:parser.error('Set HDF5_DIR or pass --hdf5-dir.')
    print(json.dumps(prepare(args.hdf5_dir,Path(__file__).resolve().parents[1]),indent=2))
