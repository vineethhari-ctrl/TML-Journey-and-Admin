#!/usr/bin/env python3
"""Builds android/build/FaceReveal.apk without the Android SDK.

Pieces come from Maven Central / PyPI (Android SDK hosts are not needed):
  android-all (framework jar), dalvik-dx (dexer), pyaxml (binary manifest), cryptography (signing).

    python3 android/build_apk.py            # uses ~/.cache/face-reveal-apk for downloads and the signing key
(needs: pip install pyaxml cryptography; JDK 8+)
Env: FR_CACHE=<dir> to move the cache. Keep the key: updates must be signed with the same one.
"""
import os, subprocess, sys, shutil, zipfile, urllib.request, pathlib, struct, hashlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
CACHE = pathlib.Path(os.environ.get('FR_CACHE', pathlib.Path.home() / '.cache' / 'face-reveal-apk'))
BUILD = ROOT / 'build'
CENTRAL = 'https://repo.maven.apache.org/maven2'
JARS = {
    'android.jar': f'{CENTRAL}/org/robolectric/android-all/13-robolectric-9030017/android-all-13-robolectric-9030017.jar',
    'dx.jar': f'{CENTRAL}/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar',
    'ort.aar': f'{CENTRAL}/com/microsoft/onnxruntime/onnxruntime-android/1.20.0/onnxruntime-android-1.20.0.aar',
}

def run(*a, **k):
    subprocess.run([str(x) for x in a], check=True, **k)

def fetch():
    CACHE.mkdir(parents=True, exist_ok=True)
    for name, url in JARS.items():
        dest = CACHE / name
        if not dest.exists():
            print('downloading', name)
            urllib.request.urlretrieve(url, dest)

# android:configChanges flag bits (orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize)
CONFIG_CHANGES = 0x80 | 0x400 | 0x20 | 0x100 | 0x800
TYPE_INT_HEX = 0x11000008
# Attributes Android reads as numbers/booleans: a text value here makes the package fail to parse.
MUST_BE_TYPED = {'versionCode', 'minSdkVersion', 'targetSdkVersion', 'configChanges',
                 'exported', 'allowBackup', 'usesCleartextTraffic', 'largeHeap'}
TYPE_STRING = 0x03000008

def _attributes(ax, proto):
    for elt in proto.resourcexml.elts:
        if elt.HasField('start_elt'):
            for a in elt.start_elt.attributes:
                yield ax.get_string(a.name), a

def manifest():
    import pyaxml  # pip install pyaxml
    ax = pyaxml.AXML()
    ax.from_xml((ROOT / 'AndroidManifest.xml').read_text())
    proto = ax.to_proto()
    # pyaxml writes the flags value as text; Android needs a typed integer.
    patched = 0
    for name, a in _attributes(ax, proto):
        if name == 'configChanges':
            a.type, a.value, a.data = TYPE_INT_HEX, 0xFFFFFFFF, CONFIG_CHANGES
            patched += 1
    if patched != 1:
        raise SystemExit('could not find android:configChanges in the manifest')
    ax = pyaxml.AXML.from_proto(proto)
    packed = ax.pack()
    check = pyaxml.AXML.from_axml(packed)
    seen = set()
    for name, a in _attributes(check, check.to_proto()):
        if name in MUST_BE_TYPED:
            seen.add(name)
            if a.type == TYPE_STRING:
                raise SystemExit(f'manifest attribute {name} is stored as text; Android would reject the APK')
    if seen != MUST_BE_TYPED:
        raise SystemExit(f'manifest check did not see {sorted(MUST_BE_TYPED - seen)}')
    return packed

