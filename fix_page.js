const fs = require('fs');
const oldContent = fs.readFileSync('frontend/src/app/client/[id]/page.tsx.old', 'utf-8');
const newContent = fs.readFileSync('frontend/src/app/client/[id]/page.tsx', 'utf-8');

const t2112Cut = oldContent.indexOf('{section === "personas" && (');
const t2113End = oldContent.indexOf('                {section === "analisi-strategica" && (');
const missingChunks = oldContent.slice(t2112Cut, t2113End);

// inject missing chunks back into new page.tsx right before {section === "analisi-strategica" }
const insertionPoint = newContent.indexOf('                {/* ══ ANALISI COMPLETA ══ */}');
const finalContent = newContent.slice(0, insertionPoint) + missingChunks + newContent.slice(insertionPoint);

fs.writeFileSync('frontend/src/app/client/[id]/page.tsx', finalContent, 'utf-8');
console.log("Personas and Reports sections successfully restored!");
