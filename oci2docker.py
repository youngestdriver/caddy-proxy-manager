#!/usr/bin/env python3
import gzip
import json
import os
import shutil
import sys
import tarfile

src, dst = sys.argv[1], sys.argv[2]
work = "/tmp/oci2docker-in"
out = "/tmp/oci2docker-out"

shutil.rmtree(work, ignore_errors=True)
shutil.rmtree(out, ignore_errors=True)
os.makedirs(work)
os.makedirs(out)

with tarfile.open(src) as t:
    t.extractall(work)

with open(os.path.join(work, "index.json")) as f:
    idx = json.load(f)
mdig = idx["manifests"][0]["digest"].split(":")[1]
with open(os.path.join(work, "blobs/sha256", mdig)) as f:
    mani = json.load(f)

cfgd = mani["config"]["digest"].split(":")[1]
shutil.copyfile(os.path.join(work, "blobs/sha256", cfgd), os.path.join(out, cfgd + ".json"))

layer_paths = []
for layer in mani["layers"]:
    d = layer["digest"].split(":")[1]
    src_blob = os.path.join(work, "blobs/sha256", d)
    ldir = os.path.join(out, d)
    os.makedirs(ldir, exist_ok=True)
    with open(src_blob, "rb") as f:
        magic = f.read(2)
    if magic == b"\x1f\x8b":
        with gzip.open(src_blob, "rb") as fin, open(os.path.join(ldir, "layer.tar"), "wb") as fout:
            shutil.copyfileobj(fin, fout)
    else:
        shutil.copyfile(src_blob, os.path.join(ldir, "layer.tar"))
    with open(os.path.join(ldir, "VERSION"), "w") as f:
        f.write("1.0")
    with open(os.path.join(ldir, "json"), "w") as f:
        json.dump({"id": d, "created": "1970-01-01T00:00:00Z"}, f)
    layer_paths.append(d + "/layer.tar")

with open(os.path.join(out, "manifest.json"), "w") as f:
    json.dump([{"Config": cfgd + ".json", "RepoTags": ["caddy-panel:1"], "Layers": layer_paths}], f)
with open(os.path.join(out, "repositories"), "w") as f:
    json.dump({"caddy-panel": {"1": mani["layers"][-1]["digest"].split(":")[1]}}, f)

with tarfile.open(dst, "w") as t:
    for name in sorted(os.listdir(out)):
        t.add(os.path.join(out, name), arcname=name)

print("wrote", dst, os.path.getsize(dst))