def signing_key():
    """RSA key + self-signed cert, created once in the cache. Updates must reuse it."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID
    kp, cp = CACHE / 'key.pem', CACHE / 'cert.pem'
    if not kp.exists():
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Face Reveal')])
        now = datetime.datetime.now(datetime.timezone.utc)
        cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
                .serial_number(x509.random_serial_number()).not_valid_before(now)
                .not_valid_after(now + datetime.timedelta(days=36500)).sign(key, hashes.SHA256()))
        kp.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                         serialization.NoEncryption()))
        cp.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return (serialization.load_pem_private_key(kp.read_bytes(), None),
            x509.load_pem_x509_certificate(cp.read_bytes()))

def sign_v2(src, dst):
    """APK Signature Scheme v2 (RSA PKCS#1 v1.5 + SHA-256), written from the published spec."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    key, cert = signing_key()
    u32 = lambda n: struct.pack('<I', n)
    u64 = lambda n: struct.pack('<Q', n)
    lp = lambda b: u32(len(b)) + b                      # length-prefixed

    data = pathlib.Path(src).read_bytes()
    eocd = data.rindex(b'PK\x05\x06')
    cd_off = struct.unpack_from('<I', data, eocd + 16)[0]
    sections = [data[:cd_off], data[cd_off:eocd], data[eocd:]]   # entries, central dir, EOCD

    chunks = []
    for sec in sections:
        for i in range(0, len(sec), 1 << 20):
            c = sec[i:i + (1 << 20)]
            chunks.append(hashlib.sha256(b'\xa5' + u32(len(c)) + c).digest())
    digest = hashlib.sha256(b'\x5a' + u32(len(chunks)) + b''.join(chunks)).digest()

    RSA_SHA256 = 0x0103
    signed = lp(lp(u32(RSA_SHA256) + lp(digest))) + lp(lp(cert.public_bytes(serialization.Encoding.DER))) + lp(b'')
    sig = key.sign(signed, padding.PKCS1v15(), hashes.SHA256())
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    signer = lp(signed) + lp(lp(u32(RSA_SHA256) + lp(sig))) + lp(pub)
    pair = u32(0x7109871a) + lp(lp(signer))
    block_body = u64(len(pair)) + pair
    block = u64(len(block_body) + 8 + 16) + block_body + u64(len(block_body) + 8 + 16) + b'APK Sig Block 42'

    new_eocd = bytearray(data[eocd:])
    struct.pack_into('<I', new_eocd, 16, cd_off + len(block))
    pathlib.Path(dst).write_bytes(data[:cd_off] + block + data[cd_off:eocd] + bytes(new_eocd))

def main():
    fetch()
    shutil.rmtree(BUILD, ignore_errors=True)
    (BUILD / 'classes').mkdir(parents=True)
    android, dx = CACHE / 'android.jar', CACHE / 'dx.jar'
    with zipfile.ZipFile(CACHE / 'ort.aar') as aar:  # ONNX Runtime: its Java classes and the arm64 native libraries
        ort_classes = BUILD / 'ort-classes.jar'
        ort_classes.write_bytes(aar.read('classes.jar'))
        ort_libs = {n: aar.read(n) for n in aar.namelist() if n.startswith('jni/arm64-v8a/') and n.endswith('.so')}

    run('javac', '-source', '8', '-target', '8', '-Xlint:-options', '-cp', f'{android}{os.pathsep}{ort_classes}',
        '-d', BUILD / 'classes', *(ROOT / 'src').rglob('*.java'))
    run('java', '-cp', dx, 'com.android.dx.command.Main', '--dex', '--min-sdk-version=29',
        f'--output={BUILD / "classes.dex"}', BUILD / 'classes', ort_classes)

    unsigned = BUILD / 'unsigned.apk'
    web = REPO / 'public' / 'face-reveal'
    with zipfile.ZipFile(unsigned, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('AndroidManifest.xml', manifest())
        z.write(BUILD / 'classes.dex', 'classes.dex')
        z.write(ROOT / 'assets-swap' / 'emap.bin', 'assets/emap.bin')
        for name, data in sorted(ort_libs.items()):
            z.writestr('lib/arm64-v8a/' + name.rsplit('/', 1)[1], data)
        for f in sorted(web.rglob('*')):
            rel = f.relative_to(web).as_posix()
            # the web build's face finder (vendor/) is not needed here: the app finds faces with its own models
            if f.is_file() and not rel.startswith(('test/', 'vendor/')) and f.name != 'README.md':
                z.write(f, f'assets/face-reveal/{rel}')

    out = BUILD / 'FaceReveal.apk'
    sign_v2(unsigned, out)
    print('built', out, out.stat().st_size, 'bytes')

if __name__ == '__main__':
    sys.exit(main())
