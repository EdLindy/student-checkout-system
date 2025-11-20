#!/usr/bin/env python3
"""
pptx_merger.py — Merge multiple .pptx files while preserving exact slide formatting, layouts, themes, and masters.

Usage:
  1) Interactive (no args): place this script in a folder with your .pptx files and run:
       python pptx_merger.py
     You'll be prompted to choose an order.

  2) CLI with explicit files:
       python pptx_merger.py file1.pptx file2.pptx file3.pptx -o merged.pptx

Requirements: Python 3.8+ and lxml
  pip install lxml
"""

import argparse
import os
import re
import sys
import tempfile
import shutil
from zipfile import ZipFile, ZIP_DEFLATED
from typing import Dict, Optional
from pathlib import Path

from lxml import etree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}

CT_OVERRIDES = {
    "slides": "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
    "slideLayouts": "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
    "slideMasters": "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
    "charts": "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
    "theme": "application/vnd.openxmlformats-officedocument.theme+xml",
    "notesSlides": "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml",
    "handoutMasters": "application/vnd.openxmlformats-officedocument.presentationml.handoutMaster+xml",
    "notesMasters": "application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml",
}

def parse_xml(path: Path) -> ET._ElementTree:
    with path.open('rb') as f:
        return ET.parse(f)

def write_xml(tree: ET._ElementTree, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tree.write(str(path), xml_declaration=True, encoding="UTF-8", standalone="yes")

def extract_pptx(pptx_path: Path, to_dir: Path) -> None:
    with ZipFile(str(pptx_path), 'r') as z:
        z.extractall(str(to_dir))

def zip_dir(src_dir: Path, out_file: Path) -> None:
    with ZipFile(str(out_file), 'w', compression=ZIP_DEFLATED) as z:
        for root, _, files in os.walk(src_dir):
            for f in files:
                full = Path(root) / f
                arc = str(full.relative_to(src_dir)).replace("\\", "/")
                z.write(str(full), arc)

def max_index(dir_path: Path, prefix: str, suffix: str) -> int:
    mx = 0
    if not dir_path.exists():
        return 0
    for name in os.listdir(dir_path):
        if name.startswith(prefix) and name.endswith(suffix):
            m = re.search(r"(\d+)", name)
            if m:
                mx = max(mx, int(m.group(1)))
    return mx

def add_content_type_override(ct_tree: ET._ElementTree, part_name: str, content_type: str) -> None:
    root = ct_tree.getroot()
    for el in root.findall("ct:Override", NS):
        if el.get("PartName") == part_name:
            return
    el = ET.SubElement(root, "{%s}Override" % NS["ct"])
    el.set("PartName", part_name)
    el.set("ContentType", content_type)

def ensure_default_types_from_source(dest_ct: ET._ElementTree, src_ct: ET._ElementTree) -> None:
    droot = dest_ct.getroot()
    sroot = src_ct.getroot()
    have = {(el.get("Extension"), el.get("ContentType")) for el in droot.findall("ct:Default", NS)}
    for el in sroot.findall("ct:Default", NS):
        pair = (el.get("Extension"), el.get("ContentType"))
        if pair not in have:
            new = ET.SubElement(droot, "{%s}Default" % NS["ct"])
            new.set("Extension", el.get("Extension"))
            new.set("ContentType", el.get("ContentType"))
            have.add(pair)

def next_rel_id(rel_tree: ET._ElementTree) -> str:
    root = rel_tree.getroot()
    rids = []
    for rel in root.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
        rid = rel.get("Id")
        if rid and rid.startswith("rId"):
            try:
                rids.append(int(rid[3:]))
            except ValueError:
                pass
    return f"rId{(max(rids) if rids else 0) + 1}"

def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)

