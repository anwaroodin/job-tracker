import { PDFDocument, PDFName, PDFNumber, type PDFPage, type PDFRef } from "@pdfme/pdf-lib";

function drawGroups(ops: string) {
  const groups: string[] = [];
  let depth = 0;
  for (const line of ops.split("\n")) {
    if (depth === 0) groups.push(line);
    else groups[groups.length - 1] += `\n${line}`;
    if (line === "q") depth++;
    else if (line === "Q") depth--;
  }
  return groups;
}

export function tagOperators(ops: string, first = 0) {
  let mcids = first;
  const tagged = drawGroups(ops).map((group) => {
    if (!group.startsWith("q\n")) return group;
    if (/\bBT\b/.test(group)) return `/P <</MCID ${mcids++}>> BDC\n${group}\nEMC`;
    return `/Artifact BMC\n${group}\nEMC`;
  });
  return { ops: tagged.join("\n"), mcids };
}

export function addStructTree(doc: PDFDocument, pages: { page: PDFPage; mcids: number }[]) {
  const { context } = doc;
  const rootRef = context.nextRef();
  const documentRef = context.nextRef();
  const parentTree: (PDFNumber | PDFRef[])[] = [];
  const kids: PDFRef[] = [];

  pages.forEach(({ page, mcids }, index) => {
    page.node.set(PDFName.of("StructParents"), PDFNumber.of(index));
    const paragraphs = Array.from({ length: mcids }, (_, mcid) =>
      context.register(context.obj({ Type: "StructElem", S: "P", P: documentRef, Pg: page.ref, K: mcid })),
    );
    kids.push(...paragraphs);
    parentTree.push(PDFNumber.of(index), paragraphs);
  });

  context.assign(documentRef, context.obj({ Type: "StructElem", S: "Document", P: rootRef, K: kids }));
  context.assign(
    rootRef,
    context.obj({ Type: "StructTreeRoot", K: documentRef, ParentTree: context.obj({ Nums: parentTree }), ParentTreeNextKey: pages.length }),
  );
  doc.catalog.set(PDFName.of("StructTreeRoot"), rootRef);
  doc.catalog.set(PDFName.of("MarkInfo"), context.obj({ Marked: true }));
}
