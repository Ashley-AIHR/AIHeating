"""Content-addressed comparison reference; different existing freezes are rejected."""
import hashlib
import json
from pathlib import Path

from .state import content_hash


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_immutable_json(path,value):
    path=Path(path)
    text=json.dumps(value,indent=2,sort_keys=True,allow_nan=False)+"\n"
    if path.exists():
        if path.read_text()!=text:
            raise ValueError(f"Refusing to overwrite different frozen artifact: {path}")
        return
    path.write_text(text)


def verify_file_hashes(root,hashes):
    root=Path(root).resolve()
    errors=[]
    for relative,expected in hashes.items():
        path=(root/relative).resolve()
        if not path.is_relative_to(root) or not path.is_file() or file_hash(path)!=expected:
            errors.append(relative)
    return errors


def verify_freeze(root):
    root=Path(root)
    manifest=json.loads((root/"P2_BASELINE_FREEZE_MANIFEST.json").read_text())
    config=json.loads((root/"p2_controller_config.json").read_text())
    errors=verify_file_hashes(root,manifest["artifactFileHashes"])
    errors+=verify_file_hashes(root,manifest["acceptedP1AFileHashes"])
    if content_hash(config)!=manifest["controllerConfigHash"]:
        errors.append("controllerConfigHash")
    return errors