def copy_part_with_dependencies(src_root: Path,
                                dst_root: Path,
                                part_rel: str,
                                name_map: Dict[str, str],
                                ct_src: ET._ElementTree,
                                ct_dst: ET._ElementTree) -> str:
    """Copy a part (e.g., slides/slide1.xml) from src_root/ppt to dst_root/ppt and all internal dependencies.
       Returns the new relative path in dst (e.g., slides/slide7.xml)."""

    if part_rel in name_map:
        return name_map[part_rel]

    src_part = src_root / part_rel
    if not src_part.exists():
        return part_rel  # nothing to copy

    folder = Path(part_rel).parent.as_posix().strip("/")
    fname = Path(part_rel).name
    base, ext = os.path.splitext(fname)

    # Destination folder (relative to ppt/ root)
    dst_folder = dst_root / folder
    ensure_dir(dst_folder)

    # Choose a new unique filename based on folder type patterns
    def pick_new_filename() -> str:
        if folder == "slides":
            n = max_index(dst_folder, "slide", ".xml") + 1
            return f"slide{n}.xml"
        if folder == "slideLayouts":
            n = max_index(dst_folder, "slideLayout", ".xml") + 1
            return f"slideLayout{n}.xml"
        if folder == "slideMasters":
            n = max_index(dst_folder, "slideMaster", ".xml") + 1
            return f"slideMaster{n}.xml"
        if folder == "charts":
            n = max_index(dst_folder, "chart", ".xml") + 1
            return f"chart{n}.xml"
        if folder == "theme":
            n = max_index(dst_folder, "theme", ".xml") + 1
            return f"theme{n}.xml"
        if folder == "notesSlides":
            n = max_index(dst_folder, "notesSlide", ".xml") + 1
            return f"notesSlide{n}.xml"
        # media/embeddings/others — ensure uniqueness
        candidate = fname
        i = 1
        while (dst_folder / candidate).exists():
            candidate = f"{base}_{i}{ext}"
            i += 1
        return candidate

    new_fname = pick_new_filename()
    dst_part_rel = f"{folder}/{new_fname}" if folder else new_fname
    dst_part = dst_root / dst_part_rel

    # Copy the part file
    shutil.copyfile(src_part, dst_part)
    name_map[part_rel] = dst_part_rel

    # Update content types for known override parts
    if folder in CT_OVERRIDES:
        add_content_type_override(ct_dst, f"/ppt/{dst_part_rel}", CT_OVERRIDES[folder])
    else:
        ensure_default_types_from_source(ct_dst, ct_src)

    # Copy and patch this part's relationships recursively
    rels_src_path = src_root / folder / "_rels" / (base + ext + ".rels")
    if rels_src_path.exists():
        rels_dst_folder = dst_root / folder / "_rels"
        ensure_dir(rels_dst_folder)
        rels_dst_path = rels_dst_folder / (base + ext + ".rels")
        shutil.copyfile(rels_src_path, rels_dst_path)

        rels_tree = parse_xml(rels_dst_path)
        rroot = rels_tree.getroot()
        changed = False
        for rel in rroot.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
            target = rel.get("Target")
            if not target:
                continue

            # Only handle internal (relative) targets under ../
            # Absolute targets like external links are left as-is.
            if target.startswith("../"):
                # Normalize source-relative target path
                source_part_dir = Path(part_rel).parent
                targ_rel = (source_part_dir / target).as_posix()
                while targ_rel.startswith("../"):
                    targ_rel = targ_rel[3:]
                targ_rel = targ_rel.replace("\\", "/")

                # Recursively copy dependency
                new_dep_rel = copy_part_with_dependencies(src_root, dst_root, targ_rel, name_map, ct_src, ct_dst)

                # Compute new relative Target path from this part's folder
                new_target = os.path.relpath(new_dep_rel, start=folder).replace("\\", "/")
                if not new_target.startswith("../"):
                    new_target = "../" + new_target
                rel.set("Target", new_target)
                changed = True

        if changed:
            write_xml(rels_tree, rels_dst_path)

    return dst_part_rel

def build_file_list_from_folder(folder: Path) -> list[Path]:
    pptx_files = [p for p in folder.iterdir() if p.suffix.lower() == ".pptx"]
    if not pptx_files:
        print("No .pptx files found in this folder.")
        sys.exit(1)
    print("\nFound the following .pptx files:\n")
    for i, p in enumerate(pptx_files, 1):
        print(f"  {i}. {p.name}")
    print("\nEnter the desired order as space-separated numbers (e.g., 2 1 3 4):")
    while True:
        order = input("> ").strip()
        try:
            idxs = [int(x) for x in order.split()]
            if sorted(idxs) != list(range(1, len(pptx_files) + 1)):
                raise ValueError
            break
        except Exception:
            print("Invalid input. Please enter each file number exactly once, separated by spaces.")
    return [pptx_files[i-1] for i in idxs]

