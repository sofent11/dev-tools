# Public NuGet CMS fixtures

`nuget-signed-data.p7s` is a genuine detached CMS `SignedData` container over the
seven ASCII bytes `fixture`. It contains one public RSA certificate,
`nuget-test-certificate.der`, with subject `CN=Fixture certificate`, issuer
`CN=Fixture issuer`, serial `01`, and validity from 2025-01-01 through 2030-01-01
UTC. This is synthetic test data, not a real NuGet package or trusted identity.
No private keys are included. The certificate issuer and CMS signer keys were
created in a temporary directory and deleted automatically after generation.

These files were generated with OpenSSL 3.6.3. The signature was checked with
`openssl cms -verify -binary -noverify` against the original content; that check
proves the fixture's signature, not a trusted certificate chain. The CMS SHA-256
is `c6772c973070d394d64b55bd332b7716f68538e6318c18efabb12a140568d95c`.
The certificate SHA-256 is
`0B:20:68:41:62:A5:A5:D2:A8:F4:EB:FE:D4:5B:BC:C6:76:5A:A1:EC:75:03:78:0B:DF:2F:7C:83:7E:8D:F4:CA`.

To regenerate from the repository root, run this Python script with OpenSSL 3.6
or later. It uses temporary private keys and writes only the two public files
into the repository. Keys and signatures are random, so update the documented
fingerprints and any fixed unit-test expectations after regeneration. The
browser tests calculate their expected fingerprints independently from the
public DER fixture.

```python
from pathlib import Path
import subprocess
import tempfile

fixtures = Path("tests/fixtures").resolve()
with tempfile.TemporaryDirectory(prefix="dev-tools-nuget-fixture-") as temp:
    folder = Path(temp)
    def openssl(*args):
        subprocess.run(["openssl", *map(str, args)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", folder / "issuer-key.pem", "-out", folder / "issuer.pem",
            "-subj", "/CN=Fixture issuer", "-days", "3650", "-sha256")
    openssl("req", "-new", "-newkey", "rsa:2048", "-nodes",
            "-keyout", folder / "signer-key.pem", "-out", folder / "signer.csr",
            "-subj", "/CN=Fixture certificate", "-sha256")
    openssl("x509", "-req", "-in", folder / "signer.csr",
            "-CA", folder / "issuer.pem", "-CAkey", folder / "issuer-key.pem",
            "-set_serial", "0x01", "-not_before", "20250101000000Z",
            "-not_after", "20300101000000Z", "-sha256",
            "-out", folder / "signer.pem")
    (folder / "content.txt").write_bytes(b"fixture")
    openssl("cms", "-sign", "-binary", "-in", folder / "content.txt",
            "-signer", folder / "signer.pem", "-inkey", folder / "signer-key.pem",
            "-outform", "DER", "-md", "sha256", "-nosmimecap",
            "-out", fixtures / "nuget-signed-data.p7s")
    openssl("x509", "-in", folder / "signer.pem", "-outform", "DER",
            "-out", fixtures / "nuget-test-certificate.der")
    openssl("cms", "-verify", "-binary", "-inform", "DER",
            "-in", fixtures / "nuget-signed-data.p7s",
            "-content", folder / "content.txt", "-noverify",
            "-out", folder / "verified.txt")
    assert (folder / "verified.txt").read_bytes() == b"fixture"
```

Other fixtures in this directory support animation and PDF regression tests;
they are unrelated to CMS parsing.