def merge_presentations(inputs: list[Path], output: Path) -> None:
    if len(inputs) < 1:
        raise ValueError("At least one input file is required.")

    with tempfile.TemporaryDirectory() as td:
        workdir = Path(td)
        base_dir = workdir / "base"
        extract_pptx(inputs[0], base_dir)

        # Load core XMLs from base
        pres_xml_path = base_dir / "ppt" / "presentation.xml"
        pres_tree = parse_xml(pres_xml_path)
        pres_root = pres_tree.getroot()

        pres_rels_path = base_dir / "ppt" / "_rels" / "presentation.xml.rels"
        pres_rels_tree = parse_xml(pres_rels_path)
        pres_rels_root = pres_rels_tree.getroot()

        ct_path = base_dir / "[Content_Types].xml"
        ct_tree = parse_xml(ct_path)

        # Ensure slide list exists
        sldIdLst = pres_root.find("p:sldIdLst", NS)
        if sldIdLst is None:
            sldIdLst = ET.SubElement(pres_root, "{%s}sldIdLst" % NS["p"])

        # Determine next sldId id and rel id
        def current_max_sld_id() -> int:
            mx = 256
            for el in sldIdLst.findall("p:sldId", NS):
                try:
                    mx = max(mx, int(el.get("id", "256")))
                except ValueError:
                    pass
            return mx

        def next_pres_rId() -> str:
            return next_rel_id(pres_rels_tree)

        max_sld_id = current_max_sld_id()

        # Merge each subsequent presentation
        for src_file in inputs[1:]:
            src_dir = workdir / f"src_{src_file.stem}"
            extract_pptx(src_file, src_dir)

            ct_src_tree = parse_xml(src_dir / "[Content_Types].xml")

            # Source presentation order via sldIdLst and rels
            src_pres_xml = src_dir / "ppt" / "presentation.xml"
            t = parse_xml(src_pres_xml)
            sldIdLst_src = t.getroot().find("p:sldIdLst", NS)
            src_pres_rels = parse_xml(src_dir / "ppt" / "_rels" / "presentation.xml.rels")
            id_to_target = {
                rel.get("Id"): rel.get("Target")
                for rel in src_pres_rels.getroot().findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
                if rel.get("Type") == "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
            }

            if sldIdLst_src is None:
                continue

            name_map: Dict[str, str] = {}

            for sldId in sldIdLst_src.findall("p:sldId", NS):
                rid = sldId.get("{%s}id" % NS["r"])
                target = id_to_target.get(rid)
                if not target:
                    continue

                # Normalize to a path relative to ppt root (e.g., "slides/slide1.xml")
                if target.startswith("/ppt/"):
                    part_rel = target[len("/ppt/"):]
                else:
                    part_rel = target

                # Copy slide and deep dependencies
                dst_part_rel = copy_part_with_dependencies(src_dir / "ppt",
                                                          base_dir / "ppt",
                                                          part_rel,
                                                          name_map,
                                                          ct_src_tree,
                                                          ct_tree)

                # Add relationship in base presentation.xml.rels
                new_rid = next_pres_rId()
                rel_el = ET.SubElement(pres_rels_root, "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
                rel_el.set("Id", new_rid)
                rel_el.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide")
                rel_el.set("Target", dst_part_rel)

                # Add slide id entry in base presentation.xml
                max_sld_id += 1
                sld_el = ET.SubElement(sldIdLst, "{%s}sldId" % NS["p"])
                sld_el.set("id", str(max_sld_id))
                sld_el.set("{%s}id" % NS["r"], new_rid)

                # Ensure content types override for the slide
                add_content_type_override(ct_tree, f"/ppt/{dst_part_rel}", CT_OVERRIDES["slides"])

                # Copy slide masters referenced (if any) already handled via dependencies.
                # Ensure defaults (e.g., image extensions) exist.
                ensure_default_types_from_source(ct_tree, ct_src_tree)

        # Save modified base package
        write_xml(pres_tree, pres_xml_path)
        write_xml(pres_rels_tree, pres_rels_path)
        write_xml(ct_tree, ct_path)

        # Zip back to pptx
        output.parent.mkdir(parents=True, exist_ok=True)
        zip_dir(base_dir, output)

def main():
    parser = argparse.ArgumentParser(description="Merge multiple .pptx files preserving exact slide formatting.")
    parser.add_argument("inputs", nargs="*", help=".pptx files to merge (in order). If omitted, interactive mode lists files in current folder.")
    parser.add_argument("-o", "--output", default="merged.pptx", help="Output .pptx filename (default: merged.pptx)")
    args = parser.parse_args()

    if args.inputs:
        files = [Path(x).resolve() for x in args.inputs]
    else:
        print("Interactive mode: scanning current folder for .pptx files...")
        files = build_file_list_from_folder(Path("."))

    if len(files) < 1:
        print("Nothing to merge. Provide at least one .pptx.")
        sys.exit(1)

    # Basic validation
    for f in files:
        if not f.exists() or f.suffix.lower() != ".pptx":
            print(f"Invalid input: {f}")
            sys.exit(1)

    out = Path(args.output).resolve()
    try:
        merge_presentations(files, out)
        print(f"\nDone. Wrote: {out}")
    except Exception as e:
        print("\nERROR while merging:")
        print(e)
        sys.exit(2)

if __name__ == "__main__":
    main()
